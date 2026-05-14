/**
 * Download do documento assinado via ClickSign.
 *
 * Estratégia 1: API v3 com redirect:follow — captura a URL S3 final via response.url
 * Estratégia 2: API v1 GET /api/v1/documents/{key} — retorna JSON com link de download
 * Estratégia 3: Serve o PDF diretamente se o corpo for application/pdf
 */

const BASE_V1 = 'https://app.clicksign.com/api/v1';
const BASE_V3 = 'https://app.clicksign.com/api/v3';

function rawToken(token) {
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

  // ── Estratégia 1: API v3 com redirect:follow ──────────────────────────────
  try {
    let docId = documentKey ?? null;

    // Busca o ID do documento se não foi fornecido
    if (!docId) {
      const docsRes = await fetch(`${BASE_V3}/envelopes/${envelopeId}/documents`, {
        headers: { Authorization: token, Accept: 'application/json' },
      });
      if (docsRes.ok) {
        const j = await docsRes.json().catch(() => null);
        docId = j?.data?.[0]?.id ?? null;
        console.log('[clicksign-download] docId encontrado:', docId);
      }
    }

    const paths = docId
      ? [
          `envelopes/${envelopeId}/documents/${docId}/download`,
          `envelopes/${envelopeId}/download`,
        ]
      : [`envelopes/${envelopeId}/download`];

    for (const path of paths) {
      const r = await fetch(`${BASE_V3}/${path}`, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          Authorization: token,
          Accept: 'application/pdf, application/octet-stream, application/json, */*',
        },
      });

      console.log(`[clicksign-download] v3 path=${path} status=${r.status} url=${r.url} ct=${r.headers.get('content-type')}`);

      if (r.ok || r.status === 200) {
        const ct = r.headers.get('content-type') ?? '';

        // Se o fetch seguiu um redirect, r.url é a URL S3 final
        if (r.url && r.url !== `${BASE_V3}/${path}`) {
          res.status(200).json({ url: r.url });
          return;
        }

        if (ct.includes('pdf') || ct.includes('octet-stream')) {
          const buf = Buffer.from(await r.arrayBuffer());
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="documento-assinado.pdf"');
          res.send(buf);
          return;
        }

        if (ct.includes('json')) {
          const j = await r.json().catch(() => null);
          console.log('[clicksign-download] v3 JSON:', JSON.stringify(j).slice(0, 600));
          const url =
            j?.data?.attributes?.download_url ??
            j?.data?.attributes?.url ??
            j?.data?.attributes?.file_url ??
            j?.data?.attributes?.signed_file_url ??
            j?.download_url ??
            j?.url ??
            null;
          if (url) {
            res.status(200).json({ url });
            return;
          }
        }
      }
    }
  } catch (err) {
    console.error('[clicksign-download] v3 erro:', err);
  }

  // ── Estratégia 2: API v1 GET /api/v1/documents/{key} ──────────────────────
  if (documentKey) {
    try {
      const v1Res = await fetch(`${BASE_V1}/documents/${documentKey}?access_token=${at}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (v1Res.ok) {
        const j = await v1Res.json().catch(() => null);
        console.log('[clicksign-download] v1 JSON:', JSON.stringify(j).slice(0, 600));
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
      } else {
        const txt = await v1Res.text().catch(() => '');
        console.log(`[clicksign-download] v1 status=${v1Res.status} body=${txt.slice(0, 300)}`);
      }
    } catch (err) {
      console.error('[clicksign-download] v1 erro:', err);
    }
  }

  res.status(200).json({
    ok: false,
    error: 'Não foi possível obter o link de download. Verifique se o documento está assinado no ClickSign.',
  });
}
