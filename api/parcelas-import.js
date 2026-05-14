/**
 * Endpoint para receber parcelas em aberto via API (seguradoras que enviam dados por endpoint).
 *
 * POST https://jacy-crm.vercel.app/api/parcelas-import
 * Header: Authorization: Bearer <TOKEN_DA_SEGURADORA>
 * Content-Type: application/json
 *
 * Body esperado:
 * {
 *   "parcelas": [
 *     {
 *       "cliente":        "NOME DO CLIENTE",
 *       "apolice":        "12345",
 *       "numeroParcela":  "1",          // ou "parcela"
 *       "vencimento":     "2026-03-10", // YYYY-MM-DD ou DD/MM/YYYY
 *       "valor":          150.00,       // ou "valorParcela" ou "valor_parcela"
 *       "formaPagamento": "Boleto"      // opcional
 *     }
 *   ]
 * }
 *
 * Resposta de sucesso (200):
 * { "ok": true, "resumo": { "novas": N, "atualizadas": N, "ignoradas": N }, "linhasIgnoradas": [...] }
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  // CORS — permite chamadas de qualquer origem (seguradoras externas)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido. Use POST.' });
    return;
  }

  // ── Autenticação via Bearer token ──────────────────────────────────────────
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    res.status(401).json({
      error: 'Token de autenticação ausente.',
      instrucao: 'Envie o header: Authorization: Bearer <TOKEN>',
    });
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ error: 'Configuração de banco ausente no servidor.' });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Valida token no banco
  const { data: tokenData } = await supabase
    .from('parcelas_api_tokens')
    .select('id, nome, seguradora, ativo')
    .eq('token', token)
    .maybeSingle();

  if (!tokenData) {
    res.status(401).json({ error: 'Token inválido ou não encontrado.' });
    return;
  }
  if (!tokenData.ativo) {
    res.status(403).json({ error: 'Token desativado. Contate o administrador do sistema.' });
    return;
  }

  // ── Parse do payload ────────────────────────────────────────────────────────
  const body = req.body;
  if (!body || !Array.isArray(body.parcelas)) {
    res.status(400).json({
      error: 'Payload inválido.',
      formato_esperado: {
        parcelas: [
          {
            cliente: 'NOME DO CLIENTE',
            apolice: '12345',
            numeroParcela: '1',
            vencimento: '2026-03-10',
            valor: 150.00,
            formaPagamento: 'Boleto',
          },
        ],
      },
    });
    return;
  }

  const seguradora  = (tokenData.seguradora || tokenData.nome).trim();
  const dataImport  = new Date().toISOString().split('T')[0];
  const agora       = new Date().toISOString();
  const nomeOrigem  = `API: ${tokenData.nome}`;

  // Busca parcelas existentes desta seguradora
  const { data: existingRows } = await supabase
    .from('parcelas')
    .select('*')
    .eq('seguradora', seguradora);

  const existingMap = new Map();
  (existingRows ?? []).forEach(p => {
    existingMap.set(`${p.apolice}_${p.numero_parcela}`, p);
  });

  const toUpsert = [];
  let totalNovas = 0, totalAtualizadas = 0;
  const linhasIgnoradas = [];

  body.parcelas.forEach((item, idx) => {
    const linha         = idx + 1;
    const nomeCliente   = String(item.cliente ?? item.nome_cliente ?? '').trim();
    const apolice       = String(item.apolice ?? '').trim();
    const numeroParcela = String(item.numeroParcela ?? item.parcela ?? item.numero_parcela ?? '').trim();
    const vencimento    = parseDateFlexivel(item.vencimento ?? item.data_vencimento ?? '');
    const valorParcela  = parseFloat(item.valor ?? item.valorParcela ?? item.valor_parcela ?? 0) || 0;
    const formaPagamento = String(item.formaPagamento ?? item.forma_pagamento ?? '').trim();

    if (!nomeCliente)   { linhasIgnoradas.push({ linha, motivo: 'Campo "cliente" ausente' }); return; }
    if (!apolice)       { linhasIgnoradas.push({ linha, motivo: `${nomeCliente} — Campo "apolice" ausente` }); return; }
    if (!numeroParcela) { linhasIgnoradas.push({ linha, motivo: `${nomeCliente} — Campo "numeroParcela" ausente` }); return; }
    if (!vencimento)    { linhasIgnoradas.push({ linha, motivo: `${nomeCliente} — "vencimento" inválido (use YYYY-MM-DD ou DD/MM/YYYY)` }); return; }

    const chave    = `${apolice}_${numeroParcela}`;
    const existing = existingMap.get(chave);

    if (existing) {
      const logAtualiz = {
        id: crypto.randomUUID(), data: agora, autor: 'Sistema',
        tipo: 'importacao',
        descricao: `Dados atualizados via API: ${nomeOrigem}`,
      };
      toUpsert.push({
        ...existing,
        nome_cliente:       nomeCliente,
        apolice,
        numero_parcela:     numeroParcela,
        vencimento,
        valor_parcela:      valorParcela,
        forma_pagamento:    formaPagamento || existing.forma_pagamento,
        ultima_atualizacao: dataImport,
        atualizado_em:      agora,
        logs: [...(existing.logs ?? []), logAtualiz],
      });
      totalAtualizadas++;
    } else {
      const id = crypto.randomUUID();
      const logImport = {
        id: crypto.randomUUID(), data: agora, autor: 'Sistema',
        tipo: 'importacao',
        descricao: `Parcela importada via API: ${nomeOrigem}`,
      };
      toUpsert.push({
        id,
        chave_unica:          chave,
        primeira_atualizacao: dataImport,
        ultima_atualizacao:   dataImport,
        nome_cliente:         nomeCliente,
        apolice,
        numero_parcela:       numeroParcela,
        vencimento,
        valor_parcela:        valorParcela,
        seguradora,
        forma_pagamento:      formaPagamento,
        status:               'importada',
        observacoes:          [],
        logs:                 [logImport],
        criado_em:            agora,
        atualizado_em:        agora,
      });
      totalNovas++;
    }
  });

  // Persiste parcelas
  if (toUpsert.length > 0) {
    const { error: upsertError } = await supabase.from('parcelas').upsert(toUpsert);
    if (upsertError) {
      console.error('[parcelas-import] upsert error:', upsertError.message);
      res.status(500).json({ error: `Erro ao salvar parcelas: ${upsertError.message}` });
      return;
    }
  }

  // Registra no histórico de importações
  await supabase.from('importacoes_parcelas').insert({
    id:                       crypto.randomUUID(),
    nome_arquivo:             `${nomeOrigem} — ${dataImport}`,
    data_import:              dataImport,
    seguradoras_consideradas: [seguradora],
    total_importadas:         totalNovas + totalAtualizadas,
    total_novas:              totalNovas,
    total_atualizadas:        totalAtualizadas,
    total_baixadas:           0,
    total_ignoradas:          linhasIgnoradas.length,
    linhas_ignoradas:         linhasIgnoradas,
    criado_em:                agora,
  });

  // Atualiza last_used_at no token
  await supabase
    .from('parcelas_api_tokens')
    .update({ last_used_at: agora })
    .eq('id', tokenData.id);

  res.status(200).json({
    ok: true,
    resumo: { novas: totalNovas, atualizadas: totalAtualizadas, ignoradas: linhasIgnoradas.length },
    linhasIgnoradas,
  });
}

/** Aceita YYYY-MM-DD ou DD/MM/YYYY */
function parseDateFlexivel(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
