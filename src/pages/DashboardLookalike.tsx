/**
 * Dashboard Lookalike — Perfil de marketing da carteira de clientes.
 *
 * Métricas exibidas (alinhadas com boas práticas de segmentação de mercado):
 *  - Totais: clientes ativos, PF vs PJ, idade média, ticket médio
 *  - Distribuição por sexo
 *  - Faixa etária
 *  - Top 10 estados (UF)
 *  - Top 10 cidades
 *  - Produtos (ramos) mais comercializados
 *  - Seguradoras mais usadas
 *  - Clientes com múltiplos produtos (cross-sell)
 *  - Ticket médio por ramo
 *
 * Filtro por ramo: restringe os negócios (renovações + seguros novos) ao ramo
 * selecionado, revelando o perfil demográfico de cada produto.
 *
 * Nota sobre os tipos: no banco, `Renovacao.ramo` e `SeguroNovo.ramo` armazenam
 * o NOME do ramo (string livre), não o ID — seguindo o mesmo padrão dos outros
 * dashboards (ex: DashboardProducao).
 */

import { useMemo, useState } from 'react';
import {
  Users, TrendingUp, DollarSign, Star, Briefcase,
  BarChart2, Map, Building2, UserCheck, Package,
  RefreshCw, CheckCircle2, XCircle,
} from 'lucide-react';
import type { Cliente, Renovacao, SeguroNovo, Ramo } from '../types';

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  clientes: Cliente[];
  renovacoes: Renovacao[];
  segurosNovos: SeguroNovo[];
  ramos: Ramo[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function calcIdade(dataNascimento: string): number | null {
  if (!dataNascimento) return null;
  const nasc = new Date(dataNascimento + 'T00:00:00');
  if (isNaN(nasc.getTime())) return null;
  const hoje = new Date();
  let age = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
}

function faixaEtaria(idade: number): string {
  if (idade < 18) return 'Menor de 18';
  if (idade <= 25) return '18 – 25';
  if (idade <= 35) return '26 – 35';
  if (idade <= 45) return '36 – 45';
  if (idade <= 55) return '46 – 55';
  if (idade <= 65) return '56 – 65';
  return 'Acima de 65';
}

const FAIXAS_ORDER = ['Menor de 18', '18 – 25', '26 – 35', '36 – 45', '46 – 55', '56 – 65', 'Acima de 65'];

function pct(val: number, total: number) {
  if (!total) return 0;
  return Math.round((val / total) * 100);
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Mini componentes ───────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color = 'blue' }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color?: string;
}) {
  const colors: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-600 border-blue-200',
    green:  'bg-green-50 text-green-600 border-green-200',
    amber:  'bg-amber-50 text-amber-600 border-amber-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    rose:   'bg-rose-50 text-rose-600 border-rose-200',
    teal:   'bg-teal-50 text-teal-600 border-teal-200',
  };
  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${colors[color]}`}>
      <div className={`shrink-0 p-2 rounded-lg ${colors[color]}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium opacity-70 uppercase tracking-wide leading-tight">{label}</p>
        <p className="text-xl font-bold break-words leading-tight mt-0.5">{value}</p>
        {sub && <p className="text-xs mt-0.5 opacity-60">{sub}</p>}
      </div>
    </div>
  );
}

function BarRow({ label, count, total, color = 'bg-blue-500' }: {
  label: string; count: number; total: number; color?: string;
}) {
  const p = pct(count, total);
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-28 shrink-0 truncate text-gray-700 text-xs">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }} />
      </div>
      <span className="w-14 text-right text-xs text-gray-500 shrink-0">{count.toLocaleString('pt-BR')} ({p}%)</span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
        <Icon size={16} className="text-blue-600" />
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
      </div>
      <div className="p-5 space-y-2.5">{children}</div>
    </div>
  );
}

// ─── Componente principal ────────────────────────────────────────────────────

