import { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Package, Trophy, ArrowRight, Shuffle, Percent, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { SeguroNovo, Renovacao, Prospeccao, Ramo, Seguradora, MotivoPerda, Usuario, OrigemProspeccao } from '../types';
import { formatCurrency } from '../utils/formatters';

interface Props {
  segurosNovos: SeguroNovo[];
  renovacoes: Renovacao[];
  prospeccoes: Prospeccao[];
  ramos: Ramo[];
  seguradoras: Seguradora[];
  motivos: MotivoPerda[];
  usuarios: Usuario[];
  origensProspeccao: OrigemProspeccao[];
}

type TipoNegocio = 'todos' | 'seguros_novos' | 'renovacoes' | 'prospeccoes';

const MESES_LABEL = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, icon: Icon }: {
  label: string;
  value: number | string;
  sub: string;
  color: 'blue' | 'red' | 'green' | 'purple' | 'orange';
  icon: React.ElementType;
}) {
  const cfg = {
    blue:   { bg: 'bg-blue-50',   val: 'text-blue-700',   ic: 'text-blue-400'   },
    red:    { bg: 'bg-red-50',    val: 'text-red-700',    ic: 'text-red-400'    },
    green:  { bg: 'bg-emerald-50',val: 'text-emerald-700',ic: 'text-emerald-400'},
    purple: { bg: 'bg-violet-50', val: 'text-violet-700', ic: 'text-violet-400' },
    orange: { bg: 'bg-orange-50', val: 'text-orange-700', ic: 'text-orange-400' },
  }[color];
  return (
    <div className={`${cfg.bg} rounded-xl p-5`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        <Icon size={16} className={cfg.ic} />
      </div>
      <div className={`text-2xl font-bold ${cfg.val}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{sub}</div>
    </div>
  );
}

// ─── Mini bar row ─────────────────────────────────────────────────────────────
function RankRow({ pos, nome, qtd, premio, comissao, maxPremio, color }: {
  pos: number; nome: string; qtd: number; premio: number; comissao: number;
  maxPremio: number; color: string;
}) {
  const pct = maxPremio > 0 ? (premio / maxPremio) * 100 : 0;
  const medalha = pos === 1 ? 'text-amber-400' : pos === 2 ? 'text-gray-400' : pos === 3 ? 'text-amber-700' : 'text-gray-300';
  return (
    <div className="flex items-center gap-3">
      <span className={`text-xs font-bold w-5 text-center ${medalha}`}>{pos}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-800 truncate">{nome}</span>
          <span className="text-gray-400 text-xs shrink-0 ml-2">{qtd} neg.</span>
        </div>
        <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
          <span>Prêmio: <span className="font-medium text-gray-700">{formatCurrency(premio)}</span></span>
          <span>Com.: <span className="font-medium text-emerald-700">{formatCurrency(comissao)}</span></span>
        </div>
        <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function DashboardProducao({ segurosNovos, renovacoes, prospeccoes, ramos, seguradoras, motivos, usuarios, origensProspeccao }: Props) {
  const now = new Date();
  const [filtroAno, setFiltroAno] = useState(now.getFullYear());
  const [filtroMes, setFiltroMes] = useState(now.getMonth() + 1);
  const [filtroRamo, setFiltroRamo] = useState('');
  const [filtroSeguradora, setFiltroSeguradora] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<TipoNegocio>('todos');
  const [filtroMigOrigem, setFiltroMigOrigem] = useState('');
  const [filtroOrigem, setFiltroOrigem] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');

  const anos = useMemo(() => {
    const all = [
      ...segurosNovos.map(s => s.inicioVigencia?.slice(0, 4)),
      ...renovacoes.map(r => r.fimVigencia?.slice(0, 4)),
      ...prospeccoes.map(p => p.dataContato?.slice(0, 4)),
    ].filter(Boolean).map(Number);
    return [...new Set(all)].sort((a, b) => b - a);
  }, [segurosNovos, renovacoes, prospeccoes]);

  function dentroPeriodo(dateStr?: string): boolean {
    if (!dateStr) return true;
    const [y, m] = dateStr.split('-').map(Number);
    if (filtroAno && y !== filtroAno) return false;
    if (filtroMes && m !== filtroMes) return false;
    return true;
  }

  // ── Seguros Novos ────────────────────────────────────────────────────────────
  const snFiltrados = useMemo(() => {
    if (filtroTipo === 'renovacoes' || filtroTipo === 'prospeccoes') return [];
    return segurosNovos.filter(s => {
      if (!dentroPeriodo(s.inicioVigencia)) return false;
      if (filtroRamo && s.ramo !== filtroRamo) return false;
      if (filtroSeguradora && s.seguradora !== filtroSeguradora) return false;
      if (filtroOrigem && s.origem !== filtroOrigem) return false;
      if (filtroUsuario && s.responsavelId !== filtroUsuario) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segurosNovos, filtroAno, filtroMes, filtroRamo, filtroSeguradora, filtroTipo, filtroOrigem, filtroUsuario]);

  const snFechados  = useMemo(() => snFiltrados.filter(s => s.status === 'fechado'), [snFiltrados]);
  const snPerdidos  = useMemo(() => snFiltrados.filter(s => {
    if (s.status !== 'perdido') return false;
    const m = motivos.find(x => x.id === s.motivoPerdaId);
    return m ? m.considerarTaxaConversaoSegurosNovos : true;
  }), [snFiltrados, motivos]);

  // ── Renovações ───────────────────────────────────────────────────────────────
  const renFiltradas = useMemo(() => {
    if (filtroTipo === 'seguros_novos' || filtroTipo === 'prospeccoes') return [];
    return renovacoes.filter(r => {
      if (!dentroPeriodo(r.fimVigencia)) return false;
      if (filtroRamo && r.ramo !== filtroRamo) return false;
      if (filtroSeguradora && r.seguradoraAnterior !== filtroSeguradora && r.seguradoraNova !== filtroSeguradora) return false;
      if (filtroUsuario && r.responsavelId !== filtroUsuario) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renovacoes, filtroAno, filtroMes, filtroRamo, filtroSeguradora, filtroTipo, filtroUsuario]);

  const renRenovadas = useMemo(() => renFiltradas.filter(r => r.status === 'renovado'), [renFiltradas]);
  const renPerdidas  = useMemo(() => renFiltradas.filter(r => {
    if (r.status !== 'nao_renovada') return false;
    const m = motivos.find(x => x.id === r.motivoPerdaId);
    return m ? m.considerarTaxaConversaoRenovacoes : true;
  }), [renFiltradas, motivos]);

  // ── Prospecções ──────────────────────────────────────────────────────────────
  const prospFiltradas = useMemo(() => {
    if (filtroTipo === 'seguros_novos' || filtroTipo === 'renovacoes') return [];
    return prospeccoes.filter(p => {
      if (!dentroPeriodo(p.dataContato)) return false;
      if (filtroRamo && p.ramo !== filtroRamo) return false;
      if (filtroSeguradora && p.seguradora !== filtroSeguradora) return false;
      if (filtroOrigem && p.origem !== filtroOrigem) return false;
      if (filtroUsuario && p.responsavelId !== filtroUsuario) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospeccoes, filtroAno, filtroMes, filtroRamo, filtroSeguradora, filtroTipo, filtroOrigem, filtroUsuario]);

  // prospConvertidas removido — não utilizado nos rankings atuais
  const prospDescartadas  = useMemo(() => prospFiltradas.filter(p => p.status === 'descartado'),  [prospFiltradas]);

  // Seguros Novos fechados originados de prospecções filtradas (para rankings no filtro prospeccoes)
  const snDeProspFechados = useMemo(() => {
    if (filtroTipo !== 'prospeccoes') return [];
    const prospIds = new Set(prospFiltradas.map(p => p.id));
    return segurosNovos.filter(s => {
      if (s.status !== 'fechado') return false;
      if (!s.origemProspeccaoId || !prospIds.has(s.origemProspeccaoId)) return false;
      return true;
    });
  }, [filtroTipo, prospFiltradas, segurosNovos]);

  // ── Painel de Prospecções (sem filtro de período — visão geral) ──────────────
  const hoje = new Date().toISOString().split('T')[0];

  // Não trabalhadas: venceram a data e ninguém assumiu
  const prospNaoTrabalhadas = useMemo(() =>
    prospeccoes.filter(p =>
      !p.assumidoPor &&
      p.status !== 'descartado' &&
      p.dataContato < hoje
    ), [prospeccoes, hoje]);

  // Vinculadas a seguros novos originados de prospecções
  const snDeProsp = useMemo(() =>
    segurosNovos.filter(s => !!s.origemProspeccaoId),
    [segurosNovos]);

  const prospEmNegociacao = useMemo(() =>
    snDeProsp.filter(s => s.status !== 'fechado' && s.status !== 'perdido'),
    [snDeProsp]);

  const prospFechadas = useMemo(() =>
    snDeProsp.filter(s => s.status === 'fechado'),
    [snDeProsp]);

  const prospPerdidas = useMemo(() =>
    snDeProsp.filter(s => s.status === 'perdido'),
    [snDeProsp]);

  // ── Ranking por usuário que mais assumiu prospecções ─────────────────────────
  const rankingProspAssumidas = useMemo(() => {
    const map = new Map<string, number>();
    prospeccoes.forEach(p => {
      if (p.assumidoPor) map.set(p.assumidoPor, (map.get(p.assumidoPor) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([uid, qtd]) => ({ uid, qtd, nome: usuarios.find(u => u.id === uid)?.nome ?? uid }))
      .sort((a, b) => b.qtd - a.qtd);
  }, [prospeccoes, usuarios]);

  // ── Totais ───────────────────────────────────────────────────────────────────
  // snDeProspFechados representa os SNs efetivamente fechados vindos de prospecções
  // (não-vazio apenas quando filtroTipo === 'prospeccoes', pois snFechados já os inclui nos demais filtros)
  const totalFechados = snFechados.length + renRenovadas.length + snDeProspFechados.length;
  const totalPerdidos = snPerdidos.length + renPerdidas.length + prospDescartadas.length;
  const totalComissao =
    snFechados.reduce((s, x) => s + (x.comissao || 0), 0) +
    renRenovadas.reduce((s, x) => s + (x.comissaoNova || 0), 0) +
    snDeProspFechados.reduce((s, x) => s + (x.comissao || 0), 0);
  const totalPremio =
    snFechados.reduce((s, x) => s + (x.premioLiquido || 0), 0) +
    renRenovadas.reduce((s, x) => s + (x.premioNovo || 0), 0) +
    snDeProspFechados.reduce((s, x) => s + (x.premioLiquido || 0), 0);

  // % média de comissão: média simples dos percentuais de cada negócio (SN + Ren)
  const percentBase = [...snFechados.map(s => s.percentComissao || 0), ...renRenovadas.map(r => r.percentComissaoNova || 0)];
  const mediaPercentComissao = percentBase.length > 0 ? percentBase.reduce((s, v) => s + v, 0) / percentBase.length : 0;

  // ── Ranking por Seguradora ───────────────────────────────────────────────────
  const rankingSeg = useMemo(() => {
    const map = new Map<string, { qtd: number; premio: number; comissao: number }>();
    const add = (seg: string, p: number, c: number) => {
      if (!seg) return;
      const e = map.get(seg) ?? { qtd: 0, premio: 0, comissao: 0 };
      e.qtd++; e.premio += p; e.comissao += c;
      map.set(seg, e);
    };
    snFechados.forEach(s => add(s.seguradora, s.premioLiquido || 0, s.comissao || 0));
    renRenovadas.forEach(r => add(r.seguradoraNova, r.premioNovo || 0, r.comissaoNova || 0));
    snDeProspFechados.forEach(s => add(s.seguradora, s.premioLiquido || 0, s.comissao || 0));
    return [...map.entries()].map(([seg, d]) => ({ seg, ...d })).sort((a, b) => b.premio - a.premio);
  }, [snFechados, renRenovadas, snDeProspFechados]);

  // ── Ranking por Ramo ─────────────────────────────────────────────────────────
  const rankingRamo = useMemo(() => {
    const map = new Map<string, { qtd: number; premio: number; comissao: number }>();
    const add = (ramo: string, p: number, c: number) => {
      if (!ramo) return;
      const e = map.get(ramo) ?? { qtd: 0, premio: 0, comissao: 0 };
      e.qtd++; e.premio += p; e.comissao += c;
      map.set(ramo, e);
    };
    snFechados.forEach(s => add(s.ramo, s.premioLiquido || 0, s.comissao || 0));
    renRenovadas.forEach(r => add(r.ramo, r.premioNovo || 0, r.comissaoNova || 0));
    snDeProspFechados.forEach(s => add(s.ramo, s.premioLiquido || 0, s.comissao || 0));
    return [...map.entries()].map(([ramo, d]) => ({ ramo, ...d })).sort((a, b) => b.premio - a.premio);
  }, [snFechados, renRenovadas, snDeProspFechados]);

  // ── Migração ─────────────────────────────────────────────────────────────────
  const renParaMig = useMemo(() => {
    if (filtroTipo === 'seguros_novos' || filtroTipo === 'prospeccoes') return [];
    return renovacoes.filter(r => {
      if (r.status !== 'renovado') return false;
      if (!dentroPeriodo(r.fimVigencia)) return false;
      if (filtroRamo && r.ramo !== filtroRamo) return false;
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renovacoes, filtroAno, filtroMes, filtroRamo, filtroTipo]);

  const mantidas = useMemo(() => renParaMig.filter(r =>
    !r.seguradoraNova || r.seguradoraAnterior === r.seguradoraNova
  ), [renParaMig]);

  const migradas = useMemo(() => renParaMig.filter(r =>
    r.seguradoraNova && r.seguradoraAnterior !== r.seguradoraNova
  ), [renParaMig]);

  // Saídas de seguradora selecionada (quem capturou)
  const saidasAgrup = useMemo(() => {
    if (!filtroSeguradora) return [];
    const map = new Map<string, number>();
    migradas.filter(r => r.seguradoraAnterior === filtroSeguradora)
      .forEach(r => map.set(r.seguradoraNova, (map.get(r.seguradoraNova) ?? 0) + 1));
    return [...map.entries()].map(([seg, qtd]) => ({ seg, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [migradas, filtroSeguradora]);

  // Entradas para seguradora selecionada (de onde vieram)
  const entradasAgrup = useMemo(() => {
    if (!filtroSeguradora) return [];
    const map = new Map<string, number>();
    migradas.filter(r => r.seguradoraNova === filtroSeguradora)
      .forEach(r => map.set(r.seguradoraAnterior, (map.get(r.seguradoraAnterior) ?? 0) + 1));
    return [...map.entries()].map(([seg, qtd]) => ({ seg, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [migradas, filtroSeguradora]);

  // Top migrações geral (sem filtro seguradora)
  const topMig = useMemo(() => {
    if (filtroSeguradora) return [];
    const map = new Map<string, number>();
    migradas.forEach(r => {
      if (!r.seguradoraAnterior || !r.seguradoraNova) return;
      const k = `${r.seguradoraAnterior}|||${r.seguradoraNova}`;
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map.entries()]
      .map(([k, qtd]) => { const [de, para] = k.split('|||'); return { de, para, qtd }; })
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 10);
  }, [migradas, filtroSeguradora]);

  // Origens disponíveis para o filtro local de migração
  const migOrigensDisp = useMemo(() => {
    const set = new Set<string>();
    migradas.forEach(r => { if (r.seguradoraAnterior) set.add(r.seguradoraAnterior); });
    return [...set].sort();
  }, [migradas]);

  // Destinos quando uma origem está selecionada
  const migDestinosAgrup = useMemo(() => {
    if (!filtroMigOrigem) return [];
    const map = new Map<string, number>();
    migradas
      .filter(r => r.seguradoraAnterior === filtroMigOrigem)
      .forEach(r => { if (r.seguradoraNova) map.set(r.seguradoraNova, (map.get(r.seguradoraNova) ?? 0) + 1); });
    return [...map.entries()].map(([seg, qtd]) => ({ seg, qtd })).sort((a, b) => b.qtd - a.qtd);
  }, [migradas, filtroMigOrigem]);

  const showMig  = filtroTipo === 'todos' || filtroTipo === 'renovacoes';
  const showRamo = !filtroRamo;
  const temFiltro = filtroAno || filtroMes || filtroRamo || filtroSeguradora || filtroTipo !== 'todos' || !!filtroOrigem || !!filtroUsuario;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Produção</h1>
        <p className="text-sm text-gray-500 mt-0.5">Acompanhamento da produção total da empresa</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Tipo de Negócio */}
          <div className="flex gap-0.5 p-1 bg-gray-100 rounded-lg">
            {(['todos', 'seguros_novos', 'renovacoes', 'prospeccoes'] as TipoNegocio[]).map(t => (
              <button key={t} onClick={() => setFiltroTipo(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  filtroTipo === t ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}>
                {t === 'todos' ? 'Todos' : t === 'seguros_novos' ? 'Seguros Novos' : t === 'renovacoes' ? 'Renovações' : 'Prospecções'}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-gray-200" />

          {/* Ano */}
          <select value={filtroAno} onChange={e => setFiltroAno(+e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value={0}>Todos os anos</option>
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>

          {/* Mês */}
          <select value={filtroMes} onChange={e => setFiltroMes(+e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value={0}>Todos os meses</option>
            {MESES_LABEL.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>

          {/* Ramo */}
          <select value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos os ramos</option>
            {ramos.filter(r => r.ativo).map(r => <option key={r.id} value={r.nome}>{r.nome}</option>)}
          </select>

          {/* Seguradora */}
          <select value={filtroSeguradora} onChange={e => setFiltroSeguradora(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todas as seguradoras</option>
            {seguradoras.filter(s => s.ativo).map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
          </select>

          {(filtroTipo === 'seguros_novos' || filtroTipo === 'prospeccoes' || filtroTipo === 'todos') && (
            <select value={filtroOrigem} onChange={e => setFiltroOrigem(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas as origens</option>
              {origensProspeccao.filter(o => {
                if (!o.ativo) return false;
                if (filtroTipo === 'seguros_novos') return !o.isSystem && (!o.aplicavelA || o.aplicavelA === 'seguros_novos' || o.aplicavelA === 'ambos');
                if (filtroTipo === 'prospeccoes') return o.isSystem || !o.aplicavelA || o.aplicavelA === 'prospeccoes' || o.aplicavelA === 'ambos';
                return true; // todos: mostra todas
              }).map(o => (
                <option key={o.id} value={o.id}>{o.nome}</option>
              ))}
            </select>
          )}

          {/* Usuário */}
          <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos os usuários</option>
            {usuarios.filter(u => u.ativo !== false).map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>

          {temFiltro && (
            <button
              onClick={() => { setFiltroAno(0); setFiltroMes(0); setFiltroRamo(''); setFiltroSeguradora(''); setFiltroTipo('todos'); setFiltroOrigem(''); setFiltroUsuario(''); }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Negócios Fechados"
          value={totalFechados}
          sub={filtroTipo === 'prospeccoes'
            ? `Prosp. fechadas: ${snDeProspFechados.length}`
            : `SN: ${snFechados.length} · Ren: ${renRenovadas.length}`}
          color="blue" icon={Package}
        />
        <KpiCard
          label="Negócios Perdidos"
          value={totalPerdidos}
          sub={`SN: ${snPerdidos.length} · Ren: ${renPerdidas.length} · Prosp: ${prospDescartadas.length}`}
          color="red" icon={TrendingDown}
        />
        <KpiCard
          label="Comissão Total"
          value={formatCurrency(totalComissao)}
          sub="Seguros Novos + Renovações"
          color="green" icon={DollarSign}
        />
        <KpiCard
          label="Prêmio Líquido Total"
          value={formatCurrency(totalPremio)}
          sub={filtroTipo === 'prospeccoes' ? 'Prospecções fechadas (prêmio real)' : 'SN + Renovações'}
          color="purple" icon={TrendingUp}
        />
        <KpiCard
          label="% Média de Comissão"
          value={`${mediaPercentComissao.toFixed(2).replace('.', ',')}%`}
          sub={`Sobre ${percentBase.length} neg. (SN + Ren)`}
          color="orange" icon={Percent}
        />
      </div>

      {/* Painel de Prospecções / Seguros Novos */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          {filtroTipo === 'seguros_novos' ? 'Painel de Seguros Novos' : 'Funil de Prospecções'}
        </h2>

        {filtroTipo === 'seguros_novos' ? (
          /* Vista de Seguros Novos: conta TODOS os SNs (incluindo originados de prospecções) */
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-yellow-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Em Andamento</span>
                <Clock size={16} className="text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-yellow-700">
                {snFiltrados.filter(s => s.status !== 'fechado' && s.status !== 'perdido').length}
              </div>
              <div className="text-xs text-gray-500 mt-1">Seguros novos em aberto</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Fechados</span>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-700">{snFechados.length}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatCurrency(snFechados.reduce((s, x) => s + (x.premioLiquido || 0), 0))} em prêmios
              </div>
            </div>
            <div className="bg-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Perdidos</span>
                <XCircle size={16} className="text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-600">{snPerdidos.length}</div>
              <div className="text-xs text-gray-500 mt-1">Negócios perdidos</div>
            </div>
          </div>
        ) : (
          /* Vista de Prospecções / Todos: conta apenas SNs originados de prospecções */
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-red-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Não Trabalhadas</span>
                <AlertCircle size={16} className="text-red-400" />
              </div>
              <div className="text-2xl font-bold text-red-700">{prospNaoTrabalhadas.length}</div>
              <div className="text-xs text-gray-500 mt-1">Vencidas sem assumir</div>
            </div>
            <div className="bg-yellow-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Em Negociação</span>
                <Clock size={16} className="text-yellow-400" />
              </div>
              <div className="text-2xl font-bold text-yellow-700">{prospEmNegociacao.length}</div>
              <div className="text-xs text-gray-500 mt-1">Seguros novos em andamento</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Fechadas</span>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-700">{prospFechadas.length}</div>
              <div className="text-xs text-gray-500 mt-1">
                {formatCurrency(prospFechadas.reduce((s, x) => s + (x.premioLiquido || 0), 0))} em prêmios
              </div>
            </div>
            <div className="bg-gray-100 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-600">Perdidas</span>
                <XCircle size={16} className="text-gray-400" />
              </div>
              <div className="text-2xl font-bold text-gray-600">{prospPerdidas.length}</div>
              <div className="text-xs text-gray-500 mt-1">Negócios perdidos</div>
            </div>
          </div>
        )}

        {/* Ranking de usuários que mais assumiram — só visível no filtro de prospecções */}
        {filtroTipo === 'prospeccoes' && rankingProspAssumidas.length > 0 && (
          <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={16} className="text-violet-500" />
              <h3 className="font-semibold text-gray-900">Ranking — Quem mais assumiu prospecções</h3>
            </div>
            <div className="space-y-3">
              {rankingProspAssumidas.map((row, i) => {
                const medalha = i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-700' : 'text-gray-300';
                const maxQtd = rankingProspAssumidas[0].qtd;
                const pct = maxQtd > 0 ? (row.qtd / maxQtd) * 100 : 0;
                return (
                  <div key={row.uid} className="flex items-center gap-3">
                    <span className={`text-xs font-bold w-5 text-center ${medalha}`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-sm mb-1.5">
                        <span className="font-medium text-gray-800 truncate">{row.nome}</span>
                        <span className="text-violet-700 font-semibold shrink-0 ml-2">{row.qtd} assumida{row.qtd !== 1 ? 's' : ''}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Rankings por Seguradora e por Produto */}
      <div>
        {filtroTipo === 'renovacoes' && (
          <h2 className="text-base font-semibold text-gray-800 mb-3">Rankings de Renovações</h2>
        )}
        {filtroTipo === 'prospeccoes' && (
          <h2 className="text-base font-semibold text-gray-800 mb-3">Rankings de Prospecções</h2>
        )}
        <div className={`grid gap-4 ${showRamo ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Ranking por Seguradora */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy size={16} className="text-amber-500" />
              <h2 className="font-semibold text-gray-900">
                {filtroTipo === 'renovacoes' ? 'Renovações por Seguradora'
                 : filtroTipo === 'seguros_novos' ? 'Seguros Novos por Seguradora'
                 : filtroTipo === 'prospeccoes' ? 'Prospecções por Seguradora'
                 : 'Ranking de Produção por Seguradora'}
              </h2>
            </div>
            {rankingSeg.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhum negócio fechado no período</p>
            ) : (
              <div className="space-y-3">
                {rankingSeg.map((r, i) => (
                  <RankRow key={r.seg} pos={i + 1} nome={r.seg} qtd={r.qtd}
                    premio={r.premio} comissao={r.comissao}
                    maxPremio={rankingSeg[0].premio} color="bg-blue-500" />
                ))}
              </div>
            )}
          </div>

          {/* Ranking por Produto/Ramo (apenas quando sem filtro de ramo) */}
          {showRamo && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-indigo-500" />
                <h2 className="font-semibold text-gray-900">
                  {filtroTipo === 'renovacoes' ? 'Renovações por Produto'
                   : filtroTipo === 'seguros_novos' ? 'Seguros Novos por Produto'
                   : filtroTipo === 'prospeccoes' ? 'Prospecções por Produto'
                   : 'Ranking de Produção por Produto'}
                </h2>
              </div>
              {rankingRamo.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Nenhum negócio fechado no período</p>
              ) : (
                <div className="space-y-3">
                  {rankingRamo.map((r, i) => (
                    <RankRow key={r.ramo} pos={i + 1} nome={r.ramo} qtd={r.qtd}
                      premio={r.premio} comissao={r.comissao}
                      maxPremio={rankingRamo[0].premio} color="bg-indigo-500" />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Análise de Migração */}
      {showMig && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Shuffle size={16} className="text-violet-500" />
              <h2 className="font-semibold text-gray-900">Análise de Migração — Renovações</h2>
            </div>
            {migOrigensDisp.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 whitespace-nowrap">Seguradora de saída:</label>
                <select
                  value={filtroMigOrigem}
                  onChange={e => setFiltroMigOrigem(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">Todas</option>
                  {migOrigensDisp.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{renParaMig.length}</div>
              <div className="text-xs text-gray-500 mt-1">Total Renovadas</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-green-700">{mantidas.length}</div>
              <div className="text-xs text-gray-500 mt-1">Mantidas na mesma</div>
              <div className="text-xs font-semibold text-green-600 mt-0.5">
                {renParaMig.length > 0 ? Math.round(mantidas.length / renParaMig.length * 100) : 0}%
              </div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-amber-700">{migradas.length}</div>
              <div className="text-xs text-gray-500 mt-1">Migraram de seguradora</div>
              <div className="text-xs font-semibold text-amber-600 mt-0.5">
                {renParaMig.length > 0 ? Math.round(migradas.length / renParaMig.length * 100) : 0}%
              </div>
            </div>
          </div>

          {/* Detalhamento */}
          {filtroMigOrigem ? (
            <div>
              <h3 className="text-sm font-semibold text-violet-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />
                Renovações que saíram de <span className="italic">{filtroMigOrigem}</span> foram para:
                <span className="text-gray-400 font-normal">({migDestinosAgrup.reduce((s, r) => s + r.qtd, 0)} ren. migradas)</span>
              </h3>
              {migDestinosAgrup.length === 0 ? (
                <p className="text-sm text-gray-400 py-3">Nenhuma migração desta seguradora no período</p>
              ) : (
                <div className="space-y-2">
                  {migDestinosAgrup.map((row, i) => {
                    const total = migDestinosAgrup.reduce((s, r) => s + r.qtd, 0);
                    const pct = total > 0 ? Math.round(row.qtd / total * 100) : 0;
                    return (
                      <div key={row.seg} className="flex items-center gap-3 py-2.5 px-3 bg-violet-50 rounded-lg">
                        <span className="text-xs font-bold text-violet-300 w-4 shrink-0">{i + 1}</span>
                        <span className="flex-1 text-sm font-medium text-gray-800">{row.seg}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-20 h-1.5 bg-violet-100 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-7 text-right">{pct}%</span>
                          <span className="text-sm font-semibold text-violet-700 w-14 text-right">{row.qtd} ren.</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : filtroSeguradora ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Saídas */}
              <div>
                <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  Saídas de <span className="italic">{filtroSeguradora}</span>
                  <span className="text-gray-400 font-normal">({saidasAgrup.reduce((s, r) => s + r.qtd, 0)} ren.)</span>
                </h3>
                {saidasAgrup.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3">Nenhuma saída no período</p>
                ) : (
                  <div className="space-y-1.5">
                    {saidasAgrup.map((row, i) => (
                      <div key={row.seg} className="flex items-center gap-2 py-2 px-3 bg-red-50 rounded-lg">
                        <span className="text-xs font-bold text-red-300 w-4">{i + 1}</span>
                        <span className="flex-1 text-sm text-gray-700">{row.seg}</span>
                        <span className="text-sm font-semibold text-red-700">{row.qtd} ren.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Entradas */}
              <div>
                <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                  Entradas para <span className="italic">{filtroSeguradora}</span>
                  <span className="text-gray-400 font-normal">({entradasAgrup.reduce((s, r) => s + r.qtd, 0)} ren.)</span>
                </h3>
                {entradasAgrup.length === 0 ? (
                  <p className="text-sm text-gray-400 py-3">Nenhuma entrada no período</p>
                ) : (
                  <div className="space-y-1.5">
                    {entradasAgrup.map((row, i) => (
                      <div key={row.seg} className="flex items-center gap-2 py-2 px-3 bg-green-50 rounded-lg">
                        <span className="text-xs font-bold text-green-300 w-4">{i + 1}</span>
                        <span className="text-xs text-gray-400 shrink-0">de</span>
                        <span className="flex-1 text-sm text-gray-700">{row.seg}</span>
                        <span className="text-sm font-semibold text-green-700">{row.qtd} ren.</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : migradas.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Top Migrações no Período</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide w-8">#</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Seguradora Anterior</th>
                      <th className="w-6" />
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Nova Seguradora</th>
                      <th className="text-right py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Qtd</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMig.map((row, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-2.5 px-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="py-2.5 px-3 text-gray-700 font-medium">{row.de}</td>
                        <td className="py-2.5 text-center">
                          <ArrowRight size={12} className="text-gray-300 mx-auto" />
                        </td>
                        <td className="py-2.5 px-3 text-gray-700 font-medium">{row.para}</td>
                        <td className="py-2.5 px-3 text-right">
                          <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full">
                            {row.qtd}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">
              {renParaMig.length === 0
                ? 'Nenhuma renovação no período selecionado'
                : 'Todas as renovações foram mantidas na mesma seguradora 🎉'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
