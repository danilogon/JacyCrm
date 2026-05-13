/**
 * Webhook ClickSign — recebe eventos de assinatura e persiste no Supabase.
 * Configure no painel ClickSign: Integrações → Webhooks → URL desta rota.
 *
 * Verificação HMAC SHA256:
 *   - ClickSign envia o header X-Clicksign-Hmac-Sha256 com HMAC(secret, rawBody) em hex
 *   - O secret deve estar na variável de ambiente CLICKSIGN_WEBHOOK_SECRET no Vercel
 *   - Se o secret não estiver configurado, o webhook aceita sem verificar (modo legado)
 *
 * Eventos tratados:
 *   envelope:completed → assinado
 *   envelope:canceled  → cancelado
 *   envelope:expired   → expirado
 *   signer:signed      → registrado (status permanece "enviado" até completed)
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Desabilita o body parser do Vercel para lermos o raw body (necessário para HMAC)
export const config = { api: { bodyParser: false } };

const STATUS_MAP = {
  completed: 'assinado',
  canceled:  'cancelado',
  expired:   'expirado',
  running:   'enviado',
};

async function rawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verificarHmac(secret, body, headerValue) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(headerValue));
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  // Lê o raw body antes de parsear
  const bodyBuffer = await rawBody(req);
  const bodyText   = bodyBuffer.toString('utf-8');

  // Verificação HMAC (se o secret estiver configurado)
  const secret = process.env.CLICKSIGN_WEBHOOK_SECRET;
  if (secret) {
    const assinatura = req.headers['x-clicksign-hmac-sha256'] ?? '';
    if (!assinatura) {
      res.status(401).json({ error: 'Header X-Clicksign-Hmac-Sha256 ausente.' });
      return;
    }
    if (!verificarHmac(secret, bodyBuffer, assinatura)) {
      res.status(401).json({ error: 'Assinatura HMAC inválida.' });
      return;
    }
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[webhook] Variáveis VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não configuradas.');
    res.status(500).json({ error: 'Configuração de banco ausente.' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const payload = JSON.parse(bodyText);

    const eventoNome      = payload?.event?.name ?? '';
    const envelopeId      = payload?.event?.data?.envelope?.id ?? '';
    const statusClicksign = payload?.event?.data?.envelope?.status ?? '';

    if (!envelopeId) {
      res.status(400).json({ error: 'Payload sem envelope.id' });
      return;
    }

    const statusLocal = STATUS_MAP[statusClicksign] ?? null;

    const { error } = await supabase.from('clicksign_eventos').insert({
      id:                    `${envelopeId}_${Date.now()}`,
      envelope_id_clicksign: envelopeId,
      evento:                eventoNome,
      status_clicksign:      statusClicksign,
      status_local:          statusLocal,
      payload:               payload,
      recebido_em:           new Date().toISOString(),
    });

    if (error) {
      console.error('[webhook] Erro ao gravar evento:', error.message);
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[webhook] Erro inesperado:', err);
    res.status(500).json({ error: String(err) });
  }
}
