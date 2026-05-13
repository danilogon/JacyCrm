/**
 * Camada de acesso ao banco de dados Supabase.
 *
 * Regras:
 * - Colunas no banco: snake_case
 * - Tipos TypeScript: camelCase
 * - Campos JSONB (observacoes, campos_customizados, etc.) são armazenados
 *   como JSON puro com as chaves já em camelCase — não são transformados.
 * - Apenas as chaves de primeiro nível da linha do banco são convertidas.
 */

import { supabase } from './supabase';
import type {
  Usuario, Renovacao, SeguroNovo, Prospeccao, Cliente,
  Seguradora, Ramo, FormaPagamento, ConfiguracoesMetas, MotivoPerda,
  CampoCustomizavel, ConfiguracaoEmpresa, TipoUsuario, Tarefa, OrigemProspeccao,
  ImportacaoLote, ModeloEmail, EmailDisparo, ConfigGatilho,
  Parcela, ImportacaoParcelas, RegraParcelaNegocio, AutomacaoParcela,
} from '../types';

// ─── Utilitários de conversão de chaves ──────────────────────

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c: string) => '_' + c.toLowerCase());
}

// Mapeamentos especiais para campos cujo nome camelCase não faz round-trip
// perfeito com a conversão automática (ex: siglas como "2FA").
const SNAKE_OVERRIDES: Record<string, string> = {
  exigir2FA: 'exigir_2fa',
};
const CAMEL_OVERRIDES: Record<string, string> = {
  exigir_2fa: 'exigir2FA',
};

/** Converte chaves de primeiro nível de snake_case → camelCase */
function rowToCamel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    out[CAMEL_OVERRIDES[k] ?? toCamel(k)] = row[k];
  }
  return out as T;
}

/** Converte chaves de primeiro nível de camelCase → snake_case */
function objToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    out[SNAKE_OVERRIDES[k] ?? toSnake(k)] = obj[k];
  }
  return out;
}

// ─── Valores padrão ──────────────────────────────────────────

const METAS_DEFAULT: ConfiguracoesMetas = { planosRenovacao: [], planosSeguroNovo: [] };
const EMPRESA_DEFAULT: ConfiguracaoEmpresa = {
  nome: 'SmartCor',
  logoUrl: '',
  corPrimaria: '#1e40af',
  corSecundaria: '#1d4ed8',
};

// ─── Paginação automática ─────────────────────────────────────
//
// O Supabase/PostgREST limita por padrão a 1.000 linhas por request.
// Para tabelas que crescem sem limite (clientes, renovacoes, etc.) usamos
// paginação automática: buscamos páginas de 1.000 até não haver mais dados.

const PAGE_SIZE = 1000;

type RawQueryFn = (
  rangeFrom: number,
  rangeTo: number,
) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

async function fetchPaginated<T>(queryFn: RawQueryFn): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFn(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    all.push(...(data as Record<string, unknown>[]).map(r => rowToCamel<T>(r)));
    if (data.length < PAGE_SIZE) break; // última página — encerra
    from += PAGE_SIZE;
  }
  return all;
}

// ─── Busca inicial (todos os dados de uma vez) ───────────────

