module.exports = function (req, res) {
  res.status(200).json({ ok: true, cpf: req.query ? req.query.cpf : 'sem query' });
};
