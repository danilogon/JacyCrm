/**
 * Cancela um documento no ClickSign via API v1.
 * Tenta PATCH primeiro, com fallback para POST conforme documentação.
 * Endpoint: /api/v1/documents/{key}/cancel?access_token={token}
 */

const BASE_V1 = 'https://app.clicksign.com/api/v1';

function rawToken(token) {
  return token.replace(/^Bearer\s+/i, '').trim();
}

async function tentarCancelar(url, method) {
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { token, documentKey } = req.body ?? {};
  if (!token || !documentKey) {
    return res.status(400).json({ error: 'token e documentKey são obrigatórios' });
  }

  const at = rawToken(token);
  const url = `${BASE_V1}/documents/${documentKey}/cancel?access_token=${at}`;

  try {
    // Tenta PATCH (recomendado pelo ClickSign)
    let r = await tentarCancelar(url, 'PATCH');

    // Fallback para POST se PATCH não for aceito
    if (r.status === 405 || r.status === 404) {
      r = await tentarCancelar(url, 'POST');
    }

    const text = await r.text().catch(() => '');

    console.log(`[clicksign-cancel] method=PATCH status=${r.status} body=${text.slice(0, 200)}`);

    if (r.ok || r.status === 204) {
      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({
      ok: false,
      error: text.slice(0, 300) || `Erro ${r.status} do ClickSign`,
      statusCode: r.status,
    });

  } catch (err) {
    console.error('[clicksign-cancel] Erro:', err);
    return res.status(200).json({ ok: false, error: String(err) });
  }
}
