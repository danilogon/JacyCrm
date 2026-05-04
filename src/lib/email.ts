/**
 * Envio de e-mail via EmailJS (browser-side, sem backend).
 * Configure as variáveis no Vercel / .env.local:
 *   VITE_EMAILJS_SERVICE_ID
 *   VITE_EMAILJS_TEMPLATE_ID
 *   VITE_EMAILJS_PUBLIC_KEY
 */
import emailjs from '@emailjs/browser';

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID  as string | undefined;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY  as string | undefined;

export function emailJsConfigurado(): boolean {
  return !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

export async function enviarCodigo2FA(params: {
  email: string;
  nome: string;
  codigo: string;
}): Promise<void> {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error('EmailJS não configurado. Adicione as variáveis VITE_EMAILJS_* ao ambiente.');
  }

  await emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: params.email,
      to_name:  params.nome,
      codigo:   params.codigo,
    },
    PUBLIC_KEY,
  );
}

export function gerarCodigo(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