export async function fetchAll() {
  // Tabelas pequenas (poucos registros) — uma única request cada.
  // Tabelas grandes (sem limite de crescimento) — paginação automática.
  // Ambos os grupos rodam em paralelo via Promise.all.
  const [
    r_usuarios,
    r_seguradoras,
    r_ramos,
    r_formas_pagamento,
    r_motivos,
    r_campos,
    r_metas,
    r_empresa,
    r_tipos,
    r_origens,
    r_importacoes,
    r_modelos_email,
    r_emails_disparo,
    r_config_gatilhos,
    r_imp_parcelas,
    r_regras_parcelas,
    r_automacoes_parcelas,
    // ── Tabelas grandes (paginadas) ──
    clientes,
    renovacoes,
    segurosNovos,
    prospeccoes,
    tarefas,
    parcelas,
  ] = await Promise.all([
    // ── Tabelas pequenas ──
    supabase.from('usuarios').select('*'),
    supabase.from('seguradoras').select('*'),
    supabase.from('ramos').select('*'),
    supabase.from('formas_pagamento').select('*').order('nome'),
    supabase.from('motivos_perda').select('*').order('ordem'),
    supabase.from('campos_customizaveis').select('*'),
    supabase.from('configuracoes_metas').select('*').eq('id', 1).maybeSingle(),
    supabase.from('configuracao_empresa').select('*').eq('id', 1).maybeSingle(),
    supabase.from('tipos_usuario').select('*'),
    supabase.from('origens_prospeccao').select('*').order('nome'),
    supabase.from('importacoes_lote').select('*'),
    supabase.from('modelos_email').select('*').order('criado_em', { ascending: false }),
    supabase.from('emails_disparo').select('*').order('criado_em', { ascending: false }),
    supabase.from('config_gatilhos').select('*').order('criado_em', { ascending: true }),
    supabase.from('importacoes_parcelas').select('*').order('criado_em', { ascending: false }),
    supabase.from('regras_parcelas').select('*').order('criado_em', { ascending: true }),
    supabase.from('automacoes_parcelas').select('*').order('prioridade', { ascending: true }),
    // ── Tabelas grandes (cada uma percorre todas as páginas internamente) ──
    fetchPaginated<Cliente>(
      (f, t) => supabase.from('clientes').select('*').range(f, t)),
    fetchPaginated<Renovacao>(
      (f, t) => supabase.from('renovacoes').select('*').range(f, t)),
    fetchPaginated<SeguroNovo>(
      (f, t) => supabase.from('seguros_novos').select('*').range(f, t)),
    fetchPaginated<Prospeccao>(
      (f, t) => supabase.from('prospeccoes').select('*').range(f, t)),
    fetchPaginated<Tarefa>(
      (f, t) => supabase.from('tarefas').select('*').range(f, t)),
    fetchPaginated<Parcela>(
      (f, t) => supabase.from('parcelas').select('*').order('vencimento').range(f, t)),
  ] as const);

  // Detecta erros nas tabelas pequenas (críticas)
  const erros = [
    r_usuarios, r_seguradoras, r_ramos, r_motivos, r_campos,
    r_tipos, r_origens,
  ].filter(r => r.error).map(r => r.error!.message);
  // Non-critical (tables may not exist yet): r_modelos_email, r_emails_disparo, r_config_gatilhos

  if (erros.length) {
    throw new Error(`Falha ao carregar dados: ${erros.join('; ')}`);
  }

  return {
    // Tabelas pequenas convertidas aqui
    usuarios:     (r_usuarios.data    || []).map(r => rowToCamel<Usuario>(r as Record<string, unknown>)),
    seguradoras:  (r_seguradoras.data || []).map(r => rowToCamel<Seguradora>(r as Record<string, unknown>)),
    ramos:        (r_ramos.data       || []).map(r => rowToCamel<Ramo>(r as Record<string, unknown>)),
    formasPagamento: r_formas_pagamento.error ? [] : (r_formas_pagamento.data || []).map(r => rowToCamel<FormaPagamento>(r as Record<string, unknown>)),
    motivos:      (r_motivos.data     || []).map(r => rowToCamel<MotivoPerda>(r as Record<string, unknown>)),
    campos:       (r_campos.data      || []).map(r => rowToCamel<CampoCustomizavel>(r as Record<string, unknown>)),
    tiposUsuario: (r_tipos.data       || []).map(r => rowToCamel<TipoUsuario>(r as Record<string, unknown>)),
    origensProspeccao: (r_origens.data || []).map(r => rowToCamel<OrigemProspeccao>(r as Record<string, unknown>)),
    importacoes:  (r_importacoes.data || []).map(r => rowToCamel<ImportacaoLote>(r as Record<string, unknown>)),
    modelosEmail: (r_modelos_email.data || []).map(r => rowToCamel<ModeloEmail>(r as Record<string, unknown>)),
    emailsDisparo: (r_emails_disparo.data || []).map(r => rowToCamel<EmailDisparo>(r as Record<string, unknown>)),
    configGatilhos: (r_config_gatilhos.data || []).map(r => rowToCamel<ConfigGatilho>(r as Record<string, unknown>)),
    importacoesParcelas: (r_imp_parcelas.data || []).map(r => rowToCamel<ImportacaoParcelas>(r as Record<string, unknown>)),
    regrasParcelas: (r_regras_parcelas.data || []).map(r => rowToCamel<RegraParcelaNegocio>(r as Record<string, unknown>)),
    automacoesParcelas: r_automacoes_parcelas.error ? [] : (r_automacoes_parcelas.data || []).map(r => rowToCamel<AutomacaoParcela>(r as Record<string, unknown>)),
    // Tabelas grandes já convertidas pelo fetchPaginated
    clientes,
    renovacoes,
    segurosNovos,
    prospeccoes,
    tarefas,
    parcelas,
    metas:    r_metas.data
      ? rowToCamel<ConfiguracoesMetas & { id: number }>(r_metas.data as Record<string, unknown>)
      : METAS_DEFAULT,
    empresa:  r_empresa.data
      ? rowToCamel<ConfiguracaoEmpresa & { id: number }>(r_empresa.data as Record<string, unknown>)
      : EMPRESA_DEFAULT,
  };
}

