/**
 * Download do documento assinado via ClickSign.
 *
 * Estratégia principal: API v1 GET /api/v1/documents/{key}?access_token={token}
 * retorna JSON com metadados incluindo link de download do PDF assinado.
 *
 * Fallback: API v3 com captura de redirect 302 para URL S3.
 */

const BASE_V1 = 'https://app.clicksign.com/api/v1';
const BASE_V3 = 'https://app.clicksign.com/api/v3';

function rawToken(token) {
  // Remove prefixo "Bearer " se presente — v1 usa access_token como query param
  return token.replace(/^Bearer\s+/i, '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { token, envelopeId, documentKey } = req.body ?? {};
  if (!token || !envelopeId) {
    res.status(400).json({ error: 'token e envelopeId são obrigatórios' });
    return;
  }

  const at = rawToken(token);

  // ── Estratégia 1: API v1 GET /api/v1/documents/{key} ──────────────────────
  if (documentKey) {
    try {
      const v1Res = await fetch(`${BASE_V1}/documents/${documentKey}?access_token=${at}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (v1Res.ok) {
        const j = await v1Res.json().catch(() => null);
        // ClickSign v1 retorna o link em diferentes campos dependendo da versão
        const url =
          j?.document?.downloads?.signed_file_url ??
          j?.document?.download_link ??
          j?.document?.file_url ??
          j?.document?.signed_file_url ??
          j?.download_link ??
          null;

        if (url) {
          res.status(200).json({ url });
          return;
        }

        // Se o JSON não tem URL direto, loga as chaves para diagnóstico
        console.log('[clicksign-download] v1 JSON sem url conhecido:', JSON.stringify(j).slice(0, 500));
      } else {
        const txt = await v1Res.text().catch(() => '');
        console.log(`[clicksign-download] v1 status=${v1Res.status} body=${txt.slice(0, 200)}`);
      }
    } catch (err) {
      console.error('[clicksign-download] v1 erro:', err);
    }
  }

  // ── Estratégia 2: API v3 com redirect manual (captura URL S3) ────────────
  try {
    // Busca ID do documento se não veio como documentKey
    let docId = documentKey ?? null;
    if (!docId) {
      const docsRes = await fetch(`${BASE_V3}/envelopes/${envelopeId}/documents`, {
        headers: { Authorization: token, Accept: 'application/json' },
      });
      if (docsRes.ok) {
        const j = await docsRes.json().catch(() => null);
        docId = j?.data?.[0]?.id ?? null;
      }
    }

    const paths = docId
      ? [
          `envelopes/${envelopeId}/documents/${docId}/download`,
          `envelopes/${envelopeId}/download`,
        ]
      : [`envelopes/${envelopeId}/download`];

    for (const path of paths) {
      // Tenta sem seguir redirect para capturar Location header (URL S3)
      const r = await fetch(`${BASE_V3}/${path}`, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          Authorization: token,
          Accept: 'application/pdf, application/octet-stream, application/json, */*',
        },
      });

      if (r.status === 301 || r.status === 302 || r.status === 307 || r.status === 308) {
        const location = r.headers.get('location') ?? r.headers.get('Location');
        if (location) {
          res.status(200).json({ url: location });
          return;
        }
      }

      if (r.status >= 200 && r.status < 300) {
        const ct = r.headers.get('content-type') ?? '';

        if (ct.includes('pdf') || ct.includes('octet-stream')) {
          const buf = Buffer.from(await r.arrayBuffer());
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="documento-assinado.pdf"');
          res.send(buf);
          return;
        }

        if (ct.includes('json')) {
          const j = await r.json().catch(() => null);
          const url =
            j?.data?.attributes?.url ??
            j?.data?.attributes?.download_url ??
            j?.data?.attributes?.file_url ??
            j?.url ??
            j?.download_url ??
            null;
          if (url) {
            res.status(200).json({ url });
            return;
          }
          console.log('[clicksign-download] v3 JSON sem url:', JSON.stringify(j).slice(0, 400));
        }
      }
    }
  } catch (err) {
    console.error('[clicksign-download] v3 erro:', err);
  }

  res.status(502).json({
    error: 'Não foi possível obter o link de download. Verifique se o documento está assinado no ClickSign.',
  });
}
