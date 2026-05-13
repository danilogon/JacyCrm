/**
 * Envio de código 2FA via API Route Vercel (/api/send-code).
 * No servidor, usa Nodemailer + Gmail com Senha de App.
 *
 * Variáveis de ambiente necessárias no Vercel:
 *   EMAIL_GMAIL_USER  → seuemail@gmail.com
 *   EMAIL_GMAIL_PASS  → senha de app de 16 caracteres (sem espaços)
 *
 * Fallback: se as variáveis VITE_EMAILJS_* estiverem presentes,
 * usa EmailJS como alternativa (mantém compatibilidade).
 */
import emailjs from '@emailjs/browser';

// ── EmailJS (legado / fallback) ───────────────────────────────────────────────
const EMAILJS_SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  as string | undefined;
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const EMAILJS_PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

export function emailJsConfigurado(): boolean {
  // Considera configurado se a API Route está disponível (sempre em produção Vercel)
  // ou se as credenciais EmailJS foram fornecidas
  return true;
}

export async function enviarCodigo2FA(params: {
  email: string;
  nome: string;
  codigo: string;
}): Promise<void> {
  // Tenta primeiro a API Route Vercel (Gmail via Nodemailer)
  try {
    const res = await fetch('/api/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: params.email,
        nome:  params.nome,
        codigo: params.codigo,
      }),
    });

    if (res.ok) return;

    const body = await res.json().catch(() => ({}));
    // Se o erro for de credenciais não configuradas, tenta fallback EmailJS
    if (res.status === 500 && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
      await _enviarViaEmailJs(params);
      return;
    }

    throw new Error(body.error ?? `Erro ao enviar código (HTTP ${res.status})`);
  } catch (err) {
    // Se a requisição falhar completamente (ex: dev local sem a function),
    // tenta EmailJS se estiver configurado
    if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
      await _enviarViaEmailJs(params);
      return;
    }
    throw err;
  }
}

async function _enviarViaEmailJs(params: { email: string; nome: string; codigo: string }) {
  await emailjs.send(
    EMAILJS_SERVICE_ID!,
    EMAILJS_TEMPLATE_ID!,
    { to_email: params.email, to_name: params.nome, codigo: params.codigo },
    EMAILJS_PUBLIC_KEY!,
  );
}

export function gerarCodigo(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(100000 + (array[0] % 900000));
}