// ─── Helpers internos de upsert/delete ───────────────────────

async function upsertRows(table: string, items: Record<string, unknown>[], silent = false) {
  if (!items.length) return;
  const { error } = await supabase.from(table).upsert(items.map(objToSnake));
  if (error) {
    console.error(`[db] upsert ${table}:`, error);
    if (!silent) {
      // Mostra alerta visível para que erros de persistência não passem despercebidos
      alert(`Erro ao salvar dados (${table}): ${error.message}\n\nOs dados podem não ter sido salvos. Verifique a conexão ou contate o suporte.`);
    }
    throw new Error(`[db] upsert ${table}: ${error.message}`);
  }
}

async function deleteRows(table: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) {
    console.error(`[db] delete ${table}:`, error);
    alert(`Erro ao excluir dados (${table}): ${error.message}`);
    throw new Error(`[db] delete ${table}: ${error.message}`);
  }
}

// ─── CRUD tipado ─────────────────────────────────────────────

export const db = {
  // Usuários
  upsertUsuarios:   (items: Usuario[])          => upsertRows('usuarios', items as unknown as Record<string, unknown>[]),
  deleteUsuarios:   (ids: string[])             => deleteRows('usuarios', ids),

  // Seguradoras
  upsertSeguradoras:(items: Seguradora[])       => upsertRows('seguradoras', items as unknown as Record<string, unknown>[]),
  deleteSeguradoras:(ids: string[])             => deleteRows('seguradoras', ids),

  // Ramos
  upsertRamos:      (items: Ramo[])             => upsertRows('ramos', items as unknown as Record<string, unknown>[]),
  deleteRamos:      (ids: string[])             => deleteRows('ramos', ids),

  // Formas de Pagamento
  upsertFormasPagamento: (items: FormaPagamento[]) => upsertRows('formas_pagamento', items as unknown as Record<string, unknown>[]),
  deleteFormasPagamento: (ids: string[])            => deleteRows('formas_pagamento', ids),

  // Motivos de perda
  upsertMotivos:    (items: MotivoPerda[])      => upsertRows('motivos_perda', items as unknown as Record<string, unknown>[]),
  deleteMotivos:    (ids: string[])             => deleteRows('motivos_perda', ids),

  // Campos customizáveis
  upsertCampos:     (items: CampoCustomizavel[])=> upsertRows('campos_customizaveis', items as unknown as Record<string, unknown>[]),
  deleteCampos:     (ids: string[])             => deleteRows('campos_customizaveis', ids),

  // Clientes — tolerante a colunas ausentes (ex: sexo adicionada depois)
  upsertClientes: async (items: Cliente[]) => {
    try {
      // Primeira tentativa silenciosa: se a coluna 'sexo' ainda não existe no DB,
      // não mostra alert — retenta automaticamente sem o campo.
      await upsertRows('clientes', items as unknown as Record<string, unknown>[], true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('sexo') || msg.includes('schema cache')) {
        // Retenta sem o campo sexo e com alert normal em caso de nova falha
        const semSexo = items.map(({ sexo: _s, ...rest }) => rest);
        await upsertRows('clientes', semSexo as unknown as Record<string, unknown>[]);
      } else {
        // Outro erro: mostra alert e relança
        alert(`Erro ao salvar dados (clientes): ${msg}\n\nOs dados podem não ter sido salvos. Verifique a conexão ou contate o suporte.`);
        throw e;
      }
    }
  },
  deleteClientes:   (ids: string[])             => deleteRows('clientes', ids),

  // Renovações
  upsertRenovacoes: (items: Renovacao[])        => upsertRows('renovacoes', items as unknown as Record<string, unknown>[]),
  deleteRenovacoes: (ids: string[])             => deleteRows('renovacoes', ids),

  // Seguros Novos
  upsertSegurosNovos:(items: SeguroNovo[])      => upsertRows('seguros_novos', items as unknown as Record<string, unknown>[]),
  deleteSegurosNovos:(ids: string[])            => deleteRows('seguros_novos', ids),

  // Prospecções
  upsertProspeccoes:(items: Prospeccao[])       => upsertRows('prospeccoes', items as unknown as Record<string, unknown>[]),
  deleteProspeccoes:(ids: string[])             => deleteRows('prospeccoes', ids),

  // Tarefas
  upsertTarefas:    (items: Tarefa[])           => upsertRows('tarefas', items as unknown as Record<string, unknown>[]),
  deleteTarefas:    (ids: string[])             => deleteRows('tarefas', ids),

  // Tipos de usuário
  upsertTiposUsuario:(items: TipoUsuario[])     => upsertRows('tipos_usuario', items as unknown as Record<string, unknown>[]),
  deleteTiposUsuario:(ids: string[])            => deleteRows('tipos_usuario', ids),

  // Origens de Prospecção
  upsertOrigensProspeccao:(items: OrigemProspeccao[]) => upsertRows('origens_prospeccao', items as unknown as Record<string, unknown>[]),
  deleteOrigensProspeccao:(ids: string[])             => deleteRows('origens_prospeccao', ids),

  // Importações em lote
  upsertImportacoes: (items: ImportacaoLote[]) => upsertRows('importacoes_lote', items as unknown as Record<string, unknown>[]),
  deleteImportacoes: (ids: string[])           => deleteRows('importacoes_lote', ids),

  // Modelos de E-mail
  upsertModelosEmail: (items: ModeloEmail[]) => upsertRows('modelos_email', items as unknown as Record<string, unknown>[]),
  deleteModelosEmail: (ids: string[])        => deleteRows('modelos_email', ids),

  // Disparos de E-mail
  upsertEmailsDisparo: (items: EmailDisparo[]) => upsertRows('emails_disparo', items as unknown as Record<string, unknown>[]),
  deleteEmailsDisparo: (ids: string[])         => deleteRows('emails_disparo', ids),

  // Configuração de Gatilhos
  upsertConfigGatilhos: (items: ConfigGatilho[]) => upsertRows('config_gatilhos', items as unknown as Record<string, unknown>[]),
  deleteConfigGatilhos: (ids: string[])           => deleteRows('config_gatilhos', ids),

  // Parcelas (Follow Up de Pagamentos)
  // Parcelas — tolerante a colunas ausentes no banco (retira automaticamente
  // qualquer coluna que o Supabase rejeitar com "schema cache" até conseguir salvar)
  upsertParcelas: async (items: Parcela[]) => {
    // Colunas opcionais que podem ainda não existir no banco legado
    const COLS_OPCIONAIS = ['ramo', 'prorrogada', 'dataProrrogacao', 'dataLimite', 'logs', 'atualizadoEm'];
    let rows = items as unknown as Record<string, unknown>[];
    const removidas: string[] = [];

    for (let tentativa = 0; tentativa <= COLS_OPCIONAIS.length; tentativa++) {
      try {
        await upsertRows('parcelas', rows, true);
        return; // sucesso
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Extrai o nome da coluna que o Supabase não reconhece
        const match = msg.match(/Could not find the '(\w+)' column/);
        if (match) {
          // Converte snake_case → camelCase para remover do objeto
          const colSnake = match[1];
          const colCamel = toCamel(colSnake);
          removidas.push(colCamel);
          rows = rows.map(r => {
            const c = { ...r };
            delete c[colCamel];
            delete c[colSnake];
            return c;
          });
          console.warn(`[db] coluna '${colSnake}' ausente no banco — removida e retentando. Execute a migração SQL.`);
          continue;
        }
        // Erro não relacionado a coluna ausente
        alert(`Erro ao salvar dados (parcelas): ${msg}\n\nOs dados podem não ter sido salvos. Verifique a conexão ou contate o suporte.`);
        throw e;
      }
    }
  },
  deleteParcelas:           (ids: string[])                => deleteRows('parcelas', ids),
  upsertImportacoesParcelas:(items: ImportacaoParcelas[])  => upsertRows('importacoes_parcelas', items as unknown as Record<string, unknown>[]),
  deleteImportacoesParcelas:(ids: string[])                => deleteRows('importacoes_parcelas', ids),

  // Regras de Negócio para Parcelas
  upsertRegrasParcelas: (items: RegraParcelaNegocio[]) => upsertRows('regras_parcelas', items as unknown as Record<string, unknown>[]),
  deleteRegrasParcelas: (ids: string[])                => deleteRows('regras_parcelas', ids),

  // Automações de Parcelas — auto-retry removendo colunas ausentes no banco
  upsertAutomacoesParcelas: async (items: AutomacaoParcela[]) => {
    let rows = items as unknown as Record<string, unknown>[];
    for (let tentativa = 0; tentativa <= 10; tentativa++) {
      try {
        await upsertRows('automacoes_parcelas', rows, true);
        return;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Coluna ausente — remove e retenta (verificado antes do "tabela inexistente")
        const match = msg.match(/Could not find the '(\w+)' column/);
        // Tabela inexistente — orienta o usuário a rodar o SQL
        if (!match && msg.includes('does not exist') && msg.includes('automacoes_parcelas')) {
          alert('A tabela de automações não existe no banco. Execute o SQL de criação no painel do Supabase e recarregue a página.');
          throw e;
        }
        if (match) {
          const col = match[1];
          const colCamel = toCamel(col);
          rows = rows.map(r => { const c = { ...r }; delete c[colCamel]; delete c[col]; return c; });
          console.warn(`[db] coluna '${col}' ausente em automacoes_parcelas — removida. Execute a migração SQL.`);
          continue;
        }
        alert(`Erro ao salvar automações: ${msg}`);
        throw e;
      }
    }
  },
  deleteAutomacoesParcelas: (ids: string[]) => deleteRows('automacoes_parcelas', ids),

  // Configurações de metas (singleton id=1)
  upsertMetas: async (metas: ConfiguracoesMetas) => {
    const { error } = await supabase
      .from('configuracoes_metas')
      .upsert({ id: 1, ...objToSnake(metas as unknown as Record<string, unknown>) });
    if (error) {
      console.error('[db] upsert configuracoes_metas:', error.message);
      throw new Error(error.message);
    }
  },

  // Configuração da empresa (singleton id=1)
  upsertEmpresa: async (empresa: ConfiguracaoEmpresa) => {
    const { error } = await supabase
      .from('configuracao_empresa')
      .upsert({ id: 1, ...objToSnake(empresa as unknown as Record<string, unknown>) });
    if (error) {
      console.error('[db] upsert configuracao_empresa:', error.message);
      throw new Error(error.message);
    }
  },
};
