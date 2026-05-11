const https = require('https');

const CPF_API_KEY = '9ccf048d4f396fae0620a27ea3be07b28b714dc3d5b7d94f163d8bdd8ef5cd92';

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers,
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error('JSON inválido: ' + body)); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cpfDigits = String(req.query.cpf ?? '').replace(/\D/g, '');
  if (cpfDigits.length !== 11) {
    return res.status(400).json({ success: false, error: 'CPF deve ter 11 dígitos' });
  }

  try {
    const data = await httpGet(
      `https://api.cpf-brasil.org/cpf/${cpfDigits}`,
      {
        'X-API-Key': CPF_API_KEY,
        'Content-Type': 'application/json',
      }
    );
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ success: false, error: String(err) });
  }
};
