/**
 * Cancela um documento no ClickSign via API v1.
 * Endpoint: PATCH /api/v1/documents/{key}/cancel?access_token={token}
 */

const BASE_V1 = 'https://app.clicksign.com/api/v1';

function rawToken(token) {
  return token.replace(/^Bearer\s+/i, '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, documentKey } = req.body ?? {};
  if (!token || !documentKey) {
    return res.status(400).json({ error: 'token e documentKey são obrigatórios' });
  }

  const at = rawToken(token);

  try {
    const r = await fetch(
      `${BASE_V1}/documents/${documentKey}/cancel?access_token=${at}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      }
    );

    if (r.ok || r.status === 204) {
      return res.status(200).json({ ok: true });
    }

    const text = await r.text().catch(() => '');
    console.error(`[clicksign-cancel] status=${r.status} body=${text.slice(0, 300)}`);
    return res.status(r.status).json({ error: text.slice(0, 200) || `Erro ${r.status}` });

  } catch (err) {
    console.error('[clicksign-cancel] Erro:', err);
    return res.status(500).json({ error: String(err) });
  }
}
