/**
 * Retorna a URL de download do documento assinado via ClickSign API v3.
 *
 * ClickSign pode responder com:
 * - 302 redirect para URL S3 pré-assinado
 * - 200 JSON com atributo de URL
 * - 200 binário PDF direto
 */

const BASE = 'https://app.clicksign.com/api/v3';

async function csGet(token, path, followRedirect = false) {
  return fetch(`${BASE}/${path}`, {
    method: 'GET',
    redirect: followRedirect ? 'follow' : 'manual',
    headers: {
      Authorization: token,
      Accept: 'application/pdf, application/octet-stream, application/json, */*',
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { token, envelopeId } = req.body ?? {};
  if (!token || !envelopeId) {
    res.status(400).json({ error: 'token e envelopeId são obrigatórios' });
    return;
  }

  const diagnostico = [];

  try {
    // 1. Busca ID do primeiro documento do envelope
    const docsR = await csGet(token, `envelopes/${envelopeId}/documents`, true);
    let docId = null;
    if (docsR.ok) {
      const j = await docsR.json().catch(() => null);
      docId = j?.data?.[0]?.id ?? null;
      diagnostico.push(`docs status=${docsR.status} docId=${docId}`);
    } else {
      const txt = await docsR.text().catch(() => '');
      diagnostico.push(`docs status=${docsR.status} body=${txt.slice(0, 200)}`);
    }

    // 2. Tenta capturar redirect ou URL de download
    const paths = docId
      ? [
          `envelopes/${envelopeId}/documents/${docId}/download`,
          `envelopes/${envelopeId}/download`,
        ]
      : [`envelopes/${envelopeId}/download`];

    for (const path of paths) {
      // Tenta sem seguir redirect (captura Location header)
      const r = await csGet(token, path, false);
      const ct = r.headers.get('content-type') ?? '';
      const location = r.headers.get('location') ?? r.headers.get('Location') ?? null;
      diagnostico.push(`path=${path} status=${r.status} ct=${ct} location=${location?.slice(0, 80) ?? 'null'}`);

      // Redirect → Location é o URL S3 pré-assinado
      if (r.status === 301 || r.status === 302 || r.status === 307 || r.status === 308) {
        if (location) {
          res.status(200).json({ url: location });
          return;
        }
      }

      // Resposta 200 direta
      if (r.status >= 200 && r.status < 300) {
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
          diagnostico.push(`json keys=${JSON.stringify(Object.keys(j?.data?.attributes ?? j ?? {})).slice(0, 200)}`);
          if (url) {
            res.status(200).json({ url });
            return;
          }
        }

        // Tenta seguindo redirect (caso redirect manual não tenha funcionado)
        const r2 = await csGet(token, path, true);
        const ct2 = r2.headers.get('content-type') ?? '';
        const finalUrl = r2.url;
        diagnostico.push(`follow status=${r2.status} finalUrl=${finalUrl?.slice(0, 80)}`);

        if (r2.ok && (ct2.includes('pdf') || ct2.includes('octet-stream'))) {
          const buf = Buffer.from(await r2.arrayBuffer());
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline; filename="documento-assinado.pdf"');
          res.send(buf);
          return;
        }

        if (r2.ok && ct2.includes('json')) {
          const j2 = await r2.json().catch(() => null);
          const url2 =
            j2?.data?.attributes?.url ??
            j2?.data?.attributes?.download_url ??
            j2?.data?.attributes?.file_url ??
            j2?.url ??
            j2?.download_url ??
            null;
          if (url2) {
            res.status(200).json({ url: url2 });
            return;
          }
          // Se chegou aqui com follow, o finalUrl já é o destino final (S3)
          if (finalUrl && finalUrl !== `${BASE}/${path}`) {
            res.status(200).json({ url: finalUrl });
            return;
          }
        }
      }
    }

    // Nenhuma estratégia funcionou — devolve diagnóstico
    console.error('[clicksign-download] Falha. Diagnóstico:', diagnostico);
    res.status(502).json({
      error: 'Não foi possível obter o link de download. Verifique se o documento está assinado no ClickSign.',
      diagnostico,
    });

  } catch (err) {
    console.error('[clicksign-download] Erro:', err);
    res.status(500).json({ error: String(err), diagnostico });
  }
}