export function DashboardLookalike({ clientes, renovacoes, segurosNovos, ramos }: Props) {
  // filtroRamo usa o NOME do ramo (padrão adotado em DashboardProducao)
  const [filtroRamo,      setFiltroRamo]      = useState<string>('');
  // '' = ambos | 'renovacao' | 'seguro_novo'
  const [filtroTipo,      setFiltroTipo]      = useState<string>('');
  // '' = todos | 'fechado' | 'perdido'
  const [filtroResultado, setFiltroResultado] = useState<string>('');

  // ── Negócios filtrados por ramo + tipo + resultado ───────────────────────
  const negociosFiltrados = useMemo(() => {
    // 1. tipo (renovação ou seguro novo)
    const incluiRen = filtroTipo !== 'seguro_novo';
    const incluiSn  = filtroTipo !== 'renovacao';

    // 2. status por resultado
    const statusRenOk = filtroResultado === 'fechado'
      ? ['renovado']
      : filtroResultado === 'perdido'
        ? ['nao_renovada']
        : null; // null = todos os status

    const statusSnOk = filtroResultado === 'fechado'
      ? ['fechado']
      : filtroResultado === 'perdido'
        ? ['perdido']
        : null;

    let ren = incluiRen ? renovacoes : [];
    let sn  = incluiSn  ? segurosNovos : [];

    // 3. ramo
    if (filtroRamo) {
      ren = ren.filter(r => r.ramo === filtroRamo);
      sn  = sn.filter(s => s.ramo === filtroRamo);
    }

    // 4. status
    if (statusRenOk) ren = ren.filter(r => statusRenOk.includes(r.status));
    if (statusSnOk)  sn  = sn.filter(s => statusSnOk.includes(s.status));

    return { ren, sn };
  }, [renovacoes, segurosNovos, filtroRamo, filtroTipo, filtroResultado]);

  // ── IDs de clientes com algum negócio no filtro ─────────────────────────
  const clienteIdsComNegocio = useMemo(() => {
    const ids = new Set<string>();
    negociosFiltrados.ren.forEach(r => { if (r.clienteId) ids.add(r.clienteId); });
    negociosFiltrados.sn.forEach(s => { if (s.clienteId) ids.add(s.clienteId); });
    return ids;
  }, [negociosFiltrados]);

  // Se há qualquer filtro ativo, restringe a clientes com negócios resultantes
  const temFiltroAtivo = filtroRamo || filtroTipo || filtroResultado;
  const clientesFiltrados = useMemo(() => {
    if (!temFiltroAtivo) return clientes;
    return clientes.filter(c => clienteIdsComNegocio.has(c.id));
  }, [clientes, temFiltroAtivo, clienteIdsComNegocio]);

  // ── Apólices (ren + sn) para ticket médio e distribuições ───────────────
  // Renovacao: premioNovo / seguradoraNova
  // SeguroNovo: premioLiquido / seguradora
  const todasApolices = useMemo(() => [
    ...negociosFiltrados.ren.map(r => ({
      clienteId: r.clienteId,
      premio: Number(r.premioNovo) || 0,
      ramo: r.ramo,
      seguradora: r.seguradoraNova,
    })),
    ...negociosFiltrados.sn.map(s => ({
      clienteId: s.clienteId,
      premio: Number(s.premioLiquido) || 0,
      ramo: s.ramo,
      seguradora: s.seguradora,
    })),
  ], [negociosFiltrados]);

  // ── KPIs ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total  = clientesFiltrados.length;
    const pf     = clientesFiltrados.filter(c => c.tipo === 'PF').length;
    const pj     = total - pf;

    // Idade média (só PF com data de nascimento)
    const idades = clientesFiltrados
      .filter(c => c.tipo === 'PF')
      .map(c => calcIdade(c.dataNascimento ?? ''))
      .filter((i): i is number => i !== null);
    const idadeMedia = idades.length
      ? Math.round(idades.reduce((a, b) => a + b, 0) / idades.length)
      : null;

    // Ticket médio (prêmio por apólice)
    const premios = todasApolices.map(a => a.premio).filter(p => p > 0);
    const ticketMedio = premios.length
      ? premios.reduce((a, b) => a + b, 0) / premios.length
      : null;

    // Total de prêmios (carteira)
    const totalPremios = premios.reduce((a, b) => a + b, 0);

    return { total, pf, pj, idadeMedia, ticketMedio, totalPremios };
  }, [clientesFiltrados, todasApolices]);

  // ── Sexo ────────────────────────────────────────────────────────────────
  const sexoDist = useMemo(() => {
    const pf = clientesFiltrados.filter(c => c.tipo === 'PF');
    const m  = pf.filter(c => c.sexo === 'M').length;
    const f  = pf.filter(c => c.sexo === 'F').length;
    const ni = pf.length - m - f;
    return { m, f, ni, total: pf.length };
  }, [clientesFiltrados]);

  // ── Faixa etária ────────────────────────────────────────────────────────
  const faixaDist = useMemo(() => {
    const pf = clientesFiltrados.filter(c => c.tipo === 'PF');
    const map: Record<string, number> = {};
    FAIXAS_ORDER.forEach(f => { map[f] = 0; });
    pf.forEach(c => {
      const idade = calcIdade(c.dataNascimento ?? '');
      if (idade !== null) {
        const fx = faixaEtaria(idade);
        map[fx] = (map[fx] || 0) + 1;
      }
    });
    const semIdade = pf.filter(c => calcIdade(c.dataNascimento ?? '') === null).length;
    return { map, semIdade, total: pf.length };
  }, [clientesFiltrados]);

  // ── Top UFs ──────────────────────────────────────────────────────────────
  const topUfs = useMemo(() => {
    const map: Record<string, number> = {};
    clientesFiltrados.forEach(c => {
      const uf = (c.uf || '').trim().toUpperCase() || 'N/I';
      map[uf] = (map[uf] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [clientesFiltrados]);

  // ── Top cidades ─────────────────────────────────────────────────────────
  const topCidades = useMemo(() => {
    const map: Record<string, number> = {};
    clientesFiltrados.forEach(c => {
      const cid = (c.cidade || '').trim() || 'N/I';
      map[cid] = (map[cid] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [clientesFiltrados]);

  // ── Distribuição por ramo ────────────────────────────────────────────────
  const ramoDist = useMemo(() => {
    const map: Record<string, number> = {};
    todasApolices.forEach(a => {
      const nome = a.ramo || 'Desconhecido';
      map[nome] = (map[nome] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [todasApolices]);

  // ── Distribuição por seguradora ──────────────────────────────────────────
  const seguradoraDist = useMemo(() => {
    const map: Record<string, number> = {};
    todasApolices.forEach(a => {
      const nome = a.seguradora || 'Desconhecida';
      map[nome] = (map[nome] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [todasApolices]);

  // ── Cross-sell: clientes com múltiplos ramos distintos ──────────────────
  const crossSell = useMemo(() => {
    const clienteRamos: Record<string, Set<string>> = {};
    todasApolices.forEach(a => {
      if (!a.clienteId || !a.ramo) return;
      if (!clienteRamos[a.clienteId]) clienteRamos[a.clienteId] = new Set();
      clienteRamos[a.clienteId].add(a.ramo);
    });
    const dist: Record<number, number> = {};
    Object.values(clienteRamos).forEach(set => {
      const n = set.size;
      dist[n] = (dist[n] || 0) + 1;
    });
    return dist;
  }, [todasApolices]);

  // ── Ticket médio por ramo ────────────────────────────────────────────────
  const ticketPorRamo = useMemo(() => {
    const map: Record<string, number[]> = {};
    todasApolices.forEach(a => {
      if (a.premio <= 0 || !a.ramo) return;
      if (!map[a.ramo]) map[a.ramo] = [];
      map[a.ramo].push(a.premio);
    });
    return Object.entries(map)
      .map(([nome, premios]) => ({
        nome,
        ticket: premios.reduce((a, b) => a + b, 0) / premios.length,
        count: premios.length,
      }))
      .sort((a, b) => b.ticket - a.ticket)
      .slice(0, 10);
  }, [todasApolices]);

  const totalNegociosFiltrados = todasApolices.length;
  const totalClientesFiltrados = clientesFiltrados.length;

  // Cores para barras
  const BAR_COLORS = [
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
    'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500', 'bg-orange-500',
    'bg-amber-500', 'bg-yellow-500',
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart2 size={24} className="text-blue-600" />
              Dashboard Lookalike
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Perfil de marketing da carteira · {totalNegociosFiltrados.toLocaleString('pt-BR')} negócios · {totalClientesFiltrados.toLocaleString('pt-BR')} clientes
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Tipo */}
          <div className="flex items-center gap-1.5">
            <RefreshCw size={15} className="text-gray-400 shrink-0" />
            <select
              value={filtroTipo}
              onChange={e => setFiltroTipo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Renovação + Seguro Novo</option>
              <option value="renovacao">Apenas Renovação</option>
              <option value="seguro_novo">Apenas Seguro Novo</option>
            </select>
          </div>

          {/* Resultado */}
          <div className="flex items-center gap-1.5">
            <CheckCircle2 size={15} className="text-gray-400 shrink-0" />
            <select
              value={filtroResultado}
              onChange={e => setFiltroResultado(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Todos os resultados</option>
              <option value="fechado">Fechado / Renovado</option>
              <option value="perdido">Perdido / Não renovado</option>
            </select>
          </div>

          {/* Ramo */}
          <div className="flex items-center gap-1.5">
            <Briefcase size={15} className="text-gray-400 shrink-0" />
            <select
              value={filtroRamo}
              onChange={e => setFiltroRamo(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[180px]"
            >
              <option value="">Todos os ramos</option>
              {[...ramos].filter(r => r.ativo).sort((a, b) => a.nome.localeCompare(b.nome)).map(r => (
                <option key={r.id} value={r.nome}>{r.nome}</option>
              ))}
            </select>
          </div>

          {/* Chips de filtros ativos */}
          {(filtroTipo || filtroResultado || filtroRamo) && (
            <button
              onClick={() => { setFiltroTipo(''); setFiltroResultado(''); setFiltroRamo(''); }}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 border border-gray-300 hover:border-red-300 rounded-lg px-2.5 py-2 transition-colors"
            >
              <XCircle size={13} />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Users}     label="Clientes"         value={stats.total.toLocaleString('pt-BR')}   color="blue" />
        <KpiCard icon={UserCheck} label="Pessoa Física"    value={stats.pf.toLocaleString('pt-BR')}      sub={`${pct(stats.pf, stats.total)}% do total`} color="teal" />
        <KpiCard icon={Building2} label="Pessoa Jurídica"  value={stats.pj.toLocaleString('pt-BR')}      sub={`${pct(stats.pj, stats.total)}% do total`} color="purple" />
        <KpiCard icon={Star}      label="Idade Média (PF)" value={stats.idadeMedia !== null ? `${stats.idadeMedia} anos` : '—'} color="amber" />
        <KpiCard icon={DollarSign}label="Ticket Médio"     value={stats.ticketMedio !== null ? `R$ ${fmt(stats.ticketMedio)}` : '—'} color="green" />
        <KpiCard icon={TrendingUp}label="Carteira Total"   value={stats.totalPremios > 0 ? `R$ ${(stats.totalPremios / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}k` : '—'} color="rose" />
      </div>

      {/* Row 2: Sexo + Faixa etária */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <SectionCard title="Distribuição por Sexo (PF)" icon={Users}>
          {sexoDist.total === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem dados de pessoa física</p>
          ) : (
            <div className="space-y-2.5">
              <BarRow label="Masculino"    count={sexoDist.m}  total={sexoDist.total} color="bg-blue-500" />
              <BarRow label="Feminino"     count={sexoDist.f}  total={sexoDist.total} color="bg-pink-500" />
              <BarRow label="Não informado"count={sexoDist.ni} total={sexoDist.total} color="bg-gray-400" />
            </div>
          )}
        </SectionCard>

        <SectionCard title="Faixa Etária (PF)" icon={TrendingUp}>
          {faixaDist.total === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem dados de pessoa física</p>
          ) : (
            <div className="space-y-2">
              {FAIXAS_ORDER.map((faixa, i) => (
                <BarRow
                  key={faixa}
                  label={faixa}
                  count={faixaDist.map[faixa] || 0}
                  total={faixaDist.total}
                  color={BAR_COLORS[i % BAR_COLORS.length]}
                />
              ))}
              {faixaDist.semIdade > 0 && (
                <BarRow label="Sem data nasc." count={faixaDist.semIdade} total={faixaDist.total} color="bg-gray-300" />
              )}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Row 3: UF + Cidades */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <SectionCard title="Top 10 Estados (UF)" icon={Map}>
          {topUfs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem dados de UF</p>
          ) : (
            <div className="space-y-2">
              {topUfs.map(([uf, count], i) => (
                <BarRow key={uf} label={uf} count={count} total={totalClientesFiltrados} color={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Top 10 Cidades" icon={Map}>
          {topCidades.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem dados de cidade</p>
          ) : (
            <div className="space-y-2">
              {topCidades.map(([cidade, count], i) => (
                <BarRow key={cidade} label={cidade} count={count} total={totalClientesFiltrados} color={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Row 4: Ramos + Seguradoras */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <SectionCard title="Produtos Mais Comercializados (Ramos)" icon={Package}>
          {ramoDist.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem negócios encontrados</p>
          ) : (
            <div className="space-y-2">
              {ramoDist.map(([nome, count], i) => (
                <BarRow key={nome} label={nome} count={count} total={totalNegociosFiltrados} color={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Seguradoras Mais Usadas" icon={Building2}>
          {seguradoraDist.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem negócios encontrados</p>
          ) : (
            <div className="space-y-2">
              {seguradoraDist.map(([nome, count], i) => (
                <BarRow key={nome} label={nome} count={count} total={totalNegociosFiltrados} color={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Row 5: Ticket médio por ramo + Cross-sell */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        <SectionCard title="Ticket Médio por Produto (Top 10)" icon={DollarSign}>
          {ticketPorRamo.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem prêmios cadastrados</p>
          ) : (
            <div className="space-y-2">
              {ticketPorRamo.map(({ nome, ticket, count }, i) => (
                <div key={nome} className="flex items-center gap-2 text-sm">
                  <span className="w-28 shrink-0 truncate text-gray-700 text-xs">{nome}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]}`}
                      style={{ width: `${pct(ticket, ticketPorRamo[0].ticket)}%` }}
                    />
                  </div>
                  <span className="w-28 text-right text-xs text-gray-500 shrink-0">
                    R$ {fmt(ticket)} · {count}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Cross-sell — Ramos por Cliente" icon={Star}>
          {Object.keys(crossSell).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Sem negócios encontrados</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(crossSell)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([qtd, qtdClientes], i) => (
                  <BarRow
                    key={qtd}
                    label={`${qtd} ramo${Number(qtd) !== 1 ? 's' : ''}`}
                    count={qtdClientes}
                    total={Object.values(crossSell).reduce((a, b) => a + b, 0)}
                    color={BAR_COLORS[i % BAR_COLORS.length]}
                  />
                ))
              }
              <p className="text-xs text-gray-400 pt-1">
                Clientes com 2+ ramos distintos:{' '}
                <span className="font-semibold text-gray-600">
                  {Object.entries(crossSell).filter(([k]) => Number(k) >= 2).reduce((a, [, v]) => a + v, 0).toLocaleString('pt-BR')}
                </span>
              </p>
            </div>
          )}
        </SectionCard>
      </div>

    </div>
  );
}
