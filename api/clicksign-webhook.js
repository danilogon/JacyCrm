/**
 * Webhook ClickSign — recebe eventos de assinatura e persiste no Supabase.
 *
 * Suporta dois formatos de payload:
 *   • v3 (atual): event.data.envelope.id / event.data.envelope.status
 *   • v1/v2 (legado): event.data.document.key / event.data.document.status
 *
 * Verificação HMAC SHA256:
 *   - ClickSign envia X-Clicksign-Hmac-Sha256 com HMAC(secret, rawBody) em hex
 *   - O secret deve estar em CLICKSIGN_WEBHOOK_SECRET no Vercel
 *   - Se o secret não estiver configurado → aceita sem verificar
 *   - Se o secret estiver configurado mas o header estiver ausente → aceita com aviso
 *     (compatibilidade com webhooks v1/v2 que não enviam HMAC)
 *   - Se o secret e o header estiverem presentes → verifica e rejeita se inválido
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

// Mapeamento de status v3 (envelope.status)
const STATUS_MAP_V3 = {
  completed: 'assinado',
  canceled:  'cancelado',
  expired:   'expirado',
  running:   'enviado',
};

// Mapeamento de status v1/v2 (document.status)
const STATUS_MAP_V1_DOC = {
  closed:   'assinado',
  canceled: 'cancelado',
  expired:  'expirado',
  running:  'enviado',
};

// Alguns eventos v1 já determinam o status independente do document.status
const STATUS_MAP_V1_EVENT = {
  'Event::Close':    'assinado',
  'Event::Cancel':   'cancelado',
  'Event::Expired':  'expirado',
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

  const bodyBuffer = await rawBody(req);
  const bodyText   = bodyBuffer.toString('utf-8');

  // Verificação HMAC (somente se secret configurado E header presente)
  const secret = process.env.CLICKSIGN_WEBHOOK_SECRET;
  if (secret) {
    const assinatura = req.headers['x-clicksign-hmac-sha256'] ?? '';
    if (assinatura) {
      if (!verificarHmac(secret, bodyBuffer, assinatura)) {
        res.status(401).json({ error: 'Assinatura HMAC inválida.' });
        return;
      }
    } else {
      // Header ausente → aceita mesmo assim (compatibilidade v1/v2)
      console.warn('[webhook] HMAC secret configurado mas header ausente. Aceitando (v1/v2 compat).');
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
    const eventoNome = payload?.event?.name ?? '';

    let envelopeKey   = '';
    let statusClicksign = '';
    let statusLocal   = null;

    const dadosV3 = payload?.event?.data?.envelope;
    const dadosV1 = payload?.event?.data?.document;

    if (dadosV3) {
      // ── Formato v3 ────────────────────────────────────────────────────────
      envelopeKey     = dadosV3.id ?? '';
      statusClicksign = dadosV3.status ?? '';
      statusLocal     = STATUS_MAP_V3[statusClicksign] ?? null;

    } else if (dadosV1) {
      // ── Formato v1/v2 ─────────────────────────────────────────────────────
      envelopeKey     = dadosV1.key ?? '';
      statusClicksign = dadosV1.status ?? '';

      // Evento tem prioridade sobre o status do documento
      statusLocal =
        STATUS_MAP_V1_EVENT[eventoNome] ??
        STATUS_MAP_V1_DOC[statusClicksign] ??
        null;

    } else {
      // Payload sem dados reconhecíveis — registra e retorna OK para não gerar retentativas
      console.warn('[webhook] Payload sem dados de envelope ou document:', bodyText.slice(0, 300));
      res.status(200).json({ ok: true, aviso: 'Evento sem dados reconhecíveis; ignorado.' });
      return;
    }

    if (!envelopeKey) {
      res.status(400).json({ error: 'Payload sem chave de envelope/documento.' });
      return;
    }

    const { error } = await supabase.from('clicksign_eventos').insert({
      id:                    `${envelopeKey}_${Date.now()}`,
      envelope_id_clicksign: envelopeKey,
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
