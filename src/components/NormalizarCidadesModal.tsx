/**
 * Modal de Normalização de Cidades
 *
 * Fase 1 — Normalizações automáticas (sem divergência semântica):
 *   Agrupa nomes que, após remoção de acentos / apóstrofes / variação de caixa,
 *   ficam idênticos. Ex: "AMERICANA" = "Americana" = "americana".
 *
 * Fase 2 — Possíveis duplicatas (requer revisão):
 *   Detecta pares de nomes normalizados com Levenshtein ≤ 3 (ou ≤ 20% do maior),
 *   que provavelmente representam o mesmo município.
 *   Ex: "santa barbara do oeste" ≈ "santa barbara doeste".
 *
 * Normalização do nome canônico:
 *   Title Case com conectores minúsculos: de do da das dos e em a o.
 *   UF: uppercase, trim.
 */

import { useState, useMemo } from 'react';
import { X, MapPin, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import type { Cliente } from '../types';

// ─── Utilitários ─────────────────────────────────────────────────────────────

const CONECTORES = new Set(['de', 'do', 'da', 'das', 'dos', 'e', 'em', 'a', 'o', 'na', 'no', 'nas', 'nos']);

/** Converte para Title Case preservando conectores em minúsculas */
function toTitleCase(str: string): string {
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
function normKey(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove diacríticos
    .replace(/['''`´""]/g, '')         // apóstrofes
    .replace(/[-–—]/g, ' ')            // hifens → espaço
    .replace(/\./g, '')                // pontos
    .replace(/\s+/g, ' ')             // colapsa espaços
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

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface GrupoExato {
  key: string;
  variantes: string[];   // nomes originais distintos
  canonico: string;      // nome proposto
  total: number;         // total de clientes afetados
}

interface GrupoProximo {
  id: string;
  nomes: string[];       // nomes canônicos dos subgrupos (após fase 1)
  canonico: string;      // nome proposto
  total: number;
  expandido?: boolean;
  ignorado?: boolean;
}

interface Props {
  clientes: Cliente[];
  onConfirmar: (mapaSubstituicoes: Map<string, string>) => void;
  onFechar: () => void;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function NormalizarCidadesModal({ clientes, onConfirmar, onFechar }: Props) {
  // ── Fase 1: grupos exatos ────────────────────────────────────────────────
  const gruposExatos = useMemo<GrupoExato[]>(() => {
    const map = new Map<string, Map<string, number>>(); // key → (nome original → count)
    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      if (!raw) continue;
      const k = normKey(raw);
      if (!map.has(k)) map.set(k, new Map());
      map.get(k)!.set(raw, (map.get(k)!.get(raw) ?? 0) + 1);
    }
    const grupos: GrupoExato[] = [];
    map.forEach((variantes, key) => {
      if (variantes.size < 2) return; // só mostra se tem variação
      // Escolhe como canônico o Title Case do nome mais frequente
      const maisFrequente = [...variantes.entries()].sort((a, b) => b[1] - a[1])[0][0];
      grupos.push({
        key,
        variantes: [...variantes.keys()],
        canonico: toTitleCase(maisFrequente),
        total: [...variantes.values()].reduce((a, b) => a + b, 0),
      });
    });
    return grupos.sort((a, b) => b.total - a.total);
  }, [clientes]);

  // ── Mapa fase 1: nome original → canônico após fase 1 ───────────────────
  const mapaFase1 = useMemo(() => {
    const m = new Map<string, string>();
    // Para todos os clientes, mesmo sem variação, propõe Title Case
    const map2 = new Map<string, string>(); // key → canonical
    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      if (!raw) continue;
      const k = normKey(raw);
      if (!map2.has(k)) map2.set(k, toTitleCase(raw));
    }
    // Sobrescreve com o escolhido nos grupos exatos (pode ser editado pelo usuário)
    for (const g of gruposExatos) map2.set(g.key, g.canonico);

    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      if (!raw) continue;
      const k = normKey(raw);
      m.set(raw, map2.get(k) ?? toTitleCase(raw));
    }
    return m;
  }, [clientes, gruposExatos]);

  // ── Fase 2: pares próximos ──────────────────────────────────────────────
  const gruposProximos = useMemo<GrupoProximo[]>(() => {
    // Junta todos os nomes canônicos únicos após fase 1
    const canonicos = new Map<string, number>(); // canônico → count de clientes
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
        // Canônico: o de maior contagem de clientes
        const maisFrequente = grupo.sort(
          (x, y) => (canonicos.get(y) ?? 0) - (canonicos.get(x) ?? 0)
        )[0];
        const total = grupo.reduce((s, n) => s + (canonicos.get(n) ?? 0), 0);
        grupos.push({
          id: grupo.join('|'),
          nomes: grupo,
          canonico: maisFrequente,
          total,
        });
      }
    }
    return grupos.sort((a, b) => b.total - a.total);
  }, [clientes, mapaFase1]);

  // ── Estado editável ──────────────────────────────────────────────────────
  const [exatos, setExatos] = useState<GrupoExato[]>(() => gruposExatos);
  const [proximos, setProximos] = useState<GrupoProximo[]>(() => gruposProximos);
  const [salvando, setSalvando] = useState(false);

  // recalcula quando as props de gruposExatos mudam (uma vez)
  // (useMemo roda na montagem; estados inicializados corretamente acima)

  const totalAfetadosExatos   = exatos.reduce((s, g) => s + g.total, 0);
  const totalAfetadosProximos = proximos.filter(g => !g.ignorado).reduce((s, g) => s + g.total, 0);

  // ── Aplicar ──────────────────────────────────────────────────────────────
  function aplicar() {
    setSalvando(true);
    const mapa = new Map<string, string>();

    // Fase 1: substitui todos os nomes (mesmo os sem variação → Title Case)
    // Usamos o mapaFase1, mas sobrescrevemos com o que o usuário editou
    const mapaEditado = new Map<string, string>();
    for (const g of exatos) {
      for (const v of g.variantes) mapaEditado.set(v, g.canonico);
    }

    for (const c of clientes) {
      const raw = (c.cidade ?? '').trim();
      if (!raw) continue;
      // Fase 1 editada
      const pos1 = mapaEditado.has(raw)
        ? mapaEditado.get(raw)!
        : toTitleCase(raw);
      mapa.set(raw, pos1);
    }

    // Fase 2: substitui para grupos próximos não ignorados
    for (const g of proximos) {
      if (g.ignorado) continue;
      for (const nome of g.nomes) {
        if (nome !== g.canonico) {
          // Todos os raws que apontavam para esse nome canônico agora apontam para o novo
          for (const [raw, can] of mapa.entries()) {
            if (can === nome) mapa.set(raw, g.canonico);
          }
        }
      }
    }

    onConfirmar(mapa);
  }

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

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3 text-center">
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

            {exatos.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                Nenhuma variação de caixa ou acento encontrada.
              </p>
            )}

            <div className="space-y-2">
              {exatos.map((g, idx) => (
                <div key={g.key} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                  <div className="flex items-start gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 mb-1">
                        Variantes: {g.variantes.map(v => (
                          <span key={v} className="inline-block bg-white border border-gray-200 rounded px-1 py-0.5 text-xs font-mono mr-1">{v}</span>
                        ))}
                        <span className="text-gray-400">({g.total} cliente{g.total !== 1 ? 's' : ''})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 shrink-0">→ unificar em:</span>
                        <input
                          value={g.canonico}
                          onChange={e => setExatos(prev => prev.map((x, i) => i === idx ? { ...x, canonico: e.target.value } : x))}
                          className="flex-1 px-2 py-1 border border-amber-300 rounded text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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

            {proximos.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-lg">
                Nenhuma duplicata detectada.
              </p>
            )}

            <div className="space-y-2">
              {proximos.map((g, idx) => (
                <div
                  key={g.id}
                  className={`border rounded-lg p-3 ${g.ignorado ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-orange-200 bg-orange-50'}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        {g.nomes.map(n => (
                          <span key={n} className={`inline-block border rounded px-1.5 py-0.5 text-xs font-mono ${n === g.canonico ? 'bg-white border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600'}`}>
                            {n}
                          </span>
                        ))}
                        <span className="text-xs text-gray-400">({g.total} cliente{g.total !== 1 ? 's' : ''})</span>
                      </div>

                      {!g.ignorado && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500 shrink-0">→ unificar em:</span>
                          <select
                            value={g.canonico}
                            onChange={e => setProximos(prev => prev.map((x, i) => i === idx ? { ...x, canonico: e.target.value } : x))}
                            className="flex-1 px-2 py-1 border border-orange-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {g.nomes.map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <input
                            placeholder="ou digitar..."
                            className="w-36 px-2 py-1 border border-orange-200 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            onBlur={e => { if (e.target.value.trim()) setProximos(prev => prev.map((x, i) => i === idx ? { ...x, canonico: e.target.value.trim() } : x)); e.target.value = ''; }}
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
          </div>

          {/* Info sobre normalização de caixas sem variação */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700">
            <p className="font-medium">Normalização de caixa</p>
            <p className="text-xs mt-0.5 text-blue-600">
              Além dos grupos acima, <strong>todos</strong> os nomes de cidades e UFs serão convertidos para
              Title Case (ex: "AMERICANA" → "Americana") e UF para maiúsculas (ex: "sp" → "SP").
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-200 shrink-0 bg-white rounded-b-xl">
          <p className="text-xs text-gray-500">
            {exatos.length + proximos.filter(g => !g.ignorado).length === 0
              ? 'Apenas normalização de caixa será aplicada.'
              : `${exatos.length} grupos exatos + ${proximos.filter(g => !g.ignorado).length} duplicatas serão unificados.`}
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

/** Utilitários exportados para uso externo */
export { toTitleCase, normKey };
