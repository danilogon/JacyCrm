import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Upload, Search, X, Save, Edit2,
  Link2, Paperclip, FileText, History, CheckCircle, Plus, Zap, Bell, ChevronRight, ChevronLeft, UserCheck,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Parcela, ImportacaoParcelas, Cliente, Observacao, ArquivoAnexo, StatusParcela, Ramo, AutomacaoParcela, ConfiguracaoEmpresa, FormaPagamento, LogParcela, Tarefa } from '../types';
import { TarefasPanel } from '../components/TarefasPanel';
import { aplicarAutomacoes } from '../utils/automacoesParcelas';
import { formatDate, generateId, abrirArquivoNoNavegador } from '../utils/formatters';
import { DateInput } from '../components/DateInput';

export const FORMAS_PAGAMENTO_PADRAO = ['Boleto', 'Cartão Seguradora', 'Crédito', 'Débito'];

interface Props {
  parcelas: Parcela[];
  setParcelas: (p: Parcela[]) => void;
  importacoesParcelas: ImportacaoParcelas[];
  setImportacoesParcelas: (i: ImportacaoParcelas[]) => void;
  clientes: Cliente[];
  setClientes: (c: Cliente[]) => void;
  ramos: Ramo[];
  automacoesParcelas: AutomacaoParcela[];
  empresa: ConfiguracaoEmpresa;
  formasPagamento: FormaPagamento[];
  podeImportarParcelas?: boolean;
  tarefas: Tarefa[];
  setTarefas: (t: Tarefa[]) => void;
}

// ─── Status ──────────────────────────────────────────────────────────────────

// Inclui mapeamento legado para dados existentes no banco
export const STATUS_PARCELA_LABELS: Record<string, string> = {
  // Novos
  importada:        'Importada',
  tratar:           'Tratar',
  em_tratativa:     'Em Tratativa',
  paga:          'Paga',
  desconsiderada:   'Desconsiderada',
  seguro_cancelado:     'Seguro Cancelado',
  aguardando_baixa: 'Aguardando Baixa',
  baixada_sistema:  'Baixa Automática',
  analise_critica:  'Análise Crítica',
  // Legado (dados antigos no banco)
  '':               'Importada',
  nao_tratada:      'Importada',
  em_tratamento:    'Em Tratativa',
  baixada:          'Paga',
  cancelado:        'Seguro Cancelado',
  desconsiderado:   'Desconsiderada',
};

const STATUS_CLS: Record<string, string> = {
  // Novos
  importada:        'bg-gray-100 text-gray-500',
  tratar:           'bg-amber-100 text-amber-700',
  em_tratativa:     'bg-blue-100 text-blue-700',
  paga:          'bg-green-100 text-green-700',
  desconsiderada:   'bg-gray-100 text-gray-500',
  seguro_cancelado:     'bg-red-100 text-red-700',
  aguardando_baixa: 'bg-cyan-100 text-cyan-700',
  baixada_sistema:  'bg-purple-100 text-purple-700',
  analise_critica:  'bg-orange-100 text-orange-700',
  // Legado
  '':               'bg-gray-100 text-gray-500',
  nao_tratada:      'bg-gray-100 text-gray-500',
  em_tratamento:    'bg-blue-100 text-blue-700',
  baixada:          'bg-green-100 text-green-700',
  cancelado:        'bg-red-100 text-red-700',
  desconsiderado:   'bg-gray-100 text-gray-500',
};

const STATUSES_EDITAVEIS: StatusParcela[] = [
  'analise_critica', 'desconsiderada', 'em_tratativa', 'importada', 'paga', 'seguro_cancelado', 'tratar',
];

// ─── Helpers de parse ─────────────────────────────────────────────────────────

