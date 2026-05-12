import type { Parcela, AutomacaoParcela, CondicaoAutomacao, CampoParcela } from '../types';

function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function avaliarCondicao(p: Parcela, cond: CondicaoAutomacao, hoje: Date): boolean {
  let valor: string | number;
  switch (cond.campo as CampoParcela) {
    case 'dias_apos_vencimento': {
      const venc = new Date(p.vencimento + 'T00:00:00');
      valor = diasEntre(venc, hoje);
      break;
    }
    case 'dias_sem_import': {
      const ultima = new Date(p.ultimaAtualizacao + 'T00:00:00');
      valor = diasEntre(ultima, hoje);
      break;
    }
    case 'status':           valor = p.status; break;
    case 'seguradora':       valor = p.seguradora; break;
    case 'ramo':             valor = p.ramo ?? ''; break;
    case 'forma_pagamento':  valor = p.formaPagamento; break;
    case 'valor_parcela':    valor = p.valorParcela; break;
    default: return false;
  }

  const numRef = Number(cond.valor);
  switch (cond.operador) {
    case 'igual':       return String(valor) === cond.valor;
    case 'diferente':   return String(valor) !== cond.valor;
    case 'maior_que':   return typeof valor === 'number' && valor > numRef;
    case 'menor_que':   return typeof valor === 'number' && valor < numRef;
    case 'maior_igual': return typeof valor === 'number' && valor >= numRef;
    case 'menor_igual': return typeof valor === 'number' && valor <= numRef;
    default: return false;
  }
}

export function aplicarAutomacoes(
  parcelas: Parcela[],
  automacoes: AutomacaoParcela[],
  dataReferencia?: string,
): { parcelas: Parcela[]; totalAlteradas: number } {
  const hoje = new Date(dataReferencia ? dataReferencia + 'T00:00:00' : Date.now());
  hoje.setHours(0, 0, 0, 0);

  const ativas = [...automacoes].filter(a => a.ativo).sort((a, b) => a.prioridade - b.prioridade);
  if (!ativas.length) return { parcelas, totalAlteradas: 0 };

  let totalAlteradas = 0;
  const agora = new Date().toISOString();

  const resultado = parcelas.map(p => {
    for (const auto of ativas) {
      if (auto.filtroSeguradora && p.seguradora !== auto.filtroSeguradora) continue;
      if (auto.filtroRamo && p.ramo !== auto.filtroRamo) continue;

      let match = false;

      if (auto.tipo === 'padrao_vencimento') {
        const venc = new Date(p.vencimento + 'T00:00:00');
        const dias = diasEntre(venc, hoje);
        match = dias >= (auto.diasAposVencimento ?? 0);
      } else if (auto.tipo === 'padrao_sem_import') {
        const venc = new Date(p.vencimento + 'T00:00:00');
        const diasVenc = diasEntre(venc, hoje);
        const naoApareceu = p.status === 'baixada_sistema';
        match = naoApareceu && diasVenc >= (auto.diasAntesSemImport ?? 0);
      } else {
        if (auto.condicoes.length === 0) continue;
        const resultados = auto.condicoes.map(c => avaliarCondicao(p, c, hoje));
        match = auto.operadorLogico === 'E' ? resultados.every(Boolean) : resultados.some(Boolean);
      }

      if (match && p.status !== auto.novoStatus) {
        totalAlteradas++;
        return { ...p, status: auto.novoStatus, atualizadoEm: agora };
      }
    }
    return p;
  });

  return { parcelas: resultado, totalAlteradas };
}
