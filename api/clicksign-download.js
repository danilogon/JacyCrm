/**
 * Retorna a URL de download do documento assinado no ClickSign.
 * O frontend abre essa URL diretamente no navegador.
 *
 * Estratégias em ordem:
 *  1. GET /envelopes/{id}/documents → atributo url/download_url do documento
 *  2. GET /envelopes/{id} → atributo download_url do envelope
 *  3. Monta URL pública do ClickSign com access_token na query string
 */

const BASE = 'https://app.clicksign.com/api/v3';

async function csGet(token, path) {
  const res = await fetch(`${BASE}/${path}`, {
    headers: {
      Authorization: token,
      Accept: 'application/vnd.api+json, application/json, */*',
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* não é JSON */ }
  return { ok: res.status >= 200 && res.status < 300, status: res.status, json };
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
    // 1. Lista documentos do envelope para pegar URL do arquivo
    const docsRes = await csGet(token, `envelopes/${envelopeId}/documents`);
    if (docsRes.ok && docsRes.json) {
      const docs = docsRes.json?.data ?? [];
      const doc = Array.isArray(docs) ? docs[0] : null;
      const attrs = doc?.attributes ?? {};

      const url =
        attrs.download_url ??
        attrs.url ??
        attrs.file_url ??
        null;

      if (url) {
        res.status(200).json({ url });
        return;
      }

      // Tenta baixar via endpoint de download do documento
      if (doc?.id) {
        const dlRes = await csGet(token, `envelopes/${envelopeId}/documents/${doc.id}/download`);
        if (dlRes.ok && dlRes.json) {
          const dlUrl =
            dlRes.json?.data?.attributes?.url ??
            dlRes.json?.url ??
            null;
          if (dlUrl) { res.status(200).json({ url: dlUrl }); return; }
        }
        // Se retornou texto/PDF diretamente pelo status, monta URL pública
      }
    }

    // 2. Tenta obter download_url do envelope
    const envRes = await csGet(token, `envelopes/${envelopeId}`);
    if (envRes.ok && envRes.json) {
      const envUrl =
        envRes.json?.data?.attributes?.download_url ??
        envRes.json?.data?.attributes?.file_url ??
        null;
      if (envUrl) { res.status(200).json({ url: envUrl }); return; }
    }

    // 3. Fallback: URL pública com access_token (funciona para tokens válidos)
    const fallbackUrl = `${BASE}/envelopes/${envelopeId}/download?access_token=${token}`;
    res.status(200).json({ url: fallbackUrl });

  } catch (err) {
    console.error('[clicksign-download] Erro:', err);
    res.status(500).json({ error: String(err) });
  }
}