function cleanHtml(s: string): string {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

function parseBrDate(s: string): string {
  // "10/03/2026" → "2026-03-10"
  const m = String(s).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function parseBrNumber(s: string): number {
  return parseFloat(String(s).replace(/\./g, '').replace(',', '.')) || 0;
}

/** Extract YYYY-MM-DD from filename like "06-05-2026.xlsx" */
function dateFromFilename(name: string): string {
  const m = name.match(/(\d{2})-(\d{2})-(\d{4})/);
  if (!m) return new Date().toISOString().split('T')[0];
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// ─── Prazo ───────────────────────────────────────────────────────────────────

/** Retorna dias restantes até dataLimite (negativo = vencido). null = sem dataLimite. */
function calcPrazo(dataLimite?: string): number | null {
  if (!dataLimite) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const limite = new Date(dataLimite + 'T00:00:00');
  return Math.round((limite.getTime() - hoje.getTime()) / 86_400_000);
}

const PRAZO_FAIXAS: { key: string; label: string }[] = [
  { key: 'vencido',  label: 'Vencido' },
  { key: 'hoje',     label: 'Hoje' },
  { key: '1_5',      label: '1–5 dias' },
  { key: '6_10',     label: '6–10 dias' },
  { key: '11_30',    label: '11–30 dias' },
  { key: 'mais_30',  label: '+30 dias' },
  { key: 'sem_prazo',label: 'Sem prazo' },
];

function prazoParaFaixa(prazo: number | null): string {
  if (prazo === null) return 'sem_prazo';
  if (prazo < 0)  return 'vencido';
  if (prazo === 0) return 'hoje';
  if (prazo <= 5)  return '1_5';
  if (prazo <= 10) return '6_10';
  if (prazo <= 30) return '11_30';
  return 'mais_30';
}

function PrazoBadge({ prazo }: { prazo: number | null }) {
  if (prazo === null) return <span className="text-gray-300 text-xs">—</span>;
  if (prazo < 0)  return <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Vencido</span>;
  if (prazo === 0) return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">Hoje</span>;
  if (prazo <= 5)  return <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{prazo}d</span>;
  if (prazo <= 10) return <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">{prazo}d</span>;
  if (prazo <= 30) return <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">{prazo}d</span>;
  return <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{prazo}d</span>;
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_PARCELA_LABELS[status] ?? status;
  const cls   = STATUS_CLS[status] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Parcelas({ parcelas, setParcelas, importacoesParcelas, setImportacoesParcelas, clientes, ramos, automacoesParcelas, empresa, formasPagamento, podeImportarParcelas = true, tarefas, setTarefas }: Props) {
  const { usuario } = useAuth();
  const location = useLocation();
  const navigateParcelas = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Opções de forma de pagamento (padrão + gerenciadas) ──────────────────
  const opcoesForma = useMemo(() => {
    const gerenciadas = formasPagamento.filter(f => f.ativo).map(f => f.nome);
    return [...new Set([...FORMAS_PAGAMENTO_PADRAO, ...gerenciadas])].sort();
  }, [formasPagamento]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | 'pendentes' | 'todas'>('pendentes');
  const [filtroP1, setFiltroP1] = useState(false);
  const [filtroSemVinculo, setFiltroSemVinculo] = useState(false);
  const [filtroSeguradora, setFiltroSeguradora] = useState('');
  const [filtroRamo, setFiltroRamo] = useState('');
  const [filtroVencDe, setFiltroVencDe] = useState('');
  const [filtroVencAte, setFiltroVencAte] = useState('');
  const [filtroPrazo, setFiltroPrazo] = useState<string[]>([]);
  const [ordenar, setOrdenar] = useState<string>('vencimento_asc');

  // ── Modal de edição ───────────────────────────────────────────────────────
  const [editando, setEditando] = useState<Parcela | null>(null);
  const [formStatus, setFormStatus] = useState<StatusParcela>('importada');
  const [formDataLimite, setFormDataLimite] = useState('');
  const [formRamo, setFormRamo] = useState('');
  const [formFormaPagamento, setFormFormaPagamento] = useState('');
  const [formValorParcela, setFormValorParcela] = useState('');
  const [formProrrogada, setFormProrrogada] = useState<boolean | undefined>(undefined);
  const [formDataProrrogacao, setFormDataProrrogacao] = useState('');
  const [novaObs, setNovaObs] = useState('');
  const [novosArquivos, setNovosArquivos] = useState<ArquivoAnexo[]>([]);

  // ── Modal de vínculo cliente ──────────────────────────────────────────────
  const [modalVinculo, setModalVinculo] = useState<Parcela | null>(null);
  const [buscaVinculo, setBuscaVinculo] = useState('');
  const [clienteVinculoSel, setClienteVinculoSel] = useState<Cliente | null>(null);

  // ── Auto-vínculo em lote ──────────────────────────────────────────────────
  type ResultadoAutoVinculo = { vinculadas: number; duplicados: string[]; naoEncontrados: string[] };
  const [resultadoAutoVinculo, setResultadoAutoVinculo] = useState<ResultadoAutoVinculo | null>(null);

  function autoVincularClientes() {
    // Monta índice nome → clientes (para detectar duplicatas)
    const porNome = new Map<string, Cliente[]>();
    for (const c of clientes) {
      const key = c.nome.trim();
      if (!porNome.has(key)) porNome.set(key, []);
      porNome.get(key)!.push(c);
    }

    let vinculadas = 0;
    const duplicados = new Set<string>();
    const naoEncontrados = new Set<string>();
    const agora = new Date().toISOString();

    const atualizadas = parcelas.map(p => {
      if (p.clienteId) return p; // já vinculada — não altera
      const nome = p.nomeCliente.trim();
      const encontrados = porNome.get(nome) ?? [];
      if (encontrados.length === 1) {
        vinculadas++;
        return { ...p, clienteId: encontrados[0].id, atualizadoEm: agora };
      }
      if (encontrados.length > 1) duplicados.add(nome);
      else naoEncontrados.add(nome);
      return p;
    });

    if (vinculadas > 0) setParcelas(atualizadas);
    setResultadoAutoVinculo({
      vinculadas,
      duplicados: [...duplicados].sort(),
      naoEncontrados: [...naoEncontrados].sort(),
    });
  }

  // ── Modal nova parcela manual ─────────────────────────────────────────────
  const formNovaParcVazio = {
    nomeCliente: '', apolice: '', numeroParcela: '',
    vencimento: '', valorParcela: '', seguradora: '', formaPagamento: '', ramo: '',
  };
  const [modalNovaParcela, setModalNovaParcela] = useState(false);
  const [formNovaParc, setFormNovaParc] = useState(formNovaParcVazio);
  const [clienteNovaSel, setClienteNovaSel] = useState<Cliente | null>(null);
  const [buscaClienteNova, setBuscaClienteNova] = useState('');

  // ── Histórico de imports ──────────────────────────────────────────────────
  const [showHistorico, setShowHistorico] = useState(false);
  const [historicoSel, setHistoricoSel] = useState<ImportacaoParcelas | null>(null);
  const [importResult, setImportResult] = useState<ImportacaoParcelas | null>(null);

  // ── Automações ───────────────────────────────────────────────────────────
  const [processando, setProcessando] = useState(false);
  const [ultimoProcessamento, setUltimoProcessamento] = useState<{total: number; data: string} | null>(null);

  function processarAutomacoes(parcelasBase = parcelas) {
    setProcessando(true);
    const { parcelas: novas, totalAlteradas } = aplicarAutomacoes(parcelasBase, automacoesParcelas);
    if (totalAlteradas > 0) setParcelas(novas);
    setUltimoProcessamento({ total: totalAlteradas, data: new Date().toLocaleString('pt-BR') });
    setProcessando(false);
    return novas;
  }

  // ── Execução automática diária ────────────────────────────────────────────
  const STORAGE_KEY = 'parcelas_automacoes_ultima_execucao';
  useEffect(() => {
    if (!automacoesParcelas.some(a => a.ativo)) return;
    if (!parcelas.length) return;
    const hoje = new Date().toISOString().slice(0, 10);
    const ultimaExecucao = localStorage.getItem(STORAGE_KEY);
    if (ultimaExecucao === hoje) return; // já rodou hoje
    processarAutomacoes();
    localStorage.setItem(STORAGE_KEY, hoje);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // roda só na montagem do componente

  // Abre card de parcela quando navegado a partir de Tarefas (state.openId)
  useEffect(() => {
    const openId = (location.state as { openId?: string } | null)?.openId;
    if (openId) {
      const p = parcelas.find(x => x.id === openId);
      if (p) abrirEdicao(p);
      navigateParcelas('/parcelas', { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dados derivados ───────────────────────────────────────────────────────
  const seguradoras = useMemo(() => {
    const s = new Set(parcelas.map(p => p.seguradora).filter(Boolean));
    return [...s].sort();
  }, [parcelas]);

  const ramosNasParcelas = useMemo(() => {
    const s = new Set(parcelas.map(p => p.ramo).filter((r): r is string => !!r));
    return [...s].sort();
  }, [parcelas]);

  // Primeira parcela: numeroParcela === '1' ou '01' (ignora zeros à esquerda)
  const isPrimeiraParc = (p: Parcela) => p.numeroParcela.trim().replace(/^0+/, '') === '1';

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return parcelas.filter(p => {
      if (filtroStatus === 'pendentes') {
        const s = p.status as string;
        // Novos + legado: excluir concluídos
        if (s === 'paga' || s === 'seguro_cancelado' || s === 'baixada_sistema' ||
            s === 'baixada' || s === 'cancelado') return false;
      } else if (filtroStatus !== 'todas') {
        if (p.status !== filtroStatus) return false;
      }
      if (filtroSeguradora && p.seguradora !== filtroSeguradora) return false;
      if (filtroRamo && p.ramo !== filtroRamo) return false;
      if (filtroP1) {
        if (!isPrimeiraParc(p)) return false;
        const s = p.status as string;
        if (s === 'paga' || s === 'seguro_cancelado' || s === 'baixada_sistema' ||
            s === 'desconsiderada' || s === 'baixada' || s === 'cancelado') return false;
      }
      if (filtroSemVinculo && p.clienteId) return false;
      if (filtroVencDe && p.vencimento < filtroVencDe) return false;
      if (filtroVencAte && p.vencimento > filtroVencAte) return false;
      if (filtroPrazo.length > 0) {
        const faixa = prazoParaFaixa(calcPrazo(p.dataLimite));
        if (!filtroPrazo.includes(faixa)) return false;
      }
      if (q && !p.nomeCliente.toLowerCase().includes(q) &&
               !p.apolice.toLowerCase().includes(q) &&
               !p.numeroParcela.toLowerCase().includes(q) &&
               !p.seguradora.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => {
      switch (ordenar) {
        case 'vencimento_desc': return b.vencimento.localeCompare(a.vencimento);
        case 'valor_asc':       return a.valorParcela - b.valorParcela;
        case 'valor_desc':      return b.valorParcela - a.valorParcela;
        case 'seguradora_asc':  return a.seguradora.localeCompare(b.seguradora, 'pt-BR');
        case 'status_asc':      return a.status.localeCompare(b.status, 'pt-BR');
        case 'prazo_asc': {
          const pa = calcPrazo(a.dataLimite), pb = calcPrazo(b.dataLimite);
          return (pa ?? 9999) - (pb ?? 9999);
        }
        case 'prazo_desc': {
          const pa = calcPrazo(a.dataLimite), pb = calcPrazo(b.dataLimite);
          return (pb ?? -9999) - (pa ?? -9999);
        }
        default: return a.vencimento.localeCompare(b.vencimento); // vencimento_asc
      }
    });
  }, [parcelas, filtroStatus, filtroSeguradora, filtroRamo, filtroVencDe, filtroVencAte, filtroPrazo, filtroP1, filtroSemVinculo, busca, ordenar]);

  // KPIs
  const kpis = useMemo(() => {
    const isConcluido = (s: string) =>
      s === 'paga' || s === 'seguro_cancelado' || s === 'baixada_sistema' ||
      s === 'baixada' || s === 'cancelado'; // legado
    const pendentes = parcelas.filter(p => !isConcluido(p.status as string));
    const valorAberto = pendentes.reduce((s, p) => s + p.valorParcela, 0);
    const tratar = pendentes.filter(p => p.status === 'tratar').length;
    const emTratativa = pendentes.filter(p => p.status === 'em_tratativa').length;
    const primeirasPendentes = pendentes.filter(p => isPrimeiraParc(p)).length;
    const prazoUrgente = pendentes.filter(p => {
      const prazo = calcPrazo(p.dataLimite);
      return prazo !== null && prazo >= 0 && prazo <= 3;
    }).length;
    return { tratar, emTratativa, valorAberto, primeirasPendentes, prazoUrgente };
  }, [parcelas]);

  // ── Importação XLSX ───────────────────────────────────────────────────────
  async function importarXLSX(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const dataImport = dateFromFilename(file.name);

    const reader = new FileReader();
    reader.onload = ev => {
      const data = new Uint8Array(ev.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: true }) as string[][];

      const dataRows = rows.slice(1); // skip header
      const chavesSeen = new Set<string>();
      const seguradorasConsideradas = new Set<string>();
      const seguradorasContagem: Record<string, number> = {};
      const linhasIgnoradas: { linha: number; motivo: string }[] = [];
      // true = protege seguradoras ausentes no import (padrão); false = marca baixada_sistema mesmo assim
      const proteger = empresa.protegerSeguradoraSemImport !== false;

      let totalNovas = 0, totalAtualizadas = 0;
      const idsNovas: string[] = [];
      const parcelasMap = new Map(parcelas.map(p => [p.chaveUnica, p]));
      const updated: Parcela[] = [];

      // Índice de vínculos já conhecidos: "apolice|seguradora" → clienteId
      const vinculoIndex = new Map<string, string>();
      parcelas.forEach(p => {
        if (p.clienteId) vinculoIndex.set(`${p.apolice}|${p.seguradora}`, p.clienteId);
      });

      dataRows.forEach((cols, idx) => {
        const lineNum = idx + 2;
        const [clienteRaw, apoliceRaw, parcelaRaw, dataRaw, totalRaw, seguradoraRaw, formaPgtoRaw] =
          cols.map(c => String(c ?? '').trim());

        const nomeCliente = cleanHtml(clienteRaw);
        const apolice     = apoliceRaw.trim();
        const numeroParcela = parcelaRaw.trim();
        const vencimento  = parseBrDate(dataRaw);
        const valorParcela = parseBrNumber(totalRaw);
        const seguradora  = seguradoraRaw.trim().toUpperCase() || 'DESCONHECIDA';
        const formaPagamento = formaPgtoRaw.trim();

        if (!nomeCliente) { linhasIgnoradas.push({ linha: lineNum, motivo: 'Cliente ausente' }); return; }
        if (!apolice)     { linhasIgnoradas.push({ linha: lineNum, motivo: `${nomeCliente} — Apólice ausente` }); return; }
        if (!numeroParcela){ linhasIgnoradas.push({ linha: lineNum, motivo: `${nomeCliente} — Parcela ausente` }); return; }
        if (!vencimento)  { linhasIgnoradas.push({ linha: lineNum, motivo: `${nomeCliente} — Data inválida` }); return; }

        const chave = `${apolice}_${numeroParcela}`;
        chavesSeen.add(chave);
        seguradorasConsideradas.add(seguradora);
        seguradorasContagem[seguradora] = (seguradorasContagem[seguradora] || 0) + 1;

        const existing = parcelasMap.get(chave);
        if (existing) {
          // Atualiza mas preserva campos do operador
          updated.push({
            ...existing,
            nomeCliente,
            apolice,
            numeroParcela,
            vencimento,
            valorParcela,
            seguradora,
            formaPagamento,
            ultimaAtualizacao: dataImport,
            atualizadoEm: new Date().toISOString(),
          });
          totalAtualizadas++;
        } else {
          // Nova parcela — herda vínculo de cliente se já existe para esta apólice+seguradora
          const clienteAutoId = vinculoIndex.get(`${apolice}|${seguradora}`);
          const agora = new Date().toISOString();
          const logImport: LogParcela = {
            id: generateId(),
            data: agora,
            autor: 'Sistema',
            tipo: 'importacao',
            descricao: `Parcela importada do arquivo ${file.name}`,
          };
          const nova: Parcela = {
            id: generateId(),
            chaveUnica: chave,
            primeiraAtualizacao: dataImport,
            ultimaAtualizacao: dataImport,
            nomeCliente,
            clienteId: clienteAutoId,
            apolice,
            numeroParcela,
            vencimento,
            valorParcela,
            seguradora,
            formaPagamento,
            status: 'importada',
            observacoes: [],
            logs: [logImport],
            criadoEm: agora,
            atualizadoEm: agora,
          };
          updated.push(nova);
          parcelasMap.set(chave, nova);
          idsNovas.push(nova.id);
          // Propaga o vínculo para próximas parcelas da mesma apólice neste import
          if (clienteAutoId) vinculoIndex.set(`${apolice}|${seguradora}`, clienteAutoId);
          totalNovas++;
        }
      });

      // Marcar baixadas: parcelas das seguradoras consideradas que NÃO apareceram
      // Configurações da empresa determinam o comportamento
      // Garante retrocompat: valor legado 'desconsiderada' cai em 'baixada_sistema'
      const statusAusente        = (empresa.statusAusenteImport === 'nao_alterar') ? 'nao_alterar' : 'baixada_sistema';
      const protegerDesc         = empresa.protegerDesconsideradaImport === true;
      const protegerPrimeiraParc = empresa.protegerPrimeiraParcelaImport === true;
      let totalBaixadas = 0;
      parcelas.forEach(p => {
        if (chavesSeen.has(p.chaveUnica)) return; // já está na lista atualizada
        if (!seguradorasConsideradas.has(p.seguradora)) {
          // Seguradora ausente do import
          if (proteger) {
            // Trata como erro de importação → não altera
            updated.push(p);
            return;
          }
          // Sem proteção: aplica regra de baixada mesmo para seguradoras ausentes
        }
        // Regra configurada como "não alterar" → preserva sempre
        if (statusAusente === 'nao_alterar') {
          updated.push(p);
          return;
        }
        // Seguradora veio no import mas esta parcela não apareceu
        const statusAtualStr = p.status as string;
        // Statuses que nunca são sobrescritos pela regra de baixada
        const isPrimeira = p.numeroParcela.trim().replace(/^0+/, '') === '1';
        const protegido =
          statusAtualStr === 'paga' ||
          statusAtualStr === 'seguro_cancelado' ||
          statusAtualStr === 'baixada_sistema' ||
          statusAtualStr === 'analise_critica' ||
          statusAtualStr === 'baixada' ||
          statusAtualStr === 'cancelado' ||
          (protegerDesc && statusAtualStr === 'desconsiderada') ||
          (protegerPrimeiraParc && isPrimeira);
        if (protegido) {
          updated.push(p);
          return;
        }
        // Sem data limite cadastrada → não altera (não é possível confirmar a baixa)
        if (!p.dataLimite) {
          updated.push(p);
          return;
        }
        // Determina novo status com base na data limite:
        // import < data limite → baixa automática (seguradora baixou dentro do prazo)
        // import >= data limite → análise crítica (prazo ultrapassado)
        const novoStatus: StatusParcela = dataImport < p.dataLimite
          ? (statusAusente as StatusParcela)
          : 'analise_critica';
        const agoraImp = new Date().toISOString();
        const logBaixa: LogParcela = {
          id: generateId(),
          data: agoraImp,
          autor: 'Sistema',
          tipo: 'importacao',
          descricao: `Status atualizado por importação: ${file.name}`,
          mudancas: [{ campo: 'Status', de: STATUS_PARCELA_LABELS[p.status as string] ?? p.status, para: STATUS_PARCELA_LABELS[novoStatus] }],
        };
        updated.push({
          ...p, status: novoStatus,
          logs: [...(p.logs ?? []), logBaixa],
          atualizadoEm: agoraImp,
        });
        totalBaixadas++;
      });

      const lote: ImportacaoParcelas = {
        id: generateId(),
        nomeArquivo: file.name,
        dataImport,
        seguradorasConsideradas: [...seguradorasConsideradas],
        seguradorasContagem,
        totalImportadas: dataRows.length - linhasIgnoradas.length,
        totalNovas,
        totalAtualizadas,
        totalBaixadas,
        totalIgnoradas: linhasIgnoradas.length,
        linhasIgnoradas,
        idsSalvos: idsNovas,
        criadoEm: new Date().toISOString(),
      };

      // Aplica automações imediatamente após o import
      const ativas = automacoesParcelas.filter(a => a.ativo);
      let parcelasFinais = updated;
      if (ativas.length > 0) {
        const { parcelas: comAuto } = aplicarAutomacoes(updated, automacoesParcelas);
        parcelasFinais = comAuto;
      }
      setParcelas(parcelasFinais);
      // Marca execução de hoje no localStorage para não duplicar na montagem
      localStorage.setItem('parcelas_automacoes_ultima_execucao', new Date().toISOString().slice(0, 10));
      setImportacoesParcelas([lote, ...importacoesParcelas]);
      setImportResult(lote);
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Edição de parcela ─────────────────────────────────────────────────────
  function abrirEdicao(p: Parcela) {
    setEditando(p);
    setFormStatus(p.status);
    setFormValorParcela(p.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    setFormDataLimite(p.dataLimite ?? '');
    setFormRamo(p.ramo ?? '');
    setFormFormaPagamento(p.formaPagamento ?? '');
    setFormProrrogada(p.prorrogada);
    setFormDataProrrogacao(p.dataProrrogacao ?? '');
    setNovaObs('');
    setNovosArquivos([]);
  }

  function salvarEdicao() {
    if (!editando) return;
    const agora = new Date().toISOString();

    // Detectar mudanças para o log
    const novoValor = parseFloat(formValorParcela.replace(/\./g, '').replace(',', '.')) || 0;
    const mudancas: LogParcela['mudancas'] = [];
    if (editando.status !== formStatus) {
      mudancas!.push({ campo: 'Status', de: STATUS_PARCELA_LABELS[editando.status as string] ?? editando.status, para: STATUS_PARCELA_LABELS[formStatus] ?? formStatus });
    }
    if (editando.valorParcela !== novoValor) {
      mudancas!.push({ campo: 'Valor', de: `R$ ${editando.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, para: `R$ ${novoValor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` });
    }
    if ((editando.dataLimite ?? '') !== formDataLimite) {
      mudancas!.push({ campo: 'Data Limite', de: editando.dataLimite ?? '—', para: formDataLimite || '—' });
    }
    if ((editando.ramo ?? '') !== formRamo) {
      mudancas!.push({ campo: 'Ramo', de: editando.ramo ?? '—', para: formRamo || '—' });
    }
    if ((editando.formaPagamento ?? '') !== formFormaPagamento) {
      mudancas!.push({ campo: 'Forma de Pagamento', de: editando.formaPagamento ?? '—', para: formFormaPagamento || '—' });
    }
    const prorrogStr = (v: boolean | undefined) => v === undefined ? 'N/A' : v ? 'Sim' : 'Não';
    if (editando.prorrogada !== formProrrogada) {
      mudancas!.push({ campo: 'Prorrogada', de: prorrogStr(editando.prorrogada), para: prorrogStr(formProrrogada) });
    }
    if ((editando.dataProrrogacao ?? '') !== formDataProrrogacao) {
      mudancas!.push({ campo: 'Data Prorrogação', de: editando.dataProrrogacao ?? '—', para: formDataProrrogacao || '—' });
    }

    const temObservacao = novaObs.trim() || novosArquivos.length > 0;
    const obs: Observacao[] = temObservacao
      ? [...editando.observacoes, {
          id: generateId(),
          texto: novaObs.trim(),
          autor: usuario?.nome ?? 'Sistema',
          data: agora,
          arquivos: novosArquivos,
        }]
      : editando.observacoes;

    // Criar entrada de log se houve mudanças ou observação
    const novoLog: LogParcela | null = (mudancas!.length > 0 || temObservacao) ? {
      id: generateId(),
      data: agora,
      autor: usuario?.nome ?? 'Usuário',
      tipo: 'edicao',
      descricao: mudancas!.length > 0
        ? `${mudancas!.length} campo(s) alterado(s)${temObservacao ? ' + observação' : ''}`
        : 'Observação adicionada',
      mudancas: mudancas!.length > 0 ? mudancas! : undefined,
    } : null;

    const updated: Parcela = {
      ...editando,
      status: formStatus,
      valorParcela: novoValor,
      dataLimite: formDataLimite || undefined,
      ramo: formRamo || undefined,
      formaPagamento: formFormaPagamento,
      prorrogada: formProrrogada,
      dataProrrogacao: formDataProrrogacao || undefined,
      observacoes: obs,
      logs: novoLog ? [...(editando.logs ?? []), novoLog] : (editando.logs ?? []),
      atualizadoEm: agora,
    };
    setParcelas(parcelas.map(p => p.id === updated.id ? updated : p));
    setEditando(null);
  }

  // ── Vínculo com cliente ───────────────────────────────────────────────────
  function confirmarVinculo() {
    if (!modalVinculo || !clienteVinculoSel) return;
    const parcelaAtualizada = { ...modalVinculo, clienteId: clienteVinculoSel.id, atualizadoEm: new Date().toISOString() };
    setParcelas(parcelas.map(p => p.id === modalVinculo.id ? parcelaAtualizada : p));
    // Atualiza editando para que salvarEdicao() não sobrescreva o clienteId recém-vinculado
    if (editando?.id === modalVinculo.id) setEditando(parcelaAtualizada);
    setModalVinculo(null);
    setBuscaVinculo('');
    setClienteVinculoSel(null);
  }

  function criarParcelaManual() {
    const { nomeCliente, apolice, numeroParcela, vencimento, valorParcela, seguradora, formaPagamento, ramo } = formNovaParc;
    if (!nomeCliente.trim() || !apolice.trim() || !numeroParcela.trim() || !vencimento) return;

    const chave = `${apolice.trim()}_${numeroParcela.trim()}`;
    const hoje  = new Date().toISOString().split('T')[0];
    const nova: Parcela = {
      id: generateId(),
      chaveUnica: chave,
      primeiraAtualizacao: hoje,
      ultimaAtualizacao: hoje,
      nomeCliente: nomeCliente.trim(),
      clienteId: clienteNovaSel?.id,
      apolice: apolice.trim(),
      numeroParcela: numeroParcela.trim(),
      vencimento,
      valorParcela: parseFloat(String(valorParcela).replace(/\./g, '').replace(',', '.')) || 0,
      seguradora: seguradora.trim().toUpperCase() || 'MANUAL',
      formaPagamento: formaPagamento.trim(),
      ramo: ramo.trim() || undefined,
      status: 'importada',
      observacoes: [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    setParcelas([...parcelas, nova]);
    setModalNovaParcela(false);
    setFormNovaParc(formNovaParcVazio);
    setClienteNovaSel(null);
    setBuscaClienteNova('');
  }

  function removerVinculo(parcelaId: string) {
    setParcelas(parcelas.map(p =>
      p.id === parcelaId ? { ...p, clienteId: undefined, atualizadoEm: new Date().toISOString() } : p
    ));
  }

  // ── Anexos ────────────────────────────────────────────────────────────────
  function handleAnexos(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const anexo: ArquivoAnexo = {
          id: generateId(),
          nome: file.name,
          tipo: file.type,
          tamanho: file.size,
          dataBase64: ev.target?.result as string,
        };
        setNovosArquivos(prev => [...prev, anexo]);
      };
      reader.readAsDataURL(file);
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Parcelas em Aberto</h1>
          <p className="text-sm text-gray-500 mt-0.5">Controle de follow up de pagamentos</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShowHistorico(v => !v); setHistoricoSel(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
          >
            <History size={14} /> Histórico
          </button>
          <button
            onClick={() => processarAutomacoes()}
            disabled={processando || automacoesParcelas.filter(a => a.ativo).length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            title={automacoesParcelas.filter(a => a.ativo).length === 0 ? 'Nenhuma automação ativa configurada' : 'Aplicar automações às parcelas'}
          >
            <Zap size={14} /> Processar Automações
          </button>
          <button
            onClick={() => { setResultadoAutoVinculo(null); autoVincularClientes(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            title="Vincula automaticamente parcelas a clientes com nome exatamente igual"
          >
            <UserCheck size={14} /> Vincular Clientes
          </button>
          <button
            onClick={() => { setModalNovaParcela(true); setFormNovaParc(formNovaParcVazio); setClienteNovaSel(null); setBuscaClienteNova(''); }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
          >
            <Plus size={14} /> Nova Parcela
          </button>
          {podeImportarParcelas && (
            <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 cursor-pointer">
              <Upload size={14} /> Importar XLSX
              <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={importarXLSX} />
            </label>
          )}
        </div>
      </div>

      {/* Resultado do último import */}
      {importResult && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <CheckCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-blue-800">
            <strong>{importResult.nomeArquivo}</strong> importado em {formatDate(importResult.dataImport)}.{' '}
            {importResult.totalNovas} novas · {importResult.totalAtualizadas} atualizadas · {importResult.totalBaixadas} baixadas sistema
            {importResult.totalIgnoradas > 0 && <span className="text-amber-700"> · {importResult.totalIgnoradas} ignoradas</span>}
          </div>
          <button onClick={() => setImportResult(null)} className="p-0.5 text-blue-400 hover:text-blue-700"><X size={14} /></button>
        </div>
      )}

      {/* Resultado do processamento de automações */}
      {ultimoProcessamento && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <CheckCircle size={16} className="text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-green-800">
            Automações processadas em {ultimoProcessamento.data}.{' '}
            {ultimoProcessamento.total > 0
              ? <> <strong>{ultimoProcessamento.total}</strong> parcela{ultimoProcessamento.total !== 1 ? 's' : ''} tiveram o status atualizado.</>
              : ' Nenhuma parcela foi alterada.'
            }
          </div>
          <button onClick={() => setUltimoProcessamento(null)} className="p-0.5 text-green-400 hover:text-green-700"><X size={14} /></button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Tratar',            value: kpis.tratar,        text: 'text-amber-700' },
          { label: 'Em Tratativa',      value: kpis.emTratativa,   text: 'text-blue-600' },
          { label: 'Valor em Aberto',   value: `R$ ${kpis.valorAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, text: 'text-green-700' },
          { label: '1ª Parcelas',       value: kpis.primeirasPendentes, text: 'text-amber-700', bell: true },
          { label: 'Prazo ≤ 3 dias',    value: kpis.prazoUrgente,  text: 'text-red-600' },
        ].map(k => (
          <div key={k.label} className={`bg-white rounded-xl border p-4 ${(k as { bell?: boolean }).bell && filtroP1 ? 'border-amber-400 bg-amber-50' : 'border-gray-200'}`}>
            <div className={`text-xs font-semibold mb-1 flex items-center gap-1 ${k.text}`}>
              {(k as { bell?: boolean }).bell && <Bell size={11} />}
              {k.label}
            </div>
            <div className="text-xl font-bold text-gray-900">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Histórico de imports */}
      {showHistorico && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {historicoSel && (
                <button onClick={() => setHistoricoSel(null)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mr-1">
                  <ChevronLeft size={15} /> Voltar
                </button>
              )}
              <span className="text-sm font-semibold text-gray-700">
                {historicoSel ? historicoSel.nomeArquivo : 'Histórico de Importações'}
              </span>
            </div>
            <button onClick={() => { setShowHistorico(false); setHistoricoSel(null); }}
              className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>

          {/* Lista de planilhas */}
          {!historicoSel && (
            importacoesParcelas.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">Nenhuma importação realizada.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {importacoesParcelas.map(imp => (
                  <button key={imp.id} onClick={() => setHistoricoSel(imp)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between group">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{imp.nomeArquivo}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {imp.seguradorasConsideradas.length} seguradora(s) · {imp.totalImportadas} parcelas
                        {imp.totalIgnoradas > 0 && <span className="text-amber-600"> · {imp.totalIgnoradas} ignoradas</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">{formatDate(imp.dataImport)}</span>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
                  </button>
                ))}
              </div>
            )
          )}

          {/* Detalhe da planilha selecionada */}
          {historicoSel && (
            <div className="px-4 py-3 text-sm space-y-3">
              {/* Resumo */}
              <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                <span><strong className="text-gray-700">{historicoSel.totalNovas}</strong> novas</span>
                <span><strong className="text-gray-700">{historicoSel.totalAtualizadas}</strong> atualizadas</span>
                <span><strong className="text-gray-700">{historicoSel.totalBaixadas}</strong> baixadas automáticas</span>
                {historicoSel.totalIgnoradas > 0 && (
                  <span className="text-amber-600"><strong>{historicoSel.totalIgnoradas}</strong> ignoradas</span>
                )}
              </div>

              {/* Tabela seguradora × parcelas */}
              {historicoSel.seguradorasConsideradas.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border border-gray-100 rounded">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="text-left px-3 py-2 font-semibold text-gray-500 border-b border-gray-100">Seguradora</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-500 border-b border-gray-100">Parcelas importadas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historicoSel.seguradorasConsideradas.sort().map(seg => (
                        <tr key={seg} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{seg}</td>
                          <td className="px-3 py-2 text-right text-gray-600 font-medium">
                            {historicoSel.seguradorasContagem?.[seg] ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Linhas ignoradas */}
              {historicoSel.linhasIgnoradas.length > 0 && (
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-gray-500 mb-1">Linhas ignoradas</div>
                  {historicoSel.linhasIgnoradas.map((l, i) => (
                    <div key={i} className="text-xs text-red-500">Linha {l.linha}: {l.motivo}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <input
            type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Cliente, apólice, seguradora..."
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="pendentes">Pendentes</option>
          <option value="todas">Todos</option>
          <option value="baixada_sistema">Baixa Automática</option>
          <option value="analise_critica">Análise Crítica</option>
          {STATUSES_EDITAVEIS.filter(s => s !== 'analise_critica').map(s => (
            <option key={s} value={s}>{STATUS_PARCELA_LABELS[s]}</option>
          ))}
        </select>
        <select value={filtroSeguradora} onChange={e => setFiltroSeguradora(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas as seguradoras</option>
          {seguradoras.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {ramosNasParcelas.length > 0 && (
          <select value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos os ramos</option>
            {ramosNasParcelas.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <span className="text-xs text-gray-400">Venc.</span>
          <DateInput value={filtroVencDe} onChange={e => setFiltroVencDe(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" />
          <span className="text-gray-400">–</span>
          <DateInput value={filtroVencAte} onChange={e => setFiltroVencAte(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" />
        </div>
        {/* Ordenação */}
        <select value={ordenar} onChange={e => setOrdenar(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="vencimento_asc">Vencimento ↑</option>
          <option value="vencimento_desc">Vencimento ↓</option>
          <option value="prazo_asc">Prazo ↑ (menor)</option>
          <option value="prazo_desc">Prazo ↓ (maior)</option>
          <option value="valor_asc">Valor ↑</option>
          <option value="valor_desc">Valor ↓</option>
          <option value="seguradora_asc">Seguradora A→Z</option>
          <option value="status_asc">Status A→Z</option>
        </select>
        {/* Filtro 1ª parcela */}
        <button
          onClick={() => setFiltroP1(v => !v)}
          title="Filtrar apenas primeiras parcelas pendentes"
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
            filtroP1
              ? 'bg-amber-500 text-white border-amber-500'
              : 'border-gray-300 text-gray-600 hover:border-amber-400 hover:text-amber-600'
          }`}
        >
          <Bell size={14} /> 1ª Parcela
        </button>
        {/* Filtro sem vínculo */}
        <button
          onClick={() => setFiltroSemVinculo(v => !v)}
          title="Filtrar apenas parcelas não vinculadas a clientes"
          className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm transition-colors ${
            filtroSemVinculo
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'border-gray-300 text-gray-600 hover:border-indigo-400 hover:text-indigo-600'
          }`}
        >
          <Link2 size={14} /> Sem vínculo
        </button>
        {(busca || filtroSeguradora || filtroRamo || filtroVencDe || filtroVencAte || filtroPrazo.length > 0 || filtroP1 || filtroSemVinculo) && (
          <button onClick={() => { setBusca(''); setFiltroSeguradora(''); setFiltroRamo(''); setFiltroVencDe(''); setFiltroVencAte(''); setFiltroPrazo([]); setFiltroP1(false); setFiltroSemVinculo(false); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="Limpar filtros">
            <X size={14} />
          </button>
        )}
        <span className="ml-auto text-sm text-gray-400 whitespace-nowrap">{filtered.length} registro(s)</span>

        {/* Filtro de Prazo (multi-seleção) */}
        <div className="w-full flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
          <span className="text-xs font-medium text-gray-400 whitespace-nowrap">Prazo:</span>
          {PRAZO_FAIXAS.map(({ key, label }) => {
            const ativo = filtroPrazo.includes(key);
            return (
              <button
                key={key}
                onClick={() => setFiltroPrazo(prev =>
                  prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
                )}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  ativo
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Vencimento','Cliente','Apólice / Parcela','Valor / Forma Pgto','Seguradora / Ramo','Status','Data Limite','Prazo',''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400 text-sm">Nenhuma parcela encontrada</td></tr>
              ) : filtered.map(p => {
                const prazo = calcPrazo(p.dataLimite);
                const clienteVinculado = p.clienteId ? clientes.find(c => c.id === p.clienteId) : null;
                return (
                  <tr key={p.id} onDoubleClick={() => abrirEdicao(p)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer select-none">
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-gray-700">
                      {formatDate(p.vencimento)}
                    </td>
                    <td className="px-3 py-2.5 max-w-[180px]">
                      <div className="font-medium text-gray-800 truncate" title={p.nomeCliente}>{p.nomeCliente}</div>
                      {clienteVinculado && (
                        <span className="inline-flex text-blue-400 mt-0.5" title={clienteVinculado.nome}>
                          <Link2 size={11} />
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">
                      {p.apolice}<br />
                      <span className="text-gray-400">Parc. {p.numeroParcela}</span>
                      {isPrimeiraParc(p) && (
                        <span className="ml-1.5 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold border border-amber-200">
                          <Bell size={9} /> 1ª
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-medium text-gray-800">
                        {p.valorParcela > 0 ? `R$ ${p.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{p.formaPagamento || '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="text-gray-700">{p.seguradora}</div>
                      {p.ramo && <div className="text-xs text-gray-400 mt-0.5">{p.ramo}</div>}
                    </td>
                    <td className="px-3 py-2.5"><StatusBadge status={p.status} /></td>
                    <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {p.dataLimite ? formatDate(p.dataLimite) : '—'}
                    </td>
                    <td className="px-3 py-2.5"><PrazoBadge prazo={prazo} /></td>
                    <td className="px-3 py-2.5">
                      <button onClick={e => { e.stopPropagation(); abrirEdicao(p); }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de edição */}
      {editando && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-gray-900">{editando.nomeCliente}</h2>
                <div className="text-xs text-gray-400 mt-0.5">
                  Apólice {editando.apolice} · Parc. {editando.numeroParcela} · {editando.seguradora}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setModalVinculo(editando)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
                  <Link2 size={13} /> Vincular cliente
                </button>
                <button onClick={() => setEditando(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {/* Infos da parcela */}
              <div className="grid grid-cols-3 gap-3 bg-gray-50 rounded-lg p-4 text-sm">
                <div><div className="text-xs text-gray-400 mb-0.5">Vencimento</div><div className="font-medium">{formatDate(editando.vencimento)}</div></div>
                <div>
                  <div className="text-xs text-gray-400 mb-0.5">Valor (R$)</div>
                  <input
                    value={formValorParcela}
                    onChange={e => setFormValorParcela(e.target.value)}
                    onBlur={e => {
                      const n = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.')) || 0;
                      setFormValorParcela(n.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
                    }}
                    className="w-full font-medium bg-white border border-gray-200 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div><div className="text-xs text-gray-400 mb-0.5">Chave Única</div><div className="font-mono text-xs text-gray-600">{editando.chaveUnica}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">1ª Atualização</div><div className="font-medium">{formatDate(editando.primeiraAtualizacao)}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Últ. Atualização</div><div className="font-medium">{formatDate(editando.ultimaAtualizacao)}</div></div>
                {editando.ramo && (
                  <div><div className="text-xs text-gray-400 mb-0.5">Ramo</div><div className="font-medium text-blue-700">{editando.ramo}</div></div>
                )}
                {editando.clienteId && (() => {
                  const cli = clientes.find(c => c.id === editando.clienteId);
                  return cli ? (
                    <div className="col-span-2">
                      <div className="text-xs text-gray-400 mb-0.5">Cliente Vinculado</div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-blue-700">{cli.nome}</span>
                        <button onClick={() => { removerVinculo(editando.id); setEditando({...editando, clienteId: undefined}); }}
                          className="text-red-400 hover:text-red-600 p-0.5 rounded" title="Remover vínculo">
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>

              {/* Status + Ramo + Forma Pagamento + Data Limite */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value as StatusParcela)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="baixada_sistema">Baixa Automática</option>
                    <option value="analise_critica">Análise Crítica</option>
                    {STATUSES_EDITAVEIS.filter(s => s !== 'analise_critica').map(s => (
                      <option key={s} value={s}>{STATUS_PARCELA_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                  <select value={formFormaPagamento} onChange={e => setFormFormaPagamento(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Não informada —</option>
                    {opcoesForma.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ramo</label>
                  <select value={formRamo} onChange={e => setFormRamo(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Sem ramo —</option>
                    {ramos.filter(r => r.ativo).map(r => (
                      <option key={r.id} value={r.nome}>{r.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Limite</label>
                  <DateInput value={formDataLimite} onChange={e => setFormDataLimite(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">Data máxima para pagamento.</p>
                </div>
              </div>

              {/* Prorrogação */}
              <div className="grid grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Desconsiderada na prorrogação</label>
                  <select
                    value={formProrrogada === undefined ? '' : formProrrogada ? 'sim' : 'nao'}
                    onChange={e => {
                      const v = e.target.value;
                      setFormProrrogada(v === '' ? undefined : v === 'sim');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">N/A (não informado)</option>
                    <option value="sim">Sim — desconsiderada</option>
                    <option value="nao">Não — considerada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Prorrogação</label>
                  <DateInput value={formDataProrrogacao} onChange={e => setFormDataProrrogacao(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              {/* Nova observação */}
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Nova Observação</label>
                <textarea
                  value={novaObs}
                  onChange={e => setNovaObs(e.target.value)}
                  placeholder="Descreva o contato, acordo ou qualquer informação relevante..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                {/* Anexos */}
                <div className="mt-2">
                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 text-sm text-gray-500 w-fit">
                    <Paperclip size={13} /> Anexar arquivo(s)
                    <input type="file" multiple className="hidden" onChange={e => handleAnexos(e.target.files)} />
                  </label>
                  {novosArquivos.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {novosArquivos.map((a, i) => (
                        <div key={a.id} className="flex items-center justify-between py-1 px-3 bg-gray-50 rounded text-xs border border-gray-100">
                          <span className="text-gray-700 truncate">{a.nome}</span>
                          <button onClick={() => setNovosArquivos(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-red-400 hover:text-red-600 ml-2"><X size={11} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Tarefas */}
              <div className="border-t border-gray-100 pt-4">
                <div className="text-sm font-semibold text-gray-700 mb-3">Tarefas / Agenda</div>
                <TarefasPanel
                  origemTipo="parcela"
                  origemId={editando.id}
                  nomeCliente={editando.nomeCliente}
                  responsavelId={usuario?.id ?? ''}
                  tarefas={tarefas}
                  setTarefas={setTarefas}
                />
              </div>

              {/* Log de atividades */}
              {(editando.logs ?? []).length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="text-sm font-semibold text-gray-700 mb-3">Log de Atividades</div>
                  <div className="space-y-2">
                    {[...(editando.logs ?? [])].reverse().map(log => (
                      <div key={log.id} className="bg-gray-50 rounded-lg px-3 py-2.5 border border-gray-100 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide text-[10px] ${
                              log.tipo === 'automacao' ? 'bg-purple-100 text-purple-700' :
                              log.tipo === 'importacao' ? 'bg-blue-100 text-blue-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {log.tipo === 'automacao' ? 'Automação' : log.tipo === 'importacao' ? 'Import' : 'Edição'}
                            </span>
                            <span className="font-medium text-gray-700">{log.autor}</span>
                          </div>
                          <span className="text-gray-400">
                            {new Date(log.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-gray-600">{log.descricao}</div>
                        {log.mudancas && log.mudancas.length > 0 && (
                          <div className="mt-1.5 space-y-1">
                            {log.mudancas.map((m, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-gray-500">
                                <span className="font-medium text-gray-600">{m.campo}:</span>
                                <span className="line-through text-red-400">{m.de}</span>
                                <span className="text-gray-400">→</span>
                                <span className="text-green-600 font-medium">{m.para}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Histórico de observações */}
              {editando.observacoes.length > 0 && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="text-sm font-semibold text-gray-700 mb-3">Histórico de Observações</div>
                  <div className="space-y-3">
                    {[...editando.observacoes].reverse().map(obs => (
                      <div key={obs.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-gray-600">{obs.autor}</span>
                          <span className="text-xs text-gray-400">{new Date(obs.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        {obs.texto && <p className="text-sm text-gray-700 whitespace-pre-wrap">{obs.texto}</p>}
                        {obs.arquivos?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {obs.arquivos.map(a => (
                              <div key={a.id} className="flex items-center gap-2">
                                <FileText size={11} className="text-blue-500 shrink-0" />
                                <button onClick={() => abrirArquivoNoNavegador(a.dataBase64, a.tipo)}
                                  className="text-xs text-blue-600 hover:underline truncate">{a.nome}</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => setEditando(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={salvarEdicao}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de nova parcela manual */}
      {modalNovaParcela && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Plus size={16} className="text-blue-600" /> Nova Parcela Manual
              </h2>
              <button onClick={() => setModalNovaParcela(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vincular a cliente cadastrado <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                {clienteNovaSel ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-blue-800">{clienteNovaSel.nome}</div>
                      <div className="text-xs text-blue-500">{clienteNovaSel.cpfCnpj}</div>
                    </div>
                    <button onClick={() => { setClienteNovaSel(null); setFormNovaParc(f => ({ ...f, nomeCliente: '' })); }}
                      className="p-0.5 text-blue-400 hover:text-blue-700 rounded"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text" value={buscaClienteNova}
                      onChange={e => setBuscaClienteNova(e.target.value)}
                      placeholder="Buscar por nome ou CPF/CNPJ..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {buscaClienteNova.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                        {clientes.filter(c =>
                          c.nome.toLowerCase().includes(buscaClienteNova.toLowerCase()) ||
                          c.cpfCnpj.includes(buscaClienteNova)
                        ).slice(0, 8).map(c => (
                          <button key={c.id} type="button"
                            onMouseDown={() => {
                              setClienteNovaSel(c);
                              setFormNovaParc(f => ({ ...f, nomeCliente: c.nome }));
                              setBuscaClienteNova('');
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0">
                            <div className="font-medium text-gray-800">{c.nome}</div>
                            <div className="text-xs text-gray-400">{c.cpfCnpj}</div>
                          </button>
                        ))}
                        {clientes.filter(c =>
                          c.nome.toLowerCase().includes(buscaClienteNova.toLowerCase()) ||
                          c.cpfCnpj.includes(buscaClienteNova)
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Nome do cliente no arquivo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome do cliente <span className="text-red-500">*</span>
                </label>
                <input
                  type="text" value={formNovaParc.nomeCliente}
                  onChange={e => setFormNovaParc(f => ({ ...f, nomeCliente: e.target.value }))}
                  placeholder="Nome como aparece na apólice"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Apólice + Parcela */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Apólice <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={formNovaParc.apolice}
                    onChange={e => setFormNovaParc(f => ({ ...f, apolice: e.target.value }))}
                    placeholder="Número da apólice"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Parcela <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text" value={formNovaParc.numeroParcela}
                    onChange={e => setFormNovaParc(f => ({ ...f, numeroParcela: e.target.value }))}
                    placeholder="Ex: 01/12"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Vencimento + Valor */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vencimento <span className="text-red-500">*</span>
                  </label>
                  <DateInput
                    value={formNovaParc.vencimento}
                    onChange={e => setFormNovaParc(f => ({ ...f, vencimento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor (R$)</label>
                  <input
                    type="text" value={formNovaParc.valorParcela}
                    onChange={e => setFormNovaParc(f => ({ ...f, valorParcela: e.target.value }))}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Seguradora + Forma de Pagamento */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seguradora</label>
                  <select
                    value={formNovaParc.seguradora}
                    onChange={e => setFormNovaParc(f => ({ ...f, seguradora: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Selecione —</option>
                    {seguradoras.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Forma de Pagamento</label>
                  <select
                    value={formNovaParc.formaPagamento}
                    onChange={e => setFormNovaParc(f => ({ ...f, formaPagamento: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Não informada —</option>
                    {opcoesForma.map(fp => <option key={fp} value={fp}>{fp}</option>)}
                  </select>
                </div>
              </div>

              {/* Ramo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ramo</label>
                <select
                  value={formNovaParc.ramo}
                  onChange={e => setFormNovaParc(f => ({ ...f, ramo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Sem ramo —</option>
                  {ramos.filter(r => r.ativo).map(r => (
                    <option key={r.id} value={r.nome}>{r.nome}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-gray-400">
                Campos marcados com <span className="text-red-500">*</span> são obrigatórios.
                A chave única será gerada como <span className="font-mono">{formNovaParc.apolice || 'apólice'}_{formNovaParc.numeroParcela || 'parcela'}</span>.
              </p>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => setModalNovaParcela(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button
                onClick={criarParcelaManual}
                disabled={!formNovaParc.nomeCliente.trim() || !formNovaParc.apolice.trim() || !formNovaParc.numeroParcela.trim() || !formNovaParc.vencimento}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50"
              >
                <Save size={14} /> Criar Parcela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de vínculo com cliente */}
      {modalVinculo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">Vincular a Cliente</h2>
              <button onClick={() => { setModalVinculo(null); setBuscaVinculo(''); setClienteVinculoSel(null); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600">
                Parcela: <span className="font-semibold">{modalVinculo.nomeCliente}</span> · {modalVinculo.chaveUnica}
              </div>
              <p className="text-xs text-gray-400">
                Ao vincular, esta parcela aparecerá na ficha do cliente selecionado.
                Não será criado nenhum cliente novo.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar cliente cadastrado</label>
                {clienteVinculoSel ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-blue-800">{clienteVinculoSel.nome}</span>
                    <button onClick={() => setClienteVinculoSel(null)} className="p-0.5 text-blue-400 hover:text-blue-700 rounded"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input type="text" value={buscaVinculo} onChange={e => setBuscaVinculo(e.target.value)}
                      placeholder="Nome ou CPF/CNPJ..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    {buscaVinculo.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
                        {clientes.filter(c =>
                          c.nome.toLowerCase().includes(buscaVinculo.toLowerCase()) ||
                          c.cpfCnpj.includes(buscaVinculo)
                        ).slice(0, 8).map(c => (
                          <button key={c.id} type="button"
                            onMouseDown={() => { setClienteVinculoSel(c); setBuscaVinculo(''); }}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0">
                            <div className="font-medium text-gray-800">{c.nome}</div>
                            <div className="text-xs text-gray-400">{c.cpfCnpj}</div>
                          </button>
                        ))}
                        {clientes.filter(c =>
                          c.nome.toLowerCase().includes(buscaVinculo.toLowerCase()) ||
                          c.cpfCnpj.includes(buscaVinculo)
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => { setModalVinculo(null); setBuscaVinculo(''); setClienteVinculoSel(null); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarVinculo} disabled={!clienteVinculoSel}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50">
                <Link2 size={14} /> Confirmar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal resultado auto-vínculo */}
      {resultadoAutoVinculo && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <UserCheck size={18} className="text-blue-600" /> Resultado — Vincular Clientes
              </h2>
              <button onClick={() => setResultadoAutoVinculo(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              {/* Vinculadas */}
              <div className={`flex items-center gap-3 px-4 py-3 rounded-lg ${resultadoAutoVinculo.vinculadas > 0 ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                <CheckCircle size={18} className={resultadoAutoVinculo.vinculadas > 0 ? 'text-green-600 shrink-0' : 'text-gray-300 shrink-0'} />
                <div>
                  <span className="font-semibold text-gray-800">{resultadoAutoVinculo.vinculadas}</span>
                  <span className="text-gray-600"> {resultadoAutoVinculo.vinculadas === 1 ? 'parcela vinculada' : 'parcelas vinculadas'} com sucesso</span>
                </div>
              </div>

              {/* Nomes duplicados no banco */}
              {resultadoAutoVinculo.duplicados.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-semibold text-amber-700 flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">{resultadoAutoVinculo.duplicados.length}</span>
                    Ignorados — nome duplicado no cadastro de clientes
                  </p>
                  <p className="text-xs text-gray-500">Há dois ou mais clientes com o mesmo nome. Faça o vínculo manualmente em cada parcela.</p>
                  <ul className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                    {resultadoAutoVinculo.duplicados.map(nome => (
                      <li key={nome} className="px-2 py-1 bg-amber-50 border border-amber-100 rounded text-xs text-amber-800 truncate">{nome}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Nomes não encontrados */}
              {resultadoAutoVinculo.naoEncontrados.length > 0 && (
                <div className="space-y-1.5">
                  <p className="font-semibold text-gray-500 flex items-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold">{resultadoAutoVinculo.naoEncontrados.length}</span>
                    Não encontrados no cadastro de clientes
                  </p>
                  <ul className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                    {resultadoAutoVinculo.naoEncontrados.map(nome => (
                      <li key={nome} className="px-2 py-1 bg-gray-50 border border-gray-100 rounded text-xs text-gray-600 truncate">{nome}</li>
                    ))}
                  </ul>
                </div>
              )}

              {resultadoAutoVinculo.vinculadas === 0 && resultadoAutoVinculo.duplicados.length === 0 && resultadoAutoVinculo.naoEncontrados.length === 0 && (
                <p className="text-gray-500 text-center py-2">Todas as parcelas já estão vinculadas a clientes.</p>
              )}
            </div>
            <div className="flex justify-end p-5 border-t border-gray-200">
              <button onClick={() => setResultadoAutoVinculo(null)}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
