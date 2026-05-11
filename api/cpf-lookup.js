const CPF_API_KEY = '9ccf048d4f396fae0620a27ea3be07b28b714dc3d5b7d94f163d8bdd8ef5cd92';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const cpfDigits = String(req.query.cpf ?? '').replace(/\D/g, '');

  if (cpfDigits.length !== 11) {
    return res.status(400).json({ success: false, error: 'CPF deve ter 11 dígitos' });
  }

  try {
    const upstream = await fetch(`https://api.cpf-brasil.org/cpf/${cpfDigits}`, {
      headers: {
        'X-API-Key': CPF_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const data = await upstream.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ success: false, error: 'Erro ao consultar API de CPF' });
  }
};
