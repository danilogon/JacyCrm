/**
 * Proxy server-side para a API ClickSign v3.
 * Necessário porque o browser bloqueia chamadas diretas (CORS + CSP).
 * Recebe: { token, path, method, body }
 * Encaminha para: https://app.clicksign.com/api/v3/{path}
 */

const CLICKSIGN_BASE = 'https://app.clicksign.com/api/v3';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Método não permitido' }); return; }

  const { token, path, method = 'GET', body } = req.body ?? {};

  if (!token || !path) {
    res.status(400).json({ error: 'Parâmetros obrigatórios: token, path' });
    return;
  }

  const url = `${CLICKSIGN_BASE}/${path}`;

  try {
    const fetchOptions = {
      method,
      headers: {
        Authorization: token,
        'Content-Type': 'application/vnd.api+json',
      },
    };

    if (body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
    }

    const upstream = await fetch(url, fetchOptions);
    const text = await upstream.text();

    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: `Falha ao conectar ao ClickSign: ${err.message}` });
  }
}
