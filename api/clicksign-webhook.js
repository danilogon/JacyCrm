/**
 * Webhook ClickSign — recebe eventos de assinatura e persiste no Supabase.
 * Configure no painel ClickSign: Integrações → Webhooks → URL desta rota.
 *
 * Eventos tratados:
 *   envelope:completed  → assinado
 *   envelope:canceled   → cancelado
 *   envelope:expired    → expirado
 *   signer:signed       → registrado (status do envelope permanece "enviado" até completed)
 */

import { createClient } from '@supabase/supabase-js';

const STATUS_MAP = {
  completed: 'assinado',
  canceled:  'cancelado',
  expired:   'expirado',
  running:   'enviado',
};

export default async function handler(req, res) {
  // ClickSign faz POST para notificar eventos
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
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
    const payload = req.body ?? {};

    // Estrutura do payload ClickSign v3
    const eventoNome      = payload?.event?.name ?? '';          // ex: "envelope:completed"
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
