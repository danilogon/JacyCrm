import { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, PlusCircle, DollarSign, Target, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Renovacao, SeguroNovo, Usuario, Ramo, MotivoPerda, ConfiguracoesMetas } from '../types';
import { formatCurrency, formatPercent } from '../utils/formatters';
import {
  calcularTaxaConversaoRenovacoes,
  calcularTaxaConversaoSegurosNovos,
  calcularAumentoComissao,
  calcularRemuneracaoFaixa,
  ramoRecebeIndividual,
  ramoRecebeMeta,
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

function MetricCard({ label, value, sub, icon: Icon, color }: { label: string; value: string; sub?: string; icon: React.ElementType; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

export function Dashboard({ renovacoes, segurosNovos, usuarios, ramos, motivos, metas }: Props) {
  const { usuario } = useAuth();
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [responsavelId, setResponsavelId] = useState(
    usuario?.role === 'usuario' ? usuario.id : ''
  );

  const anos = useMemo(() => {
    const set = new Set<number>();
    [...renovacoes, ...segurosNovos].forEach(r => {
      const d = 'fimVigencia' in r ? r.fimVigencia : (r as SeguroNovo).inicioVigencia;
      if (d) set.add(new Date(d + 'T00:00:00').getFullYear());
    });
    if (!set.has(now.getFullYear())) set.add(now.getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [renovacoes, segurosNovos]);

  const usuariosVisiveis = useMemo(() => {
    if (usuario?.role === 'usuario') return usuarios.filter(u => u.id === usuario.id);
    return usuarios.filter(u => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [usuarios, usuario]);

  const filtrar = <T extends Renovacao | SeguroNovo>(items: T[], dateKey: 'fimVigencia' | 'inicioVigencia'): T[] => {
    return items.filter(item => {
      // Para seguros novos sem inicioVigencia (ex: criados via "Assumir Prospecção"),
      // usa criadoEm como fallback para não excluí-los dos cálculos de metas.
      const raw = item[dateKey as keyof T] as string;
      const d = raw || (item as SeguroNovo).criadoEm?.slice(0, 10) || '';
      if (!d) return false;
      const dt = new Date(d + 'T00:00:00');
      if (dt.getFullYear() !== ano || dt.getMonth() + 1 !== mes) return false;
      if (responsavelId && item.responsavelId !== responsavelId) return false;
      return true;
    });
  };

  const rv = filtrar(renovacoes, 'fimVigencia');
  const sn = filtrar(segurosNovos, 'inicioVigencia');

  const motivosRen = motivos.filter(m => m.tipo === 'negocio' && m.aplicaRenovacoes);
  const motivosSn = motivos.filter(m => m.tipo === 'negocio' && m.aplicaSegurosNovos);

  // Resolve antecipadamente se SN deve entrar na taxa de renovações (depende do plano do usuário)
  const _uParaMeta = responsavelId ? usuarios.find(u => u.id === responsavelId) : (usuario?.role === 'usuario' ? usuario : null);
  const _planoRen  = _uParaMeta?.recebeRemuneracaoRenovacoes
    ? (metas.planosRenovacao.find(p => p.id === _uParaMeta.planoMetaRenovacaoId) ?? metas.planosRenovacao[0] ?? null)
    : null;
  const considerarSnNaTaxa = _planoRen?.considerarSnNaTaxa ?? true;

  const taxaRen = calcularTaxaConversaoRenovacoes(rv, sn, ramos, motivosRen, considerarSnNaTaxa);
  const taxaSn = calcularTaxaConversaoSegurosNovos(sn, ramos, motivosSn);
  const aumentoComissao = calcularAumentoComissao(rv);

  const comissaoGeradaRen = rv.filter(r => r.status === 'renovado').reduce((s, r) => s + r.comissaoNova, 0);

  // Separa seguros novos fechados entre ramos com meta e ramos com remuneração individual
  const snFechados = sn.filter(s => s.status === 'fechado');
  const ramoByNome = (nome: string) => ramos.find(r => r.nome === nome);

  // Resolve o usuário para config de ramo
  const uConfig = responsavelId
    ? usuarios.find(u => u.id === responsavelId)
    : (usuario?.role === 'usuario' ? usuario : null);

  const comissaoGeradaSnMeta = snFechados
    .filter(s => uConfig ? ramoRecebeMeta(uConfig, ramoByNome(s.ramo)) : !(ramoByNome(s.ramo)?.remuneracaoIndividual ?? false))
    .reduce((acc, x) => acc + x.comissao, 0);
  const comissaoIndividualSn = snFechados
    .filter(s => uConfig ? ramoRecebeIndividual(uConfig, ramoByNome(s.ramo)) : (ramoByNome(s.ramo)?.remuneracaoIndividual ?? false))
    .reduce((acc, x) => acc + x.comissaoAReceber, 0);
  // Total bruto para exibição nos KPIs
  const comissaoGeradaSn = snFechados.reduce((s, x) => s + x.comissao, 0);

  // Resumo renovações
  const renovadas = rv.filter(r => r.status === 'renovado').length;
  const emAndamentoRen = rv.filter(r => r.status !== 'renovado' && r.status !== 'nao_renovada').length;
  const naoRenovadasConsideradas = rv.filter(r => {
    if (r.status !== 'nao_renovada') return false;
    const m = motivosRen.find(x => x.id === r.motivoPerdaId);
    return m?.considerarTaxaConversaoRenovacoes ?? true;
  }).length;
  const naoRenovadasNaoConsideradas = rv.filter(r => {
    if (r.status !== 'nao_renovada') return false;
    const m = motivosRen.find(x => x.id === r.motivoPerdaId);
    return !(m?.considerarTaxaConversaoRenovacoes ?? true);
  }).length;

  // Seguros elegíveis para a taxa de conversão (ramo considerarParaTaxaSegurosNovos = true)
  const snElegiveisTaxa = sn.filter(s => ramoByNome(s.ramo)?.considerarParaTaxaSegurosNovos ?? true);
  const temDadosTaxaSn = snElegiveisTaxa.length > 0;

  // Resumo seguros novos
  const fechados = sn.filter(s => s.status === 'fechado').length;
  const emAndamentoSn = sn.filter(s => s.status !== 'fechado' && s.status !== 'perdido').length;
  const perdidosConsiderados = sn.filter(s => {
    if (s.status !== 'perdido') return false;
    const m = motivosSn.find(x => x.id === s.motivoPerdaId);
    return m?.considerarTaxaConversaoSegurosNovos ?? true;
  }).length;
  const perdidosNaoConsiderados = sn.filter(s => {
    if (s.status !== 'perdido') return false;
    const m = motivosSn.find(x => x.id === s.motivoPerdaId);
    return !(m?.considerarTaxaConversaoSegurosNovos ?? true);
  }).length;

  // Metas
  const usuarioAtual = responsavelId ? usuarios.find(u => u.id === responsavelId) : null;
  // Para usuários comuns, sempre filtra pelo próprio ID → uParaMeta é o próprio usuário logado
  // Para admin/gestor sem filtro, não há responsável definido → metas ficam indisponíveis
  // (mostrar metas do admin sobre produção de todos seria conceitualmente incorreto)
  const metasDisponiveisParaRole = usuario?.role === 'usuario'
    ? (usuario.recebeRemuneracaoRenovacoes || usuario.recebeRemuneracaoSegurosNovos)
    : !!responsavelId; // admin/gestor só exibe metas quando um responsável está selecionado

  const exibirMetas = metasDisponiveisParaRole;
  const usuarioTemMetas = usuarioAtual
    ? (usuarioAtual.recebeRemuneracaoRenovacoes || usuarioAtual.recebeRemuneracaoSegurosNovos)
    : (usuario?.recebeRemuneracaoRenovacoes || usuario?.recebeRemuneracaoSegurosNovos) ?? false;

  // Resolver planos e flags: usuário selecionado no filtro, ou o próprio usuário logado (role=usuario)
  const uParaMeta = usuarioAtual ?? (usuario?.role === 'usuario' ? usuario : null);
  const planoRen = uParaMeta?.recebeRemuneracaoRenovacoes
    ? (metas.planosRenovacao.find(p => p.id === uParaMeta.planoMetaRenovacaoId) ?? metas.planosRenovacao[0] ?? null)
    : null;
  const planoSn = uParaMeta?.recebeRemuneracaoSegurosNovos
    ? (metas.planosSeguroNovo.find(p => p.id === uParaMeta.planoMetaSeguroNovoId) ?? metas.planosSeguroNovo[0] ?? null)
    : null;

  const ativaTaxaRen    = uParaMeta?.recebeRemuneracaoTaxaRenovacoes ?? true;
  const ativaAumento    = uParaMeta?.recebeRemuneracaoAumentoComissao ?? true;
  const ativaSnComissao = uParaMeta?.recebeRemuneracaoSnComissao ?? true;
  const ativaSnTaxa     = uParaMeta?.recebeRemuneracaoSnTaxa ?? true;

  const faixasTaxaRen   = (ativaTaxaRen    && planoRen) ? planoRen.taxaConversaoRenovacoes : [];
  const faixasAumento   = (ativaAumento    && planoRen) ? planoRen.aumentoComissao         : [];
  const faixasSnComissao = (ativaSnComissao && planoSn)  ? planoSn.segurosNovosPorComissao  : [];
  const faixasSnTaxa    = (ativaSnTaxa     && planoSn)  ? planoSn.segurosNovosPorTaxa      : [];

  const { remuneracao: remTaxaRen }    = calcularRemuneracaoFaixa(taxaRen,            faixasTaxaRen,    comissaoGeradaRen);
  const { remuneracao: remAumento }    = calcularRemuneracaoFaixa(aumentoComissao,   faixasAumento,    comissaoGeradaRen);
  const { remuneracao: remSnComissao } = calcularRemuneracaoFaixa(comissaoGeradaSnMeta, faixasSnComissao, comissaoGeradaSnMeta);
  const { remuneracao: remSnTaxa }     = calcularRemuneracaoFaixa(taxaSn,            faixasSnTaxa,     comissaoGeradaSnMeta);
  // comissaoIndividualSn é somada diretamente (não passa por faixas de meta)
  const remIndividualSn = (uParaMeta?.recebeRemuneracaoSegurosNovos ?? false) ? comissaoIndividualSn : 0;
  const totalRemuneracao = remTaxaRen + remAumento + remSnComissao + remSnTaxa + remIndividualSn;

  type StatusFaixa = 'recebendo' | 'atingida' | 'potencial';
  // 'recebendo' → atual está dentro desta faixa (ganhando este bônus agora)
  // 'atingida'  → atual ultrapassou o máximo desta faixa (passou por ela)
  // 'potencial' → atual ainda não chegou no mínimo desta faixa (meta futura)
  function statusFaixa(minimo: number, maximo: number | null, atual: number): StatusFaixa {
    if (atual >= minimo && (maximo === null || atual <= maximo)) return 'recebendo';
    if (maximo !== null && atual > maximo) return 'atingida';
    return 'potencial';
  }

  const badgeFaixa: Record<StatusFaixa, string> = {
    recebendo: 'bg-green-100 text-green-800',
    atingida: 'bg-blue-100 text-blue-800',
    potencial: 'bg-yellow-100 text-yellow-800',
  };
  const labelFaixa: Record<StatusFaixa, string> = {
    recebendo: 'RECEBENDO',
    atingida: 'Atingida',
    potencial: 'Potencial',
  };

  // Exibe o label do badge de potencial:
  // - tipo valor_fixo: sempre mostra o valor (R$500, independente da base)
  // - tipo percentual com base > 0: mostra o valor simulado (ex: R$15,00)
  // - tipo percentual com base = 0: mostra apenas "Potencial X%" (sem R$0,00 enganoso)
  function labelPotencial(f: { tipo: 'percentual' | 'valor_fixo'; valor: number }, base: number): string {
    if (f.tipo === 'valor_fixo') return `Potencial: ${formatCurrency(f.valor)}`;
    if (base > 0) return `Potencial: ${formatCurrency(base * (f.valor / 100))}`;
    return `Potencial: ${f.valor}% da comissão`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <select value={mes} onChange={e => setMes(+e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(+e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {usuario?.role !== 'usuario' && (
            <select value={responsavelId} onChange={e => setResponsavelId(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">Todos os responsáveis</option>
              {usuariosVisiveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Aviso de período sem dados */}
      {rv.length === 0 && sn.length === 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <span>
            Nenhum registro encontrado para <strong>{MESES[mes - 1]} {ano}</strong>.
            Verifique se o mês/ano selecionado coincide com as datas de vigência das renovações e seguros novos cadastrados.
          </span>
        </div>
      )}

      {/* Métricas principais */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <MetricCard label="Taxa Conv. Renovações" value={formatPercent(taxaRen)} icon={RefreshCw} color="bg-blue-700" />
        <MetricCard label="Taxa Conv. Seguros Novos" value={formatPercent(taxaSn)} icon={PlusCircle} color="bg-blue-600" />
        <MetricCard label="Aumento de Comissão" value={formatPercent(aumentoComissao)} icon={aumentoComissao >= 0 ? TrendingUp : TrendingDown} color={aumentoComissao >= 0 ? 'bg-green-600' : 'bg-red-500'} />
        <MetricCard label="Comissão Renovações" value={formatCurrency(comissaoGeradaRen)} icon={DollarSign} color="bg-blue-800" />
        <MetricCard label="Comissão Seg. Novos" value={formatCurrency(comissaoGeradaSn)} icon={DollarSign} color="bg-blue-900" />
      </div>

      {/* Resumos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <RefreshCw size={16} className="text-blue-700" />
            <h2 className="font-semibold text-gray-800">Renovações — {MESES[mes - 1]} {ano}</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Renovadas', value: renovadas, color: 'text-green-700 bg-green-50' },
              { label: 'Em andamento', value: emAndamentoRen, color: 'text-yellow-700 bg-yellow-50' },
              { label: 'Não renovadas (consideradas)', value: naoRenovadasConsideradas, color: 'text-red-700 bg-red-50' },
              { label: 'Não renovadas (não consideradas)', value: naoRenovadasNaoConsideradas, color: 'text-gray-600 bg-gray-50' },
              { label: 'Total registros', value: rv.length, color: 'text-blue-700 bg-blue-50' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100">
                <span className="text-sm text-gray-600">{row.label}</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <PlusCircle size={16} className="text-blue-700" />
            <h2 className="font-semibold text-gray-800">Seguros Novos — {MESES[mes - 1]} {ano}</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Fechados', value: fechados, color: 'text-green-700 bg-green-50' },
              { label: 'Em andamento', value: emAndamentoSn, color: 'text-yellow-700 bg-yellow-50' },
              { label: 'Perdidos (considerados)', value: perdidosConsiderados, color: 'text-red-700 bg-red-50' },
              { label: 'Perdidos (não considerados)', value: perdidosNaoConsiderados, color: 'text-gray-600 bg-gray-50' },
              { label: 'Total registros', value: sn.length, color: 'text-blue-700 bg-blue-50' },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100">
                <span className="text-sm text-gray-600">{row.label}</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${row.color}`}>{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metas e Remunerações — aviso quando admin/gestor sem responsável selecionado */}
      {usuario?.role !== 'usuario' && !responsavelId && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          <Target size={16} className="mt-0.5 shrink-0 text-blue-500" />
          <span>Selecione um <strong>responsável</strong> no filtro acima para visualizar as metas e remunerações individuais.</span>
        </div>
      )}

      {/* Metas e Remunerações */}
      {exibirMetas && usuarioTemMetas && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-blue-700" />
              <h2 className="font-semibold text-gray-800">Metas e Remunerações</h2>
            </div>
            <div className="text-sm text-gray-500">
              Total: <span className="font-bold text-blue-700">{formatCurrency(totalRemuneracao)}</span>
            </div>
          </div>

          {/* Badges dos planos ativos */}
          {(planoRen || planoSn) && (
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              {planoRen && <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">Renovações: <strong>{planoRen.nome}</strong></span>}
              {planoSn  && <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">Seguros Novos: <strong>{planoSn.nome}</strong></span>}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Taxa Conversão Renovações */}
            {ativaTaxaRen && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Taxa de Conversão Renovações ({formatPercent(taxaRen)})</div>
              {rv.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhuma renovação registrada neste período.</p>
              ) : (
              <div className="space-y-1.5">
                {faixasTaxaRen.map(f => {
                  const sf = statusFaixa(f.minimo, f.maximo, taxaRen);
                  return (
                    <div key={f.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-gray-600">
                        {formatPercent(f.minimo, 0)} – {f.maximo !== null ? formatPercent(f.maximo, 0) : 'Sem limite'}
                        <span className="ml-2 text-gray-400">
                          {f.tipo === 'percentual' ? `${f.valor}% da comissão` : formatCurrency(f.valor)}
                        </span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeFaixa[sf]}`}>
                        {sf === 'potencial' ? labelPotencial(f, comissaoGeradaRen) : labelFaixa[sf]}
                      </span>
                    </div>
                  );
                })}
                <div className="text-right text-sm text-blue-700 font-medium pt-1">Bônus: {formatCurrency(remTaxaRen)}</div>
              </div>
              )}
            </div>
            )}

            {/* Aumento de Comissão */}
            {ativaAumento && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Aumento de Comissão ({formatPercent(aumentoComissao)})</div>
              {rv.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhuma renovação registrada neste período.</p>
              ) : (
              <div className="space-y-1.5">
                {faixasAumento.map(f => {
                  const sf = statusFaixa(f.minimo, f.maximo, aumentoComissao);
                  return (
                    <div key={f.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-gray-600">
                        {formatPercent(f.minimo, 0)} – {f.maximo !== null ? formatPercent(f.maximo, 0) : 'Sem limite'}
                        <span className="ml-2 text-gray-400">
                          {f.tipo === 'percentual' ? `${f.valor}% da comissão` : formatCurrency(f.valor)}
                        </span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeFaixa[sf]}`}>
                        {sf === 'potencial' ? labelPotencial(f, comissaoGeradaRen) : labelFaixa[sf]}
                      </span>
                    </div>
                  );
                })}
                <div className="text-right text-sm text-blue-700 font-medium pt-1">Bônus: {formatCurrency(remAumento)}</div>
              </div>
              )}
            </div>
            )}

            {/* Seguros Novos por Comissão */}
            {ativaSnComissao && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Seguros Novos — Comissão Gerada ({formatCurrency(comissaoGeradaSnMeta)})</div>
              {comissaoIndividualSn > 0 && (
                <div className="text-xs text-gray-400 mb-2">
                  Produção para meta · <span className="text-purple-600">{formatCurrency(comissaoIndividualSn)} em ramos individuais (excluídos da meta)</span>
                </div>
              )}
              {sn.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Nenhum seguro novo registrado neste período.</p>
              ) : (
              <div className="space-y-1.5">
                {faixasSnComissao.map(f => {
                  const sf = statusFaixa(f.minimo, f.maximo, comissaoGeradaSnMeta);
                  return (
                    <div key={f.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-gray-600">
                        {formatCurrency(f.minimo)} – {f.maximo !== null ? formatCurrency(f.maximo) : 'Sem limite'}
                        <span className="ml-2 text-gray-400">
                          {f.tipo === 'percentual' ? `${f.valor}%` : formatCurrency(f.valor)}
                        </span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeFaixa[sf]}`}>
                        {sf === 'potencial' ? labelPotencial(f, comissaoGeradaSnMeta) : labelFaixa[sf]}
                      </span>
                    </div>
                  );
                })}
                <div className="text-right text-sm text-blue-700 font-medium pt-1">Bônus: {formatCurrency(remSnComissao)}</div>
              </div>
              )}
            </div>
            )}

            {/* Seguros Novos por Taxa */}
            {ativaSnTaxa && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Seguros Novos — Taxa de Conversão ({formatPercent(taxaSn)})</div>
              {!temDadosTaxaSn ? (
                <p className="text-sm text-gray-400 italic">
                  {sn.length === 0
                    ? 'Nenhum seguro novo registrado neste período.'
                    : 'Nenhum seguro neste período considera taxa de conversão (ramos excluídos).'}
                </p>
              ) : (
              <div className="space-y-1.5">
                {faixasSnTaxa.map(f => {
                  const sf = statusFaixa(f.minimo, f.maximo, taxaSn);
                  return (
                    <div key={f.id} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="text-gray-600">
                        {formatPercent(f.minimo, 0)} – {f.maximo !== null ? formatPercent(f.maximo, 0) : 'Sem limite'}
                        <span className="ml-2 text-gray-400">
                          {f.tipo === 'percentual' ? `${f.valor}%` : formatCurrency(f.valor)}
                        </span>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${badgeFaixa[sf]}`}>
                        {sf === 'potencial' ? labelPotencial(f, comissaoGeradaSnMeta) : labelFaixa[sf]}
                      </span>
                    </div>
                  );
                })}
                <div className="text-right text-sm text-blue-700 font-medium pt-1">Bônus: {formatCurrency(remSnTaxa)}</div>
              </div>
              )}
            </div>
            )}

            {/* Comissão individual por ramo (fora da meta) */}
            {remIndividualSn > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Seguros Novos — Comissão Individual por Ramo</div>
              <div className="space-y-1.5">
                {snFechados
                  .filter(s => uConfig ? ramoRecebeIndividual(uConfig, ramoByNome(s.ramo)) : (ramoByNome(s.ramo)?.remuneracaoIndividual ?? false))
                  .reduce<{ramo: string; comissaoAReceber: number}[]>((acc, s) => {
                    const ex = acc.find(a => a.ramo === s.ramo);
                    if (ex) { ex.comissaoAReceber += s.comissaoAReceber; return acc; }
                    return [...acc, { ramo: s.ramo, comissaoAReceber: s.comissaoAReceber }];
                  }, [])
                  .map(item => (
                    <div key={item.ramo} className="flex items-center justify-between text-sm py-1.5 px-3 rounded-lg bg-purple-50 border border-purple-100">
                      <div className="text-gray-700 font-medium">{item.ramo}</div>
                      <span className="text-xs font-semibold text-purple-700 px-2 py-0.5 rounded bg-purple-100">
                        {formatCurrency(item.comissaoAReceber)}
                      </span>
                    </div>
                  ))
                }
                <div className="text-right text-sm text-purple-700 font-medium pt-1">Total individual: {formatCurrency(remIndividualSn)}</div>
              </div>
            </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
