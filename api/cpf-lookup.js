var https = require('https');

var API_KEY = '9ccf048d4f396fae0620a27ea3be07b28b714dc3d5b7d94f163d8bdd8ef5cd92';

module.exports = function (req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var cpf = req.query && req.query.cpf ? String(req.query.cpf).replace(/\D/g, '') : '';

  if (cpf.length !== 11) {
    res.status(400).json({ success: false, error: 'CPF deve ter 11 digitos' });
    return;
  }

  var options = {
    hostname: 'api.cpf-brasil.org',
    path: '/cpf/' + cpf,
    method: 'GET',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json',
    },
  };

  var request = https.request(options, function (response) {
    var body = '';
    response.on('data', function (chunk) { body += chunk; });
    response.on('end', function () {
      try {
        var data = JSON.parse(body);
        res.status(200).json(data);
      } catch (e) {
        res.status(500).json({ success: false, error: 'Resposta invalida: ' + body.slice(0, 200) });
      }
    });
  });

  request.on('error', function (err) {
    res.status(502).json({ success: false, error: err.message });
  });

  request.end();
};
