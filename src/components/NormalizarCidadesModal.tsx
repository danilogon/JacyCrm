/**
 * Modal de Normalização de Cidades
 *
 * Fase 1 — Normalizações automáticas (sem divergência semântica):
 *   Agrupa nomes que, após remoção de acentos / apóstrofes / variação de caixa,
 *   ficam idênticos. Ex: "AMERICANA" = "Americana" = "americana".
 *   Sugere o nome canônico do IBGE quando há correspondência exata normalizada.
 *
 * Fase 2 — Possíveis duplicatas (requer revisão):
 *   Detecta pares de nomes normalizados com Levenshtein ≤ 3 (ou ≤ 20% do maior).
 *   Ex: "santa barbara do oeste" ≈ "santa barbara doeste".
 *   Sugere o nome IBGE para cada opção quando encontrado.
 *
 * Fase 3 — Cidades não reconhecidas pelo IBGE:
 *   Lista cidades cujo normKey não possui correspondência exata no índice IBGE.
 *   Exibe sugestão automática (cidade IBGE mais próxima por Levenshtein + prefixo)
 *   e permite digitar a correção manualmente.
 *
 * Lógica de sugestão do nome canônico:
 *   1. Busca no IBGE pelo normKey exato (match sem acento/case/pontuação).
 *   2. Se o cliente tiver UF preenchida, prefere a cidade daquele estado.
 *   3. Se não houver match IBGE exato, usa Title Case do nome mais frequente.
 */

import { useState, useMemo } from 'react';
import { X, MapPin, CheckCircle2, AlertTriangle, RefreshCw, AlertCircle } from 'lucide-react';
import type { Cliente } from '../types';
import { MUNICIPIOS_BR } from '../data/municipiosBrasil';

// ─── Utilitários ─────────────────────────────────────────────────────────────

const CONECTORES = new Set(['de', 'do', 'da', 'das', 'dos', 'e', 'em', 'a', 'o', 'na', 'no', 'nas', 'nos']);

/** Converte para Title Case preservando conectores em minúsculas */
export function toTitleCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word, i) =>
      i === 0 || !CONECTORES.has(word)
        ? word.charAt(0).toUpperCase() + word.slice(1)
        : word
    )
    .join(' ');
}

