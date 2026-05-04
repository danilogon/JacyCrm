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
  Seguradora, Ramo, ConfiguracoesMetas, MotivoPerda,
  CampoCustomizavel, ConfiguracaoEmpresa, TipoUsuario, Tarefa,
} from '../types';

// ─── Utilitários de conversão de chaves ──────────────────────

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function toSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c: string) => '_' + c.toLowerCase());
}

/** Converte chaves de primeiro nível de snake_case → camelCase */
function rowToCamel<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    out[toCamel(k)] = row[k];
  }
  return out as T;
}

/** Converte chaves de primeiro nível de camelCase → snake_case */
function objToSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    out[toSnake(k)] = obj[k];
  }
  return out;
}

// ─── Valores padrão ──────────────────────────────────────────

const METAS_DEFAULT: ConfiguracoesMetas = { planosRenovacao: [], planosSeguroNovo: [] };
const EMPRESA_DEFAULT: ConfiguracaoEmpresa = {
  nome: 'Segura Mais',
  logoUrl: '',
  corPrimaria: '#1e40af',
  corSecundaria: '#1d4ed8',
};

// ─── Busca inicial (todos os dados de uma vez) ───────────────

export async function fetchAll() {
  const [
    r_usuarios,
    r_seguradoras,
    r_ramos,
    r_motivos,
    r_campos,
    r_metas,
    r_empresa,
    r_clientes,
    r_renovacoes,
    r_sn,
    r_prosp,
    r_tarefas,
    r_tipos,
  ] = await Promise.all([
    supabase.from('usuarios').select('*'),
    supabase.from('seguradoras').select('*'),
    supabase.from('ramos').select('*'),
    supabase.from('motivos_perda').select('*').order('ordem'),
    supabase.from('campos_customizaveis').select('*'),
    supabase.from('configuracoes_metas').select('*').eq('id', 1).maybeSingle(),
    supabase.from('configuracao_empresa').select('*').eq('id', 1).maybeSingle(),
    supabase.from('clientes').select('*'),
    supabase.from('renovacoes').select('*'),
    supabase.from('seguros_novos').select('*'),
    supabase.from('prospeccoes').select('*'),
    supabase.from('tarefas').select('*'),
    supabase.from('tipos_usuario').select('*'),
  ]);

  // Detecta erros críticos
  const erros = [
    r_usuarios, r_seguradoras, r_ramos, r_motivos, r_campos,
    r_clientes, r_renovacoes, r_sn, r_prosp, r_tarefas, r_tipos,
  ].filter(r => r.error).map(r => r.error!.message);

  if (erros.length) {
    throw new Error(`Falha ao carregar dados: ${erros.join('; ')}`);
  }

  return {
    usuarios:     (r_usuarios.data    || []).map(r => rowToCamel<Usuario>(r as Record<string, unknown>)),
    seguradoras:  (r_seguradoras.data || []).map(r => rowToCamel<Seguradora>(r as Record<string, unknown>)),
    ramos:        (r_ramos.data       || []).map(r => rowToCamel<Ramo>(r as Record<string, unknown>)),
    motivos:      (r_motivos.data     || []).map(r => rowToCamel<MotivoPerda>(r as Record<string, unknown>)),
    campos:       (r_campos.data      || []).map(r => rowToCamel<CampoCustomizavel>(r as Record<string, unknown>)),
    clientes:     (r_clientes.data    || []).map(r => rowToCamel<Cliente>(r as Record<string, unknown>)),
    renovacoes:   (r_renovacoes.data  || []).map(r => rowToCamel<Renovacao>(r as Record<string, unknown>)),
    segurosNovos: (r_sn.data          || []).map(r => rowToCamel<SeguroNovo>(r as Record<string, unknown>)),
    prospeccoes:  (r_prosp.data       || []).map(r => rowToCamel<Prospeccao>(r as Record<string, unknown>)),
    tarefas:      (r_tarefas.data     || []).map(r => rowToCamel<Tarefa>(r as Record<string, unknown>)),
    tiposUsuario: (r_tipos.data       || []).map(r => rowToCamel<TipoUsuario>(r as Record<string, unknown>)),
    metas:    r_metas.data
      ? rowToCamel<ConfiguracoesMetas & { id: number }>(r_metas.data as Record<string, unknown>)
      : METAS_DEFAULT,
    empresa:  r_empresa.data
      ? rowToCamel<ConfiguracaoEmpresa & { id: number }>(r_empresa.data as Record<string, unknown>)
      : EMPRESA_DEFAULT,
  };
}

// ─── Helpers internos de upsert/delete ───────────────────────

async function upsertRows(table: string, items: Record<string, unknown>[]) {
  if (!items.length) return;
  const { error } = await supabase.from(table).upsert(items.map(objToSnake));
  if (error) console.error(`[db] upsert ${table}:`, error.message);
}

async function deleteRows(table: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) console.error(`[db] delete ${table}:`, error.message);
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

  // Motivos de perda
  upsertMotivos:    (items: MotivoPerda[])      => upsertRows('motivos_perda', items as unknown as Record<string, unknown>[]),
  deleteMotivos:    (ids: string[])             => deleteRows('motivos_perda', ids),

  // Campos customizáveis
  upsertCampos:     (items: CampoCustomizavel[])=> upsertRows('campos_customizaveis', items as unknown as Record<string, unknown>[]),
  deleteCampos:     (ids: string[])             => deleteRows('campos_customizaveis', ids),

  // Clientes
  upsertClientes:   (items: Cliente[])          => upsertRows('clientes', items as unknown as Record<string, unknown>[]),
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
    if (error) console.error('[db] upsert configuracao_empresa:', error.message);
  },
};
