/**
 * Proxy para download do documento assinado via ClickSign API v3.
 * Recebe { token, envelopeId } e retorna o PDF assinado.
 *
 * Tenta em ordem:
 *   1. GET /envelopes/{id}/download          (endpoint v3 de envelope)
 *   2. GET /envelopes/{id}/documents → pega o primeiro docId
 *      → GET /envelopes/{id}/documents/{docId}/download
 */

const BASE = 'https://app.clicksign.com/api/v3';

async function clicksignGet(token, path) {
  return fetch(`${BASE}/${path}`, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      Authorization: token,
      Accept: 'application/pdf, application/octet-stream, application/vnd.api+json, */*',
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

  try {
    // Tentativa 1: endpoint direto de download do envelope
    let r = await clicksignGet(token, `envelopes/${envelopeId}/download`);

    // Tentativa 2: busca o primeiro documento e baixa por ele
    if (!r.ok || (r.headers.get('content-type') ?? '').includes('json')) {
      const docRes = await clicksignGet(token, `envelopes/${envelopeId}/documents`);
      if (docRes.ok) {
        const docJson = await docRes.json().catch(() => null);
        const docId = docJson?.data?.[0]?.id;
        if (docId) {
          r = await clicksignGet(token, `envelopes/${envelopeId}/documents/${docId}/download`);
        }
      }
    }

    if (!r.ok) {
      const text = await r.text().catch(() => '');
      res.status(r.status).json({ error: `ClickSign retornou ${r.status}: ${text.slice(0, 300)}` });
      return;
    }

    const contentType = r.headers.get('content-type') || 'application/pdf';

    // Se retornou JSON (ex: redirect para URL externa), extrai a URL e faz o fetch
    if (contentType.includes('json')) {
      const json = await r.json().catch(() => null);
      const downloadUrl = json?.data?.attributes?.download_url ?? json?.download_url ?? null;
      if (downloadUrl) {
        const pdfRes = await fetch(downloadUrl, { redirect: 'follow' });
        if (!pdfRes.ok) {
          res.status(pdfRes.status).json({ error: `Falha ao baixar PDF: ${pdfRes.status}` });
          return;
        }
        const buf = Buffer.from(await pdfRes.arrayBuffer());
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="documento-assinado.pdf"`);
        res.send(buf);
        return;
      }
      res.status(502).json({ error: 'ClickSign não retornou URL de download.' });
      return;
    }

    const buffer = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="documento-assinado.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);

  } catch (err) {
    console.error('[clicksign-download] Erro:', err);
    res.status(500).json({ error: String(err) });
  }
}
