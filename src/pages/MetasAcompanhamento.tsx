import { useMemo, useState } from 'react';
import { Target, RefreshCw, PlusCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Renovacao, SeguroNovo, Usuario, Ramo, MotivoPerda, ConfiguracoesMetas, FaixaMeta } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import {
  calcularTaxaConversaoRenovacoes,
  calcularTaxaConversaoSegurosNovos,
  calcularAumentoComissao,
} from '../utils/calculations';

interface Props {
  renovacoes: Renovacao[];
  segurosNovos: SeguroNovo[];
  usuarios: Usuario[];
  ramos: Ramo[];
  motivos: MotivoPerda[];
  metas: ConfiguracoesMetas;
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function faixaAtual(faixas: FaixaMeta[], valor: number): FaixaMeta | null {
  return faixas.find(f => valor >= f.minimo && (f.maximo === null || valor <= f.maximo)) ?? null;
}
function proximaFaixa(faixas: FaixaMeta[], valor: number): FaixaMeta | null {
  return faixas.find(f => f.minimo > valor) ?? null;
}
function todasSuperadas(faixas: FaixaMeta[], valor: number): boolean {
  return faixas.length > 0 && !proximaFaixa(faixas, valor) && !faixaAtual(faixas, valor);
}

// Cores por faixa (até 4 faixas)
const SEG_COLORS = [
  { fill: 'bg-blue-400',   empty: 'bg-blue-100',   label: 'text-blue-600'  },
  { fill: 'bg-indigo-500', empty: 'bg-indigo-100',  label: 'text-indigo-600'},
  { fill: 'bg-violet-500', empty: 'bg-violet-100',  label: 'text-violet-600'},
  { fill: 'bg-purple-500', empty: 'bg-purple-100',  label: 'text-purple-600'},
];
const SEG_DONE = { fill: 'bg-green-400', empty: 'bg-green-100', label: 'text-green-600' };

// ─── Barra segmentada ─────────────────────────────────────────────────────────
function BarraSegmentada({ valor, faixas, fmt }: { valor: number; faixas: FaixaMeta[]; fmt: (v: number) => string }) {
  if (faixas.length === 0) return null;

  // Cada faixa ocupa uma fatia igual da barra (mais fácil de ler que escala linear)
  // A última faixa sempre representa "atingiu o máximo e além"
  void faixas.length; // usado implicitamente via segmentos

  // Para cada faixa calculamos: qual a fração do valor dentro dela (0–1)
  const segmentos = faixas.map((f, i) => {
    const min  = f.minimo;
    const max  = f.maximo !== null ? f.maximo : faixas[i - 1]?.maximo != null
      ? f.minimo * 1.5   // estimativa para último segmento aberto
      : f.minimo * 2;

    // atingida = usuario já ultrapassou esta faixa inteira
    const nextMin = faixas[i + 1]?.minimo ?? Infinity;
    const atingida = valor >= nextMin;
    const atual    = !atingida && valor >= min;
    const frac     = atingida ? 1
      : atual ? Math.min((valor - min) / Math.max(max - min, 1), 1)
      : 0;

    const col = atingida ? SEG_DONE : SEG_COLORS[i % SEG_COLORS.length];

    return { f, min, max, frac, atingida, atual, col };
  });

  const todas = segmentos.every(s => s.atingida) || todasSuperadas(faixas, valor);

  return (
    <div className="mt-2 mb-1">
      {/* Barra com segmentos */}
      <div className="flex gap-0.5 h-5 rounded-lg overflow-hidden">
        {segmentos.map(({ f, frac, col }, i) => (
          <div key={f.id} className={`relative flex-1 ${col.empty} rounded-sm overflow-hidden`}>
            <div
              className={`absolute inset-y-0 left-0 ${col.fill} transition-all duration-500`}
              style={{ width: `${frac * 100}%` }}
            />
            {/* Número da faixa */}
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span className="text-[9px] font-bold text-white/80 drop-shadow">{i + 1}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Rótulos: threshold e bônus de cada faixa */}
      <div className="flex gap-0.5 mt-1">
        {segmentos.map(({ f, atingida, atual }) => (
          <div key={f.id} className="flex-1 flex flex-col items-center gap-0.5">
            <span className="text-[9px] text-gray-400">{fmt(f.minimo)}+</span>
            {(atingida || atual) && (
              <span className={`text-[8px] font-semibold ${atingida ? 'text-green-600' : 'text-blue-600'}`}>
                {atingida ? '✓' : '●'}
              </span>
            )}
          </div>
        ))}
      </div>

      {todas && (
        <div className="mt-1.5 text-[10px] text-green-700 font-semibold text-center">🏆 Todas as faixas superadas!</div>
      )}
    </div>
  );
}

// ─── Linha de indicador ───────────────────────────────────────────────────────
function LinhaIndicador({
  label, valor, faixas, formato, icone: Icone, cor,
}: {
  label: string;
  valor: number;
  faixas: FaixaMeta[];
  formato: 'percent' | 'currency';
  icone?: React.ElementType;
  cor?: string;
}) {
  if (faixas.length === 0) return null;
  const fmt = (v: number) => formato === 'percent' ? formatPercent(v, 1) : formatCurrency(v);
  const atual = faixaAtual(faixas, valor);
  const proxima = proximaFaixa(faixas, valor);
  const todas = todasSuperadas(faixas, valor);
  const falta = proxima ? proxima.minimo - valor : null;

  let badgeClass = 'bg-gray-100 text-gray-400';
  let badgeLabel = proxima ? `Faltam ${fmt(falta!)}` : 'Abaixo';
  if (todas)  { badgeClass = 'bg-green-100 text-green-700';  badgeLabel = '🏆 Todas superadas'; }
  else if (atual) { badgeClass = 'bg-blue-100 text-blue-700'; badgeLabel = '✓ Atingida'; }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {Icone && <Icone size={12} className={cor ?? 'text-gray-500'} />}
          <span className="text-xs text-gray-600">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-gray-900">{fmt(valor)}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeClass}`}>{badgeLabel}</span>
        </div>
      </div>
      <BarraSegmentada valor={valor} faixas={faixas} fmt={fmt} />
    </div>
  );
}

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface DadosUsuario {
  usuario: Usuario;
  taxaRen: number;
  taxaSn: number;
  aumentoComissao: number;
  comissaoSnMeta: number;
  planoRen: import('../types').PlanoMetaRenovacao | null;
  planoSn:  import('../types').PlanoMetaSeguroNovo | null;
  faixasTaxaRen:    FaixaMeta[];
  faixasAumento:    FaixaMeta[];
  faixasSnComissao: FaixaMeta[];
  faixasSnTaxa:     FaixaMeta[];
}

function calcularDadosUsuario(
  u: Usuario, renovacoes: Renovacao[], segurosNovos: SeguroNovo[],
  ramos: Ramo[], motivos: MotivoPerda[], metas: ConfiguracoesMetas, ano: number, mes: number,
): DadosUsuario {
  const rv = renovacoes.filter(r => {
    if (!r.fimVigencia) return false;
    const d = new Date(r.fimVigencia + 'T00:00:00');
    return d.getFullYear() === ano && d.getMonth() + 1 === mes && r.responsavelId === u.id;
  });
  const sn = segurosNovos.filter(s => {
    // Usa criadoEm como fallback para SNs sem inicioVigencia (ex: criados via "Assumir Prospecção")
    const dateRef = s.inicioVigencia || s.criadoEm?.slice(0, 10) || '';
    if (!dateRef) return false;
    const d = new Date(dateRef + 'T00:00:00');
    return d.getFullYear() === ano && d.getMonth() + 1 === mes && s.responsavelId === u.id;
  });

  const motivosRen = motivos.filter(m => m.tipo === 'renovacao');
  const motivosSn  = motivos.filter(m => m.tipo === 'seguro_novo');
  const ramoByNome = (nome: string) => ramos.find(r => r.nome === nome);

  const taxaSn          = calcularTaxaConversaoSegurosNovos(sn, ramos, motivosSn);
  const aumentoComissao = calcularAumentoComissao(rv);
  const comissaoSnMeta  = sn.filter(s => s.status === 'fechado' && !(ramoByNome(s.ramo)?.remuneracaoIndividual ?? false))
    .reduce((acc, x) => acc + x.comissao, 0);

  const planoRen = u.recebeRemuneracaoRenovacoes
    ? (metas.planosRenovacao.find(p => p.id === u.planoMetaRenovacaoId) ?? metas.planosRenovacao[0] ?? null) : null;
  const planoSn  = u.recebeRemuneracaoSegurosNovos
    ? (metas.planosSeguroNovo.find(p => p.id === u.planoMetaSeguroNovoId) ?? metas.planosSeguroNovo[0] ?? null) : null;

  const taxaRen = calcularTaxaConversaoRenovacoes(rv, sn, ramos, motivosRen, planoRen?.considerarSnNaTaxa ?? true);

  return {
    usuario: u, taxaRen, taxaSn, aumentoComissao, comissaoSnMeta,
    planoRen, planoSn,
    faixasTaxaRen:    (u.recebeRemuneracaoTaxaRenovacoes  && planoRen) ? planoRen.taxaConversaoRenovacoes : [],
    faixasAumento:    (u.recebeRemuneracaoAumentoComissao && planoRen) ? planoRen.aumentoComissao         : [],
    faixasSnComissao: (u.recebeRemuneracaoSnComissao      && planoSn)  ? planoSn.segurosNovosPorComissao  : [],
    faixasSnTaxa:     (u.recebeRemuneracaoSnTaxa          && planoSn)  ? planoSn.segurosNovosPorTaxa      : [],
  };
}

// ─── Card de usuário ──────────────────────────────────────────────────────────
function CardUsuario({ d }: { d: DadosUsuario }) {
  const temRen = d.faixasTaxaRen.length > 0 || d.faixasAumento.length > 0;
  const temSn  = d.faixasSnComissao.length > 0 || d.faixasSnTaxa.length > 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Nome + planos */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold text-gray-900">{d.usuario.nome}</div>
        <div className="flex gap-1.5 text-[10px]">
          {d.planoRen && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">{d.planoRen.nome}</span>}
          {d.planoSn  && <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">{d.planoSn.nome}</span>}
        </div>
      </div>

      {!temRen && !temSn && (
        <p className="text-sm text-gray-400 italic">Sem plano de metas configurado.</p>
      )}

      <div className="space-y-5">
        {/* Renovações */}
        {temRen && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <RefreshCw size={12} className="text-blue-600" />
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Renovações</span>
            </div>
            <div className="space-y-3">
              <LinhaIndicador label="Taxa de Conversão" valor={d.taxaRen}
                faixas={d.faixasTaxaRen} formato="percent" icone={RefreshCw} cor="text-blue-500" />
              <LinhaIndicador label="Aumento de Comissão" valor={d.aumentoComissao}
                faixas={d.faixasAumento} formato="percent"
                icone={d.aumentoComissao >= 0 ? TrendingUp : TrendingDown}
                cor={d.aumentoComissao >= 0 ? 'text-green-500' : 'text-red-400'} />
            </div>
          </div>
        )}

        {/* Seguros Novos */}
        {temSn && (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <PlusCircle size={12} className="text-indigo-600" />
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Seguros Novos</span>
            </div>
            <div className="space-y-3">
              <LinhaIndicador label="Comissão Gerada" valor={d.comissaoSnMeta}
                faixas={d.faixasSnComissao} formato="currency" icone={PlusCircle} cor="text-indigo-500" />
              <LinhaIndicador label="Taxa de Conversão" valor={d.taxaSn}
                faixas={d.faixasSnTaxa} formato="percent" icone={TrendingUp} cor="text-indigo-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────
export function MetasAcompanhamento({ renovacoes, segurosNovos, usuarios, ramos, motivos, metas }: Props) {
  const { usuario } = useAuth();
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [filtroUsuario, setFiltroUsuario] = useState(usuario?.role === 'usuario' ? usuario.id : '');

  const anos = useMemo(() => {
    const s = new Set<number>([now.getFullYear()]);
    [...renovacoes, ...segurosNovos].forEach(r => {
      const d = 'fimVigencia' in r ? r.fimVigencia : (r as SeguroNovo).inicioVigencia;
      if (d) s.add(new Date(d + 'T00:00:00').getFullYear());
    });
    return [...s].sort((a, b) => b - a);
  }, [renovacoes, segurosNovos]);

  const usuariosVisiveis = useMemo(() => {
    if (usuario?.role === 'usuario') return usuarios.filter(u => u.id === usuario.id);
    return usuarios.filter(u => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [usuarios, usuario]);

  const usuariosParaExibir = useMemo(() =>
    filtroUsuario ? usuariosVisiveis.filter(u => u.id === filtroUsuario) : usuariosVisiveis,
    [usuariosVisiveis, filtroUsuario]);

  const dados = useMemo(() =>
    usuariosParaExibir.map(u => calcularDadosUsuario(u, renovacoes, segurosNovos, ramos, motivos, metas, ano, mes)),
    [usuariosParaExibir, renovacoes, segurosNovos, ramos, motivos, metas, ano, mes]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Target size={20} className="text-blue-700" />
          <h1 className="text-xl font-bold text-gray-900">Metas</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={mes} onChange={e => setMes(+e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(+e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {usuario?.role !== 'usuario' && (
            <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Todos os usuários</option>
              {usuariosVisiveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {dados.map(d => <CardUsuario key={d.usuario.id} d={d} />)}
      </div>

      {dados.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 py-14 text-center text-gray-400">
          <Target size={32} className="mx-auto mb-2 text-gray-300" />
          <p>Nenhum usuário encontrado.</p>
        </div>
      )}
    </div>
  );
}
