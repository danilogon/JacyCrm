import type { VercelRequest, VercelResponse } from '@vercel/node';

const CPF_API_KEY = '9ccf048d4f396fae0620a27ea3be07b28b714dc3d5b7d94f163d8bdd8ef5cd92';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Só aceita GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { cpf } = req.query;
  const cpfDigits = String(cpf ?? '').replace(/\D/g, '');

  if (cpfDigits.length !== 11) {
    return res.status(400).json({ error: 'CPF inválido' });
  }

  try {
    const upstream = await fetch(`https://api.cpf-brasil.org/cpf/${cpfDigits}`, {
      headers: {
        'X-API-Key': CPF_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const data = await upstream.json();

    // Repassa a resposta ao frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch {
    return res.status(502).json({ success: false, error: 'Erro ao consultar API de CPF' });
  }
}
