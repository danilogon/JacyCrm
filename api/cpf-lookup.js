import https from 'https';

const API_KEY = '9ccf048d4f396fae0620a27ea3be07b28b714dc3d5b7d94f163d8bdd8ef5cd92';
const TIMEOUT_MS = 8000;

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const cpf = req.query && req.query.cpf ? String(req.query.cpf).replace(/\D/g, '') : '';

  if (cpf.length !== 11) {
    res.status(400).json({ success: false, error: 'CPF deve ter 11 digitos' });
    return;
  }

  const options = {
    hostname: 'api.cpf-brasil.org',
    path: '/cpf/' + cpf,
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
    timeout: TIMEOUT_MS,
  };

  let respondido = false;

  const request = https.request(options, function (response) {
    let body = '';
    response.on('data', function (chunk) { body += chunk; });
    response.on('end', function () {
      if (respondido) return;
      respondido = true;
      try {
        const data = JSON.parse(body);
        res.status(200).json(data);
      } catch {
        res.status(200).json({ success: false, error: 'Resposta invalida do serviço externo.' });
      }
    });
  });

  request.on('timeout', function () {
    if (respondido) return;
    respondido = true;
    request.destroy();
    res.status(200).json({ success: false, error: 'Serviço de consulta de CPF indisponível (timeout).' });
  });

  request.on('error', function (err) {
    if (respondido) return;
    respondido = true;
    console.error('[cpf-lookup] Erro na consulta externa:', err.message);
    res.status(200).json({ success: false, error: 'Serviço de consulta de CPF indisponível.' });
  });

  request.end();
}
