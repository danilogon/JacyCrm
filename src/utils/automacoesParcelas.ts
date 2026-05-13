import type { Parcela, AutomacaoParcela, CondicaoAutomacao, CampoParcela, LogParcela } from '../types';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const CAMPO_LABEL: Record<string, string> = {
  status: 'Status', prorrogada: 'Prorrogada',
  dataProrrogacao: 'Data Prorrogação', dataLimite: 'Data Limite',
};

function diasEntre(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Normaliza string para comparação: remove acentos e converte para minúsculas.
 *  Ex.: "Débito" === "Debito" === "DEBITO" → todos viram "debito" */
function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

// Campos cujo valor é uma data YYYY-MM-DD (para habilitar diasOffset e comparação entre datas)
const CAMPOS_DATA_SET = new Set<CampoParcela>([
  'vencimento', 'ultima_atualizacao', 'data_limite', 'data_prorrogacao',
]);

function resolverCampo(p: Parcela, campo: CampoParcela, hoje: Date, ultimaImportData?: string): string | number | boolean {
  switch (campo) {
    case 'dias_apos_vencimento':  return diasEntre(new Date(p.vencimento + 'T00:00:00'), hoje);
    case 'dias_sem_import':       return diasEntre(new Date(p.ultimaAtualizacao + 'T00:00:00'), hoje);
    case 'status':                return p.status;
    case 'seguradora':            return p.seguradora;
    case 'ramo':                  return p.ramo ?? '';
    case 'forma_pagamento':       return p.formaPagamento;
    case 'valor_parcela':         return p.valorParcela;
    case 'prorrogada':            return p.prorrogada ?? false;
    case 'primeira_parcela':      return p.numeroParcela.trim().replace(/^0+/, '') === '1';
    case 'data_prorrogacao':      return p.dataProrrogacao ?? '';
    case 'vencimento':            return p.vencimento;
    case 'ultima_atualizacao':    return p.ultimaAtualizacao;
    case 'data_limite':           return p.dataLimite ?? '';
    case 'consta_ultimo_import':
      // true se a parcela apareceu no import mais recente
      return ultimaImportData ? p.ultimaAtualizacao === ultimaImportData : false;
    default:                      return '';
  }
}

function resolverAcaoData(valor: string, hoje: Date, p: Parcela): string {
  if (valor === 'limpar') return '';
  if (valor === 'hoje') return hoje.toISOString().slice(0, 10);
  if (valor === 'vencimento') return p.vencimento;
  // Relativo: "+N:base" (ex: "+5:vencimento", "+3:import", "+2:hoje")
  if (valor.startsWith('+')) {
    const [diasStr, base] = valor.slice(1).split(':');
    const dias = parseInt(diasStr, 10) || 0;
    let baseDate: Date;
    if (base === 'import') baseDate = new Date(p.ultimaAtualizacao + 'T00:00:00');
    else if (base === 'vencimento') baseDate = new Date(p.vencimento + 'T00:00:00');
    else baseDate = new Date(hoje);
    baseDate.setDate(baseDate.getDate() + dias);
    return baseDate.toISOString().slice(0, 10);
  }
  return valor; // data fixa YYYY-MM-DD
}

const CAMPOS_BOOLEANOS_SET = new Set<CampoParcela>(['prorrogada', 'primeira_parcela', 'consta_ultimo_import']);

function avaliarCondicaoBase(p: Parcela, cond: CondicaoAutomacao, hoje: Date, ultimaImportData?: string): boolean {
  const valor = resolverCampo(p, cond.campo, hoje, ultimaImportData);

  // Booleano: compara 'sim'/'nao' com o valor booleano
  if (CAMPOS_BOOLEANOS_SET.has(cond.campo)) {
    const boolValor = valor === true;
    const boolRef = cond.tipoValor === 'campo' && cond.valorCampo
      ? resolverCampo(p, cond.valorCampo, hoje, ultimaImportData) === true
      : cond.valor === 'sim';
    return cond.operador === 'igual' ? boolValor === boolRef : boolValor !== boolRef;
  }

  // Resolve o lado direito: campo dinâmico ou valor literal
  let refStr: string;
  let refNum: number;
  if (cond.tipoValor === 'campo' && cond.valorCampo) {
    const ref = resolverCampo(p, cond.valorCampo, hoje, ultimaImportData);
    refStr = String(ref);
    refNum = Number(ref);
    // Aplica diasOffset quando ambos os campos são datas
    if (cond.diasOffset && CAMPOS_DATA_SET.has(cond.campo) && CAMPOS_DATA_SET.has(cond.valorCampo)) {
      const d = new Date(refStr + 'T00:00:00');
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + cond.diasOffset);
        refStr = d.toISOString().slice(0, 10);
      }
    }
  } else {
    refStr = cond.valor;
    refNum = Number(cond.valor);
  }

  // Comparações de texto sem acento e sem case (ex: "ZURICH" === "Zurich", "Débito" === "Debito")
  const valorStr  = norm(String(valor));
  const refStrLow = norm(refStr);

  switch (cond.operador) {
    case 'igual':       return typeof valor === 'number' ? valor === refNum : valorStr === refStrLow;
    case 'diferente':   return typeof valor === 'number' ? valor !== refNum : valorStr !== refStrLow;
    case 'maior_que':   return typeof valor === 'number' ? valor > refNum  : valorStr > refStrLow;
    case 'menor_que':   return typeof valor === 'number' ? valor < refNum  : valorStr < refStrLow;
    case 'maior_igual': return typeof valor === 'number' ? valor >= refNum : valorStr >= refStrLow;
    case 'menor_igual': return typeof valor === 'number' ? valor <= refNum : valorStr <= refStrLow;
    default: return false;
  }
}

