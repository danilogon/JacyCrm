import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const { email, nome, codigo } = req.body ?? {};

  if (!email || !codigo) {
    res.status(400).json({ error: 'Parâmetros inválidos' });
    return;
  }

  const user = process.env.EMAIL_GMAIL_USER;
  const pass = process.env.EMAIL_GMAIL_PASS;

  if (!user || !pass) {
    res.status(500).json({ error: 'Credenciais de e-mail não configuradas no servidor' });
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `"SmartCor" <${user}>`,
    to: email,
    subject: 'Seu código de acesso — SmartCor',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 32px; border: 1px solid #e5e7eb; border-radius: 12px;">
        <h2 style="color: #1e3a5f; margin-bottom: 8px;">Verificação de acesso</h2>
        <p style="color: #4b5563;">Olá, <strong>${nome ?? email}</strong>!</p>
        <p style="color: #4b5563;">Use o código abaixo para concluir o login no SmartCor:</p>
        <div style="font-size: 36px; font-weight: bold; letter-spacing: 12px; color: #1e3a5f;
                    background: #f0f4ff; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
          ${codigo}
        </div>
        <p style="color: #6b7280; font-size: 13px;">Este código expira em <strong>5 minutos</strong>. Não compartilhe com ninguém.</p>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px;">Se você não tentou fazer login, ignore este e-mail.</p>
      </div>
    `,
  });

  res.status(200).json({ ok: true });
}
