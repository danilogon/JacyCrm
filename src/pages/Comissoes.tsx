import { useMemo, useState } from 'react';
import { DollarSign, ChevronDown, ChevronRight, Star } from 'lucide-react';
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

interface ComissaoUsuario {
  usuario: Usuario;
  // indicadores
  taxaRen: number;
  taxaSn: number;
  aumentoComissao: number;
  comissaoGeradaRen: number;
  comissaoGeradaSnMeta: number;
  comissaoIndividualSn: number;
  // remunerações por componente
  remTaxaRen: number;
  remAumento: number;
  remSnComissao: number;
  remSnTaxa: number;
  remIndividual: number;
  total: number;
  // detalhes produção
  renovacoesCount: number;
  segurosNovosCount: number;
  planoRenNome: string | null;
  planoSnNome: string | null;
  // flags de quais metas o usuário recebe
  ativaTaxaRen: boolean;
  ativaAumento: boolean;
  ativaSnComissao: boolean;
  ativaSnTaxa: boolean;
  ativaIndividual: boolean;
}

function calcularParaUsuario(
  u: Usuario,
  renovacoes: Renovacao[],
  segurosNovos: SeguroNovo[],
  ramos: Ramo[],
  motivos: MotivoPerda[],
  metas: ConfiguracoesMetas,
  ano: number,
  mes: number,
): ComissaoUsuario {
  // Filtrar pelo usuário e mês/ano — mesma lógica do Dashboard
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

  const motivosRen = motivos.filter(m => m.tipo === 'negocio' && m.aplicaRenovacoes);
  const motivosSn  = motivos.filter(m => m.tipo === 'negocio' && m.aplicaSegurosNovos);
  const ramoByNome = (nome: string) => ramos.find(r => r.nome === nome);

  const planoRenAntecipado = u.recebeRemuneracaoRenovacoes
    ? (metas.planosRenovacao.find(p => p.id === u.planoMetaRenovacaoId) ?? null)
    : null;

  const taxaRen        = calcularTaxaConversaoRenovacoes(rv, sn, ramos, motivosRen, planoRenAntecipado?.considerarSnNaTaxa ?? true);
  const taxaSn         = calcularTaxaConversaoSegurosNovos(sn, ramos, motivosSn);
  const aumentoComissao = calcularAumentoComissao(rv);

  const comissaoGeradaRen = rv.filter(r => r.status === 'renovado').reduce((s, r) => s + r.comissaoNova, 0);

  const snFechados = sn.filter(s => s.status === 'fechado');
  const comissaoGeradaSnMeta = snFechados
    .filter(s => ramoRecebeMeta(u, ramoByNome(s.ramo)))
    .reduce((acc, x) => acc + x.comissao, 0);
  const comissaoIndividualSn = snFechados
    .filter(s => ramoRecebeIndividual(u, ramoByNome(s.ramo)))
    .reduce((acc, x) => acc + x.comissaoAReceber, 0);

  // Planos — mesma lógica do Dashboard
  const planoRen = u.recebeRemuneracaoRenovacoes
    ? (metas.planosRenovacao.find(p => p.id === u.planoMetaRenovacaoId) ?? null)
    : null;
  const planoSn = u.recebeRemuneracaoSegurosNovos
    ? (metas.planosSeguroNovo.find(p => p.id === u.planoMetaSeguroNovoId) ?? null)
    : null;

  const ativaTaxaRen    = !!(u.recebeRemuneracaoTaxaRenovacoes    && planoRen);
  const ativaAumento    = !!(u.recebeRemuneracaoAumentoComissao    && planoRen);
  const ativaSnComissao = !!(u.recebeRemuneracaoSnComissao         && planoSn);
  const ativaSnTaxa     = !!(u.recebeRemuneracaoSnTaxa             && planoSn);
  const ativaIndividual = u.recebeRemuneracaoSegurosNovos;

  const faixasTaxaRen    = ativaTaxaRen    ? planoRen!.taxaConversaoRenovacoes : [];
  const faixasAumento    = ativaAumento    ? planoRen!.aumentoComissao         : [];
  const faixasSnComissao = ativaSnComissao ? planoSn!.segurosNovosPorComissao  : [];
  const faixasSnTaxa     = ativaSnTaxa     ? planoSn!.segurosNovosPorTaxa      : [];

  const { remuneracao: remTaxaRen }    = calcularRemuneracaoFaixa(taxaRen,             faixasTaxaRen,    comissaoGeradaRen);
  const { remuneracao: remAumento }    = calcularRemuneracaoFaixa(aumentoComissao,      faixasAumento,    comissaoGeradaRen);
  const { remuneracao: remSnComissao } = calcularRemuneracaoFaixa(comissaoGeradaSnMeta, faixasSnComissao, comissaoGeradaSnMeta);
  const { remuneracao: remSnTaxa }     = calcularRemuneracaoFaixa(taxaSn,              faixasSnTaxa,     comissaoGeradaSnMeta);
  const remIndividual = ativaIndividual ? comissaoIndividualSn : 0;

  const total = remTaxaRen + remAumento + remSnComissao + remSnTaxa + remIndividual;

  return {
    usuario: u,
    taxaRen, taxaSn, aumentoComissao,
    comissaoGeradaRen, comissaoGeradaSnMeta, comissaoIndividualSn,
    remTaxaRen, remAumento, remSnComissao, remSnTaxa, remIndividual,
    total,
    renovacoesCount: rv.length,
    segurosNovosCount: sn.length,
    planoRenNome: planoRen?.nome ?? null,
    planoSnNome: planoSn?.nome ?? null,
    ativaTaxaRen, ativaAumento, ativaSnComissao, ativaSnTaxa, ativaIndividual,
  };
}