/** Chave de normalização: sem acentos, apóstrofes, hifens; lowercase; espaços colapsados */
export function normKey(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')         // remove diacríticos
    .replace(/['''`´""]/g, '')      // apóstrofes e aspas
    .replace(/[-–—]/g, ' ')         // hifens → espaço
    .replace(/\./g, '')             // pontos
    .replace(/\s+/g, ' ')           // colapsa espaços
    .trim();
}

/** Distância de Levenshtein entre duas strings */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    prev.splice(0, prev.length, ...curr);
  }
  return curr[b.length];
}

// ─── Índice IBGE ─────────────────────────────────────────────────────────────
// Construído uma vez no nível do módulo → lookup O(1) por normKey.

const IBGE_BY_NORM = new Map<string, { nome: string; uf: string }[]>();
for (const [uf, cidades] of Object.entries(MUNICIPIOS_BR)) {
  for (const nome of cidades) {
    const k = normKey(nome);
    if (!IBGE_BY_NORM.has(k)) IBGE_BY_NORM.set(k, []);
    IBGE_BY_NORM.get(k)!.push({ nome, uf });
  }
}

/** Índice por prefixo de 3 chars → lista de nomes canônicos IBGE (busca rápida para sugestões) */
const IBGE_BY_PREFIX3 = new Map<string, string[]>();
for (const [uf, cidades] of Object.entries(MUNICIPIOS_BR)) {
  for (const nome of cidades) {
    const k = normKey(nome);
    if (k.length >= 2) {
      const p = k.substring(0, Math.min(3, k.length));
      if (!IBGE_BY_PREFIX3.has(p)) IBGE_BY_PREFIX3.set(p, []);
      IBGE_BY_PREFIX3.get(p)!.push(nome);
    }
    void uf;
  }
}

/**
 * Retorna o nome canônico do IBGE para um dado nome de cidade.
 * Prefere o município do estado informado quando há homônimos.
 * Retorna null se não houver correspondência exata normalizada.
 */
function ibgeCanonical(name: string, preferredUf?: string): string | null {
  if (!name.trim()) return null;
  const k = normKey(name);
  const matches = IBGE_BY_NORM.get(k);
  if (!matches?.length) return null;
  if (preferredUf) {
    const inUf = matches.find(m => m.uf === preferredUf);
    if (inUf) return inUf.nome;
  }
  return matches[0].nome; // primeiro estado alfabético como fallback
}

/**
 * Para cidades sem match exato no IBGE, tenta encontrar a mais próxima por Levenshtein.
 * Usa índice de prefixo para limitar candidatos e manter performance.
 */
function sugerirIbgeProximo(nome: string, uf?: string): string | null {
  const k = normKey(nome);
  if (!k || k.length < 2) return null;
  if (IBGE_BY_NORM.has(k)) return null; // já tem match exato

  const p3 = k.substring(0, Math.min(3, k.length));
  const p2 = k.substring(0, Math.min(2, k.length));

  // Coleta candidatos: UF prioritária + prefixo 3 chars + prefixo 2 chars
  const vistos = new Set<string>();
  const candidatos: string[] = [];

  const adicionar = (nome: string) => {
    if (!vistos.has(nome)) { vistos.add(nome); candidatos.push(nome); }
  };

  // 1. Dentro da UF (se informada)
  if (uf && MUNICIPIOS_BR[uf]) {
    for (const c of MUNICIPIOS_BR[uf]) {
      const ck = normKey(c);
      if (ck.startsWith(p2)) adicionar(c);
    }
  }

  // 2. Por prefixo de 3 letras
  for (const c of (IBGE_BY_PREFIX3.get(p3) ?? [])) adicionar(c);

  // 3. Se poucos candidatos, expandir para prefixo de 2 letras
  if (candidatos.length < 8) {
    for (const [pfx, names] of IBGE_BY_PREFIX3) {
      if (pfx.startsWith(p2)) names.forEach(adicionar);
    }
  }

  if (candidatos.length === 0) return null;

  let melhorDist = Infinity;
  let melhorNome: string | null = null;

  for (const c of candidatos) {
    const dist = levenshtein(k, normKey(c));
    if (dist < melhorDist) {
      melhorDist = dist;
      melhorNome = c;
    }
  }

  // Só sugere se a distância for razoável
  const limiar = Math.max(3, Math.floor(k.length * 0.3));
  return melhorNome && melhorDist <= limiar ? melhorNome : null;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface GrupoExato {
  key: string;
  variantes: string[];   // nomes originais distintos
  canonico: string;      // nome proposto (editável)
  ibgeSugestao: string | null; // nome exato do IBGE (se encontrado)
  total: number;
}

interface GrupoProximo {
  id: string;
  nomes: string[];       // nomes canônicos dos subgrupos (após fase 1)
  canonico: string;      // nome proposto (editável)
  ibgeSugestao: string | null;
  total: number;
  ignorado?: boolean;
}

interface GrupoForaIbge {
  cidadeOriginal: string; // nome exato como está no banco
  uf: string;             // UF mais comum para esta cidade
  total: number;          // qtd de clientes com esta cidade
  correcao: string;       // nome editável pelo usuário
  sugestaoIbge: string | null; // cidade IBGE mais próxima (pode ser null)
  ignorado?: boolean;
}

interface Props {
  clientes: Cliente[];
  onConfirmar: (mapaSubstituicoes: Map<string, string>) => void;
  onFechar: () => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function NormalizarCidadesModal({ clientes, onConfirmar, onFechar }: Props) {

  // ── Pré-computa UF mais comum por normKey ────────────────────────────────
  const ufPorKey = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      const uf  = (c.uf ?? '').trim().toUpperCase();
      if (!raw || !uf) continue;
      const k = normKey(raw);
      if (!map.has(k)) map.set(k, new Map());
      map.get(k)!.set(uf, (map.get(k)!.get(uf) ?? 0) + 1);
    }
    const result = new Map<string, string>();
    map.forEach((ufMap, k) => {
      const top = [...ufMap.entries()].sort((a, b) => b[1] - a[1])[0];
      if (top) result.set(k, top[0]);
    });
    return result;
  }, [clientes]);

  // ── Fase 1: grupos exatos ────────────────────────────────────────────────
  const gruposExatos = useMemo<GrupoExato[]>(() => {
    const map = new Map<string, Map<string, number>>();
    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      if (!raw) continue;
      const k = normKey(raw);
      if (!map.has(k)) map.set(k, new Map());
      map.get(k)!.set(raw, (map.get(k)!.get(raw) ?? 0) + 1);
    }
    const grupos: GrupoExato[] = [];
    map.forEach((variantes, key) => {
      if (variantes.size < 2) return;
      const maisFrequente = [...variantes.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const prefUf = ufPorKey.get(key);
      const ibge   = ibgeCanonical(maisFrequente, prefUf);
      grupos.push({
        key,
        variantes: [...variantes.keys()],
        canonico: ibge ?? toTitleCase(maisFrequente),
        ibgeSugestao: ibge,
        total: [...variantes.values()].reduce((a, b) => a + b, 0),
      });
    });
    return grupos.sort((a, b) => b.total - a.total);
  }, [clientes, ufPorKey]);

  // ── Mapa fase 1: nome original → canônico ───────────────────────────────
  const mapaFase1 = useMemo(() => {
    const map2 = new Map<string, string>();
    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      if (!raw) continue;
      const k = normKey(raw);
      if (!map2.has(k)) {
        const prefUf = ufPorKey.get(k);
        map2.set(k, ibgeCanonical(raw, prefUf) ?? toTitleCase(raw));
      }
    }
    for (const g of gruposExatos) map2.set(g.key, g.canonico);

    const m = new Map<string, string>();
    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      if (!raw) continue;
      m.set(raw, map2.get(normKey(raw)) ?? toTitleCase(raw));
    }
    return m;
  }, [clientes, gruposExatos, ufPorKey]);

  // ── Fase 2: pares próximos ──────────────────────────────────────────────
  const gruposProximos = useMemo<GrupoProximo[]>(() => {
    const canonicos = new Map<string, number>();
    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      if (!raw) continue;
      const can = mapaFase1.get(raw) ?? toTitleCase(raw);
      canonicos.set(can, (canonicos.get(can) ?? 0) + 1);
    }
    const nomes = [...canonicos.keys()];
    const visitados = new Set<string>();
    const grupos: GrupoProximo[] = [];

    for (let i = 0; i < nomes.length; i++) {
      if (visitados.has(nomes[i])) continue;
      const a = normKey(nomes[i]);
      const grupo = [nomes[i]];

      for (let j = i + 1; j < nomes.length; j++) {
        if (visitados.has(nomes[j])) continue;
        const b = normKey(nomes[j]);
        const dist = levenshtein(a, b);
        const maxLen = Math.max(a.length, b.length);
        if (dist > 0 && dist <= Math.max(3, Math.floor(maxLen * 0.2))) {
          grupo.push(nomes[j]);
        }
      }

      if (grupo.length > 1) {
        grupo.forEach(n => visitados.add(n));
        const ibgeMatches = grupo
          .map(nome => {
            const k = normKey(nome);
            const prefUf = ufPorKey.get(k);
            return ibgeCanonical(nome, prefUf);
          })
          .filter((v): v is string => v !== null);

        const ibgeUnico = ibgeMatches.length > 0 && new Set(ibgeMatches).size === 1
          ? ibgeMatches[0]
          : null;

        const maisFrequente = [...grupo].sort(
          (x, y) => (canonicos.get(y) ?? 0) - (canonicos.get(x) ?? 0)
        )[0];
        const total = grupo.reduce((s, n) => s + (canonicos.get(n) ?? 0), 0);

        grupos.push({
          id: grupo.join('|'),
          nomes: grupo,
          canonico: ibgeUnico ?? maisFrequente,
          ibgeSugestao: ibgeUnico,
          total,
        });
      }
    }
    return grupos.sort((a, b) => b.total - a.total);
  }, [clientes, mapaFase1, ufPorKey]);

  // ── Fase 3: cidades fora do IBGE ────────────────────────────────────────
  const gruposForaIbge = useMemo<GrupoForaIbge[]>(() => {
    // Agrupa clientes por cidade original
    const map = new Map<string, { count: number; ufs: Map<string, number> }>();

    for (const c of clientes) {
      const cidade = (c.cidade ?? '').trim();
      const uf     = (c.uf ?? '').trim().toUpperCase();
      if (!cidade) continue;

      const k = normKey(cidade);
      // Ignora se já tem match exato no IBGE
      if (IBGE_BY_NORM.has(k)) continue;

      if (!map.has(cidade)) map.set(cidade, { count: 0, ufs: new Map() });
      const entry = map.get(cidade)!;
      entry.count++;
      if (uf) entry.ufs.set(uf, (entry.ufs.get(uf) ?? 0) + 1);
    }

    return [...map.entries()]
      .map(([cidade, { count, ufs }]) => {
        const ufMaisComum = [...ufs.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        const sugestao    = sugerirIbgeProximo(cidade, ufMaisComum);
        return {
          cidadeOriginal: cidade,
          uf: ufMaisComum,
          total: count,
          correcao: sugestao ?? cidade,
          sugestaoIbge: sugestao,
        } satisfies GrupoForaIbge;
      })
      .sort((a, b) => b.total - a.total);
  }, [clientes]);

  // ── Estado editável ──────────────────────────────────────────────────────
  const [exatos,    setExatos]    = useState<GrupoExato[]>(() => gruposExatos);
  const [proximos,  setProximos]  = useState<GrupoProximo[]>(() => gruposProximos);
  const [foraIbge,  setForaIbge]  = useState<GrupoForaIbge[]>(() => gruposForaIbge);
  const [salvando,  setSalvando]  = useState(false);

  const totalAfetadosExatos   = exatos.reduce((s, g) => s + g.total, 0);
  const totalAfetadosProximos = proximos.filter(g => !g.ignorado).reduce((s, g) => s + g.total, 0);
  const foraIbgeAtivos        = foraIbge.filter(g => !g.ignorado);
  const totalAfetadosForaIbge = foraIbgeAtivos.reduce((s, g) => s + g.total, 0);

  // ── Aplicar ──────────────────────────────────────────────────────────────
  function aplicar() {
    setSalvando(true);
    const mapa = new Map<string, string>();

    // Fase 1 editada → canônico por variante
    const mapaEditado = new Map<string, string>();
    for (const g of exatos) {
      for (const v of g.variantes) mapaEditado.set(v, g.canonico);
    }

    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      if (!raw) continue;
      const k = normKey(raw);
      const prefUf = ufPorKey.get(k);
      const pos1 = mapaEditado.has(raw)
        ? mapaEditado.get(raw)!
        : (ibgeCanonical(raw, prefUf) ?? toTitleCase(raw));
      mapa.set(raw, pos1);
    }

    // Fase 2 → substitui nomes canônicos pelos do grupo escolhido
    for (const g of proximos) {
      if (g.ignorado) continue;
      for (const nome of g.nomes) {
        if (nome !== g.canonico) {
          for (const [raw, can] of mapa.entries()) {
            if (can === nome) mapa.set(raw, g.canonico);
          }
        }
      }
    }

    // Fase 3 → corrige cidades fora do IBGE
    for (const g of foraIbge) {
      if (g.ignorado) continue;
      const correcao = g.correcao.trim();
      if (correcao && correcao !== g.cidadeOriginal) {
        mapa.set(g.cidadeOriginal, correcao);
      }
    }

    onConfirmar(mapa);
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-blue-600" />
            <h2 className="font-bold text-gray-900 text-lg">Normalizar Cidades</h2>
          </div>
          <button onClick={onFechar} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-6">

          {/* Resumo — 4 cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <div className="text-2xl font-bold text-blue-700">{clientes.length}</div>
              <div className="text-xs text-blue-600 mt-0.5">clientes</div>
            </div>
            <div className={`border rounded-lg p-3 ${exatos.length > 0 ? 'bg-amber-50 border-amber-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className={`text-2xl font-bold ${exatos.length > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{exatos.length}</div>
              <div className={`text-xs mt-0.5 ${exatos.length > 0 ? 'text-amber-600' : 'text-gray-400'}`}>grupos exatos</div>
            </div>
            <div className={`border rounded-lg p-3 ${proximos.filter(g => !g.ignorado).length > 0 ? 'bg-orange-50 border-orange-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className={`text-2xl font-bold ${proximos.filter(g => !g.ignorado).length > 0 ? 'text-orange-700' : 'text-gray-400'}`}>
                {proximos.filter(g => !g.ignorado).length}
              </div>
              <div className={`text-xs mt-0.5 ${proximos.filter(g => !g.ignorado).length > 0 ? 'text-orange-600' : 'text-gray-400'}`}>possíveis duplicatas</div>
            </div>
            <div className={`border rounded-lg p-3 ${foraIbgeAtivos.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
              <div className={`text-2xl font-bold ${foraIbgeAtivos.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>
                {foraIbgeAtivos.length}
              </div>
              <div className={`text-xs mt-0.5 ${foraIbgeAtivos.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>fora do IBGE</div>
            </div>
          </div>

          {/* ── Fase 1: Normalizações automáticas ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={16} className="text-green-600" />
              <h3 className="font-semibold text-gray-800 text-sm">
                Normalizações automáticas
                <span className="ml-1.5 text-gray-400 font-normal">
                  ({exatos.length} grupos · {totalAfetadosExatos} clientes)
                </span>
              </h3>
            </div>

            {exatos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                Nenhuma variação de caixa ou acento encontrada.
              </p>
            ) : (
              <div className="space-y-2">
                {exatos.map((g, idx) => (
                  <div key={g.key} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1.5">
                      Variantes:{' '}
                      {g.variantes.map(v => (
                        <span key={v} className="inline-block bg-white border border-gray-200 rounded px-1 py-0.5 text-xs font-mono mr-1">{v}</span>
                      ))}
                      <span className="text-gray-400">({g.total} cliente{g.total !== 1 ? 's' : ''})</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500 shrink-0">→ unificar em:</span>
                      <input
                        value={g.canonico}
                        onChange={e => setExatos(prev => prev.map((x, i) => i === idx ? { ...x, canonico: e.target.value } : x))}
                        className="flex-1 min-w-[160px] px-2 py-1 border border-amber-300 rounded text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {g.ibgeSugestao && g.ibgeSugestao !== g.canonico && (
                        <button
                          onClick={() => setExatos(prev => prev.map((x, i) => i === idx ? { ...x, canonico: g.ibgeSugestao! } : x))}
                          className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded hover:bg-blue-100"
                          title="Usar nome exato do IBGE"
                        >
                          IBGE: <strong>{g.ibgeSugestao}</strong>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Fase 2: Possíveis duplicatas ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-orange-500" />
              <h3 className="font-semibold text-gray-800 text-sm">
                Possíveis duplicatas
                <span className="ml-1.5 text-gray-400 font-normal">
                  ({proximos.filter(g => !g.ignorado).length} grupos · {totalAfetadosProximos} clientes)
                </span>
              </h3>
            </div>

            {proximos.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                Nenhuma duplicata detectada.
              </p>
            ) : (
              <div className="space-y-2">
                {proximos.map((g, idx) => (
                  <div
                    key={g.id}
                    className={`border rounded-lg p-3 ${g.ignorado ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-orange-200 bg-orange-50'}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                          {g.nomes.map(n => (
                            <span key={n} className={`inline-block border rounded px-1.5 py-0.5 text-xs font-mono ${n === g.canonico ? 'bg-white border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600'}`}>
                              {n}
                            </span>
                          ))}
                          <span className="text-xs text-gray-400">({g.total} cliente{g.total !== 1 ? 's' : ''})</span>
                          {g.ibgeSugestao && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded">
                              IBGE: <strong>{g.ibgeSugestao}</strong>
                            </span>
                          )}
                        </div>

                        {!g.ignorado && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500 shrink-0">→ unificar em:</span>
                            <select
                              value={g.canonico}
                              onChange={e => setProximos(prev => prev.map((x, i) => i === idx ? { ...x, canonico: e.target.value } : x))}
                              className="flex-1 min-w-[140px] px-2 py-1 border border-orange-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              {g.ibgeSugestao && !g.nomes.includes(g.ibgeSugestao) && (
                                <option value={g.ibgeSugestao}>★ {g.ibgeSugestao} (IBGE)</option>
                              )}
                              {g.nomes.map(n => (
                                <option key={n} value={n}>
                                  {n}{g.ibgeSugestao === n ? ' ★ IBGE' : ''}
                                </option>
                              ))}
                            </select>
                            <input
                              placeholder="ou digitar..."
                              className="w-36 px-2 py-1 border border-orange-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              onBlur={e => {
                                if (e.target.value.trim()) {
                                  setProximos(prev => prev.map((x, i) => i === idx ? { ...x, canonico: e.target.value.trim() } : x));
                                  e.target.value = '';
                                }
                              }}
                            />
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setProximos(prev => prev.map((x, i) => i === idx ? { ...x, ignorado: !x.ignorado } : x))}
                        className={`shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors ${g.ignorado ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                      >
                        {g.ignorado ? 'Restaurar' : 'Ignorar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Fase 3: Cidades fora do IBGE ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle size={16} className="text-red-500" />
              <h3 className="font-semibold text-gray-800 text-sm">
                Cidades não reconhecidas pelo IBGE
                <span className="ml-1.5 text-gray-400 font-normal">
                  ({foraIbgeAtivos.length} cidade{foraIbgeAtivos.length !== 1 ? 's' : ''} · {totalAfetadosForaIbge} cliente{totalAfetadosForaIbge !== 1 ? 's' : ''})
                </span>
              </h3>
            </div>

            {foraIbge.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                Todas as cidades foram encontradas no IBGE. ✓
              </p>
            ) : (
              <div className="space-y-2">
                {foraIbge.map((g, idx) => (
                  <div
                    key={g.cidadeOriginal}
                    className={`border rounded-lg p-3 ${g.ignorado ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-red-200 bg-red-50'}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        {/* Linha superior: cidade original + UF + contagem */}
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="inline-block bg-white border border-red-300 rounded px-1.5 py-0.5 text-xs font-mono text-red-700 font-semibold">
                            {g.cidadeOriginal}
                          </span>
                          {g.uf && (
                            <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded px-1.5 py-0.5">
                              {g.uf}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            ({g.total} cliente{g.total !== 1 ? 's' : ''})
                          </span>
                          {g.sugestaoIbge && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded">
                              IBGE: <strong>{g.sugestaoIbge}</strong>
                            </span>
                          )}
                        </div>

                        {/* Linha inferior: campo de correção */}
                        {!g.ignorado && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500 shrink-0">→ corrigir para:</span>
                            <input
                              value={g.correcao}
                              onChange={e => setForaIbge(prev =>
                                prev.map((x, i) => i === idx ? { ...x, correcao: e.target.value } : x)
                              )}
                              className="flex-1 min-w-[160px] px-2 py-1 border border-red-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Nome correto da cidade..."
                            />
                            {g.sugestaoIbge && g.sugestaoIbge !== g.correcao && (
                              <button
                                onClick={() => setForaIbge(prev =>
                                  prev.map((x, i) => i === idx ? { ...x, correcao: g.sugestaoIbge! } : x)
                                )}
                                className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 border border-blue-200 text-blue-700 rounded hover:bg-blue-100 whitespace-nowrap"
                                title="Usar sugestão do IBGE"
                              >
                                Usar: <strong>{g.sugestaoIbge}</strong>
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => setForaIbge(prev =>
                          prev.map((x, i) => i === idx ? { ...x, ignorado: !x.ignorado } : x)
                        )}
                        className={`shrink-0 px-2 py-1 rounded text-xs font-medium transition-colors ${g.ignorado ? 'bg-gray-200 text-gray-600 hover:bg-gray-300' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                      >
                        {g.ignorado ? 'Restaurar' : 'Ignorar'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
            <p className="font-medium">Normalização de caixa</p>
            <p className="text-xs mt-0.5 text-blue-600">
              Além dos grupos acima, <strong>todos</strong> os nomes de cidades serão corrigidos para
              o padrão IBGE quando houver correspondência (ex: "AMERICANA" → "Americana") e as UFs
              serão convertidas para maiúsculas (ex: "sp" → "SP").
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-200 shrink-0 bg-white rounded-b-xl">
          <p className="text-xs text-gray-500">
            {exatos.length + proximos.filter(g => !g.ignorado).length + foraIbgeAtivos.length === 0
              ? 'Apenas normalização de caixa/IBGE será aplicada.'
              : [
                  exatos.length > 0 && `${exatos.length} grupo${exatos.length !== 1 ? 's' : ''} exato${exatos.length !== 1 ? 's' : ''}`,
                  proximos.filter(g => !g.ignorado).length > 0 && `${proximos.filter(g => !g.ignorado).length} duplicata${proximos.filter(g => !g.ignorado).length !== 1 ? 's' : ''}`,
                  foraIbgeAtivos.length > 0 && `${foraIbgeAtivos.length} fora do IBGE`,
                ].filter(Boolean).join(' + ') + ' serão corrigidos.'
            }
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onFechar} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button
              onClick={aplicar}
              disabled={salvando}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60"
            >
              {salvando && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <RefreshCw size={14} />
              Aplicar Normalização
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