function avaliarCondicao(p: Parcela, cond: CondicaoAutomacao, hoje: Date, ultimaImportData?: string): boolean {
  const resultado = avaliarCondicaoBase(p, cond, hoje, ultimaImportData);
  return cond.negado ? !resultado : resultado;
}

export function aplicarAutomacoes(
  parcelas: Parcela[],
  automacoes: AutomacaoParcela[],
  dataReferencia?: string,
  ultimaImportData?: string,
): { parcelas: Parcela[]; totalAlteradas: number } {
  const hoje = new Date(dataReferencia ? dataReferencia + 'T00:00:00' : Date.now());
  hoje.setHours(0, 0, 0, 0);

  // Ordena por especificidade decrescente: conta quantas condições de seguradora
  // e ramo existem (com operador 'igual') — mais específica = roda primeiro.
  // Desempate pelo campo prioridade.
  function especificidade(a: AutomacaoParcela): number {
    const temSeguradora   = a.condicoes.some(c => c.campo === 'seguradora'     && c.operador === 'igual');
    const temRamo         = a.condicoes.some(c => c.campo === 'ramo'           && c.operador === 'igual');
    const temFormaPgto    = a.condicoes.some(c => c.campo === 'forma_pagamento' && c.operador === 'igual');
    // Mantém retrocompat com filtros legados
    return (temSeguradora || !!a.filtroSeguradora ? 1 : 0)
         + (temRamo       || !!a.filtroRamo       ? 1 : 0)
         + (temFormaPgto  || !!a.filtroFormaPagamento ? 1 : 0);
  }
  const ativas = [...automacoes]
    .filter(a => a.ativo)
    .sort((a, b) => {
      // 1º: "ao_criar" sempre antes de todos os outros tipos
      const aoCriarA = a.tipo === 'ao_criar' ? 0 : 1;
      const aoCriarB = b.tipo === 'ao_criar' ? 0 : 1;
      if (aoCriarA !== aoCriarB) return aoCriarA - aoCriarB;
      // 2º: dentro do mesmo grupo, mais específica primeiro
      const diff = especificidade(b) - especificidade(a);
      return diff !== 0 ? diff : a.prioridade - b.prioridade;
    });
  if (!ativas.length) return { parcelas, totalAlteradas: 0 };

  let totalAlteradas = 0;
  const agora = new Date().toISOString();

  const resultado = parcelas.map(p => {
    // Estado acumulado: cada automação vê o resultado das anteriores
    let current: Parcela = p;
    const logEntries: LogParcela[] = [];

    for (const auto of ativas) {
      // Filtros avaliados contra o estado atual (sem acento, sem case)
      if (auto.filtroSeguradora    && norm(current.seguradora)           !== norm(auto.filtroSeguradora))    continue;
      if (auto.filtroRamo          && norm(current.ramo ?? '')           !== norm(auto.filtroRamo))          continue;
      if (auto.filtroFormaPagamento && norm(current.formaPagamento ?? '') !== norm(auto.filtroFormaPagamento)) continue;

      let match = false;

      if (auto.tipo === 'ao_criar') {
        match = (current.status as string) === 'importada';
        if (match && auto.condicoes.length > 0) {
          let condMatch = avaliarCondicao(current, auto.condicoes[0], hoje, ultimaImportData);
          for (let i = 1; i < auto.condicoes.length; i++) {
            const op = auto.condicoes[i - 1].operadorProximo ?? auto.operadorLogico ?? 'E';
            const r  = avaliarCondicao(current, auto.condicoes[i], hoje, ultimaImportData);
            if (op === 'E') condMatch = condMatch && r;
            else            condMatch = condMatch || r;
          }
          match = condMatch;
        }
      } else if (auto.tipo === 'padrao_vencimento') {
        const venc = new Date(current.vencimento + 'T00:00:00');
        match = diasEntre(venc, hoje) >= (auto.diasAposVencimento ?? 0);
      } else if (auto.tipo === 'padrao_sem_import') {
        const venc = new Date(current.vencimento + 'T00:00:00');
        match = current.status === 'baixada_sistema' && diasEntre(venc, hoje) >= (auto.diasAntesSemImport ?? 0);
      } else {
        if (auto.condicoes.length === 0) continue;
        let matchResult = avaliarCondicao(current, auto.condicoes[0], hoje, ultimaImportData);
        for (let i = 1; i < auto.condicoes.length; i++) {
          const op = auto.condicoes[i - 1].operadorProximo ?? auto.operadorLogico ?? 'E';
          const condResult = avaliarCondicao(current, auto.condicoes[i], hoje, ultimaImportData);
          if (op === 'E') matchResult = matchResult && condResult;
          else matchResult = matchResult || condResult;
        }
        match = matchResult;
      }

      if (match) {
        const patch: Partial<Parcela> = {};

        if (auto.alterarStatus !== false && current.status !== auto.novoStatus) {
          patch.status = auto.novoStatus;
        }
        if (auto.acaoProrrogada === 'sim') patch.prorrogada = true;
        else if (auto.acaoProrrogada === 'nao') patch.prorrogada = false;
        if (auto.acaoDataProrrogacao) patch.dataProrrogacao = resolverAcaoData(auto.acaoDataProrrogacao, hoje, current);
        if (auto.acaoDataLimite)      patch.dataLimite      = resolverAcaoData(auto.acaoDataLimite, hoje, current);

        if (Object.keys(patch).length > 0) {
          const mudancas = Object.entries(patch).map(([campo, para]) => ({
            campo: CAMPO_LABEL[campo] ?? campo,
            de: String((current as unknown as Record<string, unknown>)[campo] ?? '—'),
            para: String(para ?? '—'),
          }));
          logEntries.push({
            id: uid(),
            data: agora,
            autor: 'Sistema',
            tipo: 'automacao',
            descricao: `Automação "${auto.nome}" aplicada`,
            mudancas,
          });
          // Atualiza estado para que a próxima automação veja as mudanças
          current = { ...current, ...patch };
        }
      }
    }

    // Retorna parcela com todas as mudanças acumuladas
    if (logEntries.length > 0) {
      totalAlteradas++;
      return {
        ...current,
        logs: [...(p.logs ?? []), ...logEntries],
        atualizadoEm: agora,
      };
    }
    return p;
  });

  return { parcelas: resultado, totalAlteradas };
}
