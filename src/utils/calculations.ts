import type { Renovacao, SeguroNovo, Ramo, MotivoPerda, FaixaMeta } from '../types';

export function calcularComissaoAReceber(ramo: string, comissao: number, ramos: Ramo[]): number {
  const r = ramos.find(x => x.nome === ramo);
  if (!r) return 0;
  if (r.tipoComissaoSegurosNovos === 'percentual') return comissao * (r.percentualComissao / 100);
  return r.valorFixo;
}

export function calcularTaxaConversaoRenovacoes(
  renovacoes: Renovacao[],
  segurosNovos: SeguroNovo[],
  ramos: Ramo[],
  motivos: MotivoPerda[],
  considerarSnNaTaxa = true,
): number {
  const renovadas = renovacoes.filter(r => r.status === 'renovado').length;
  const snConsiderados = considerarSnNaTaxa
    ? segurosNovos.filter(s => {
        if (s.status !== 'fechado') return false;
        const r = ramos.find(x => x.nome === s.ramo);
        return r?.considerarParaTaxaConversao ?? true;
      }).length
    : 0;
  const perdas = renovacoes.filter(r => {
    if (r.status !== 'nao_renovada') return false;
    const m = motivos.find(x => x.id === r.motivoPerdaId);
    return m?.considerarTaxaConversaoRenovacoes ?? true;
  }).length;
  const denom = renovadas + snConsiderados + perdas;
  if (denom === 0) return 0;
  return ((renovadas + snConsiderados) / denom) * 100;
}

export function calcularTaxaConversaoSegurosNovos(
  segurosNovos: SeguroNovo[],
  ramos: Ramo[],
  motivos: MotivoPerda[]
): number {
  const considerados = segurosNovos.filter(s => {
    const r = ramos.find(x => x.nome === s.ramo);
    return r?.considerarParaTaxaSegurosNovos ?? true;
  });
  const fechados = considerados.filter(s => s.status === 'fechado').length;
  const perdidos = considerados.filter(s => {
    if (s.status !== 'perdido') return false;
    const m = motivos.find(x => x.id === s.motivoPerdaId);
    return m?.considerarTaxaConversaoSegurosNovos ?? true;
  }).length;
  const denom = fechados + perdidos;
  if (denom === 0) return 0;
  return (fechados / denom) * 100;
}

export function calcularAumentoComissao(renovacoes: Renovacao[]): number {
  const renovadas = renovacoes.filter(r => r.status === 'renovado');
  const totalNova = renovadas.reduce((s, r) => s + r.comissaoNova, 0);
  const totalAnt = renovadas.reduce((s, r) => s + r.comissaoAnterior, 0);
  if (totalNova === 0) return 0;
  return ((totalNova - totalAnt) / totalNova) * 100;
}

export function calcularRemuneracaoFaixa(valor: number, faixas: FaixaMeta[], baseCalculo: number): { remuneracao: number; faixa: FaixaMeta | null } {
  for (const faixa of faixas) {
    const dentro = valor >= faixa.minimo && (faixa.maximo === null || valor <= faixa.maximo);
    if (dentro) {
      const remuneracao = faixa.tipo === 'percentual' ? baseCalculo * (faixa.valor / 100) : faixa.valor;
      return { remuneracao, faixa };
    }
  }
  return { remuneracao: 0, faixa: null };
}