function Val({ v, zero = false }: { v: number; zero?: boolean }) {
  if (v === 0 && !zero) return <span className="text-gray-300">—</span>;
  return <span className={v > 0 ? 'text-green-700 font-semibold' : 'text-gray-500'}>{formatCurrency(v)}</span>;
}

export function Comissoes({ renovacoes, segurosNovos, usuarios, ramos, motivos, metas }: Props) {
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [apenasComComissao, setApenasComComissao] = useState(false);

  const anos = useMemo(() => {
    const s = new Set<number>();
    [...renovacoes, ...segurosNovos].forEach(r => {
      const d = 'fimVigencia' in r ? r.fimVigencia : (r as SeguroNovo).inicioVigencia;
      if (d) s.add(new Date(d + 'T00:00:00').getFullYear());
    });
    if (!s.has(now.getFullYear())) s.add(now.getFullYear());
    return [...s].sort((a, b) => b - a);
  }, [renovacoes, segurosNovos]);

  const usuariosAtivos = useMemo(() =>
    usuarios.filter(u => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome)),
    [usuarios]);

  const dados = useMemo(() =>
    usuariosAtivos.map(u => calcularParaUsuario(u, renovacoes, segurosNovos, ramos, motivos, metas, ano, mes)),
    [usuariosAtivos, renovacoes, segurosNovos, ramos, motivos, metas, ano, mes]);

  const totalGeral = useMemo(() => dados.reduce((s, d) => s + d.total, 0), [dados]);
  const totalPorComp = useMemo(() => ({
    taxaRen:    dados.reduce((s, d) => s + d.remTaxaRen, 0),
    aumento:    dados.reduce((s, d) => s + d.remAumento, 0),
    snComissao: dados.reduce((s, d) => s + d.remSnComissao, 0),
    snTaxa:     dados.reduce((s, d) => s + d.remSnTaxa, 0),
    individual: dados.reduce((s, d) => s + d.remIndividual, 0),
  }), [dados]);

  // Oculta sempre usuários sem nenhuma remuneração configurada ("sem metas").
  // O toggle "apenasComComissao" filtra adicionalmente quem tem total > 0 no período.
  const dadosFiltrados = useMemo(() => {
    const comPlano = dados.filter(d =>
      d.usuario.recebeRemuneracaoRenovacoes || d.usuario.recebeRemuneracaoSegurosNovos
    );
    return apenasComComissao ? comPlano.filter(d => d.total > 0) : comPlano;
  }, [dados, apenasComComissao]);

  const ROLE_LABEL: Record<string, string> = { admin: 'Admin', gestor: 'Gestor', usuario: 'Corretor' };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <DollarSign size={20} className="text-blue-700" />
          <h1 className="text-xl font-bold text-gray-900">Comissões a Pagar</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg bg-white cursor-pointer select-none text-sm text-gray-600 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={apenasComComissao}
              onChange={e => setApenasComComissao(e.target.checked)}
              className="accent-blue-600"
            />
            Apenas com comissão a receber
          </label>
          <select value={mes} onChange={e => setMes(+e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={ano} onChange={e => setAno(+e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            {anos.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      {/* KPI total */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total a Pagar', value: totalGeral, color: 'bg-blue-700' },
          { label: 'Taxa Conv. Ren.', value: totalPorComp.taxaRen, color: 'bg-blue-600' },
          { label: 'Aumento Com.', value: totalPorComp.aumento, color: 'bg-indigo-600' },
          { label: 'SN Comissão', value: totalPorComp.snComissao, color: 'bg-violet-600' },
          { label: 'SN Taxa Conv.', value: totalPorComp.snTaxa, color: 'bg-purple-600' },
          { label: 'Ramos Individuais', value: totalPorComp.individual, color: 'bg-fuchsia-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-xs font-medium mb-1 px-1.5 py-0.5 rounded w-fit ${k.value > 0 ? 'text-white ' + k.color : 'text-gray-400 bg-gray-100'}`}>
              {k.label}
            </div>
            <div className={`text-lg font-bold mt-1 ${k.value > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
              {formatCurrency(k.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600">Usuário</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Taxa Conv. Ren.</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Aumento Com.</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">SN Comissão</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">SN Taxa Conv.</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Ramos Indiv.</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 whitespace-nowrap">Total</th>
              <th className="px-2 py-3 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dadosFiltrados.map(d => {
              const exp = expandido === d.usuario.id;
              const temRemuneracao = d.usuario.recebeRemuneracaoRenovacoes || d.usuario.recebeRemuneracaoSegurosNovos;
              return (
                <>
                  <tr
                    key={d.usuario.id}
                    onClick={() => setExpandido(exp ? null : d.usuario.id)}
                    className={`cursor-pointer transition-colors ${exp ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-gray-800">{d.usuario.nome}</div>
                      <div className="text-gray-400 flex items-center gap-1">
                        <span>{ROLE_LABEL[d.usuario.role]}</span>
                        {!temRemuneracao && <span className="text-gray-300">· sem metas</span>}
                        {d.planoRenNome && <span className="text-blue-400">· {d.planoRenNome}</span>}
                        {d.planoSnNome && d.planoSnNome !== d.planoRenNome && <span className="text-indigo-400">· {d.planoSnNome}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right"><Val v={d.remTaxaRen} /></td>
                    <td className="px-3 py-2.5 text-right"><Val v={d.remAumento} /></td>
                    <td className="px-3 py-2.5 text-right"><Val v={d.remSnComissao} /></td>
                    <td className="px-3 py-2.5 text-right"><Val v={d.remSnTaxa} /></td>
                    <td className="px-3 py-2.5 text-right"><Val v={d.remIndividual} /></td>
                    <td className="px-3 py-2.5 text-right">
                      {d.total > 0
                        ? <span className="font-bold text-blue-700">{formatCurrency(d.total)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-2 py-2.5 text-center text-gray-400">
                      {exp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    </td>
                  </tr>

                  {/* Detalhe expandido */}
                  {exp && (
                    <tr key={`${d.usuario.id}-detail`} className="bg-blue-50/60">
                      <td colSpan={8} className="px-5 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

                          {/* Produção */}
                          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Produção no mês</div>
                            <Row label="Renovações na carteira" value={String(d.renovacoesCount)} />
                            <Row label="Seguros novos" value={String(d.segurosNovosCount)} />
                            <Row label="Comissão gerada (Ren.)" value={formatCurrency(d.comissaoGeradaRen)} />
                            <Row label="Comissão gerada (SN meta)" value={formatCurrency(d.comissaoGeradaSnMeta)} />
                            {d.comissaoIndividualSn > 0 && (
                              <Row label="Comissão indiv. (ramos)" value={formatCurrency(d.comissaoIndividualSn)} highlight />
                            )}
                          </div>

                          {/* Indicadores */}
                          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Indicadores</div>
                            <Row label="Taxa conv. renovações" value={formatPercent(d.taxaRen)} />
                            <Row label="Aumento de comissão" value={formatPercent(d.aumentoComissao)} />
                            <Row label="Taxa conv. seguros novos" value={formatPercent(d.taxaSn)} />
                          </div>

                          {/* Remunerações */}
                          <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-1">
                            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Remunerações</div>
                            {d.ativaTaxaRen    && <Row label="Taxa conv. renovações" value={formatCurrency(d.remTaxaRen)} highlight={d.remTaxaRen > 0} />}
                            {d.ativaAumento    && <Row label="Aumento de comissão"   value={formatCurrency(d.remAumento)} highlight={d.remAumento > 0} />}
                            {d.ativaSnComissao && <Row label="SN — comissão gerada"  value={formatCurrency(d.remSnComissao)} highlight={d.remSnComissao > 0} />}
                            {d.ativaSnTaxa     && <Row label="SN — taxa conversão"   value={formatCurrency(d.remSnTaxa)} highlight={d.remSnTaxa > 0} />}
                            {d.ativaIndividual && d.remIndividual > 0 && <Row label="Ramos individuais" value={formatCurrency(d.remIndividual)} highlight />}
                            {!temRemuneracao && <p className="text-xs text-gray-400 italic">Usuário sem plano de metas configurado.</p>}
                            <div className="border-t border-gray-100 pt-2 mt-2 flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">Total a pagar</span>
                              <span className="text-sm font-bold text-blue-700">{formatCurrency(d.total)}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}

            {/* Linha de total */}
            <tr className="bg-gray-50 border-t-2 border-gray-200">
              <td className="px-3 py-3 font-semibold text-gray-800">Total geral — {dadosFiltrados.length} usuário{dadosFiltrados.length !== 1 ? 's' : ''}</td>
              <td className="px-3 py-3 text-right font-semibold text-gray-700">{totalPorComp.taxaRen > 0 ? formatCurrency(totalPorComp.taxaRen) : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-3 text-right font-semibold text-gray-700">{totalPorComp.aumento > 0 ? formatCurrency(totalPorComp.aumento) : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-3 text-right font-semibold text-gray-700">{totalPorComp.snComissao > 0 ? formatCurrency(totalPorComp.snComissao) : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-3 text-right font-semibold text-gray-700">{totalPorComp.snTaxa > 0 ? formatCurrency(totalPorComp.snTaxa) : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-3 text-right font-semibold text-gray-700">{totalPorComp.individual > 0 ? formatCurrency(totalPorComp.individual) : <span className="text-gray-300">—</span>}</td>
              <td className="px-3 py-3 text-right font-bold text-blue-700 text-sm">{formatCurrency(totalGeral)}</td>
              <td />
            </tr>
          </tbody>
        </table>
        </div>

        {dadosFiltrados.length === 0 && (
          <div className="px-4 py-10 text-center text-gray-400 text-sm">
            <Star size={28} className="mx-auto mb-2 text-gray-300" />
            Nenhuma remuneração a pagar em {MESES[mes - 1]} {ano}.
          </div>
        )}
      </div>

      {/* Legenda */}
      <div className="text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100 px-4 py-3 space-y-1">
        <p className="font-medium text-gray-500">Como os valores são calculados</p>
        <p>Os valores são calculados com os <strong>mesmos critérios</strong> exibidos no Dashboard individual de cada usuário para o mês selecionado.</p>
        <p>• <strong>Taxa Conv. Ren.</strong>: bônus pela taxa de conversão de renovações · <strong>Aumento Com.</strong>: bônus pelo aumento da comissão média</p>
        <p>• <strong>SN Comissão</strong>: bônus pela comissão total gerada em seguros novos · <strong>SN Taxa Conv.</strong>: bônus pela taxa de conversão de seguros novos</p>
        <p>• <strong>Ramos Indiv.</strong>: comissão a receber de ramos com remuneração individual (fora da meta de produção mensal)</p>
      </div>
    </div>
  );
}

function Row({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-gray-500">{label}</span>
      <span className={highlight ? 'font-semibold text-green-700' : 'text-gray-700'}>{value}</span>
    </div>
  );
}
