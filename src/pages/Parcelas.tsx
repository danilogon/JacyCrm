import { useState, useMemo, useRef } from 'react';
import {
  Upload, Search, X, Save, Edit2,
  Link2, Paperclip, FileText, History, CheckCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import type { Parcela, ImportacaoParcelas, Cliente, Observacao, ArquivoAnexo, StatusParcela } from '../types';
import { formatDate, generateId, abrirArquivoNoNavegador } from '../utils/formatters';
import { DateInput } from '../components/DateInput';

interface Props {
  parcelas: Parcela[];
  setParcelas: (p: Parcela[]) => void;
  importacoesParcelas: ImportacaoParcelas[];
  setImportacoesParcelas: (i: ImportacaoParcelas[]) => void;
  clientes: Cliente[];
  setClientes: (c: Cliente[]) => void;
}

// ─── Status ──────────────────────────────────────────────────────────────────

export const STATUS_PARCELA_LABELS: Record<StatusParcela, string> = {
  '':                'Não Tratada',
  nao_tratada:       'Não Tratada',
  em_tratamento:     'Em Tratamento',
  baixada:           'Parcela Baixada',
  cancelado:         'Seguro Cancelado',
  desconsiderado:    'Desconsiderado',
  aguardando_baixa:  'Aguardando Baixa',
  baixada_sistema:   'Baixada Sistema',
  analise_critica:   'Análise Crítica',
};

const STATUS_CLS: Record<StatusParcela, string> = {
  '':               'bg-gray-100 text-gray-500',
  nao_tratada:      'bg-gray-100 text-gray-600',
  em_tratamento:    'bg-amber-100 text-amber-700',
  baixada:          'bg-green-100 text-green-700',
  cancelado:        'bg-red-100 text-red-700',
  desconsiderado:   'bg-gray-100 text-gray-500',
  aguardando_baixa: 'bg-blue-100 text-blue-700',
  baixada_sistema:  'bg-purple-100 text-purple-700',
  analise_critica:  'bg-orange-100 text-orange-700',
};

const STATUSES_EDITAVEIS: StatusParcela[] = [
  '', 'nao_tratada', 'em_tratamento', 'baixada', 'cancelado',
  'desconsiderado', 'aguardando_baixa',
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

function StatusBadge({ status }: { status: StatusParcela }) {
  const label = STATUS_PARCELA_LABELS[status] ?? status;
  const cls   = STATUS_CLS[status] ?? 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Parcelas({ parcelas, setParcelas, importacoesParcelas, setImportacoesParcelas, clientes }: Props) {
  const { usuario } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusParcela | 'pendentes' | 'todas'>('pendentes');
  const [filtroSeguradora, setFiltroSeguradora] = useState('');
  const [filtroVencDe, setFiltroVencDe] = useState('');
  const [filtroVencAte, setFiltroVencAte] = useState('');
  const [filtroPrazo, setFiltroPrazo] = useState<string[]>([]);

  // ── Modal de edição ───────────────────────────────────────────────────────
  const [editando, setEditando] = useState<Parcela | null>(null);
  const [formStatus, setFormStatus] = useState<StatusParcela>('');
  const [formDataLimite, setFormDataLimite] = useState('');
  const [novaObs, setNovaObs] = useState('');
  const [novosArquivos, setNovosArquivos] = useState<ArquivoAnexo[]>([]);

  // ── Modal de vínculo cliente ──────────────────────────────────────────────
  const [modalVinculo, setModalVinculo] = useState<Parcela | null>(null);
  const [buscaVinculo, setBuscaVinculo] = useState('');
  const [clienteVinculoSel, setClienteVinculoSel] = useState<Cliente | null>(null);

  // ── Histórico de imports ──────────────────────────────────────────────────
  const [showHistorico, setShowHistorico] = useState(false);
  const [importResult, setImportResult] = useState<ImportacaoParcelas | null>(null);

  // ── Dados derivados ───────────────────────────────────────────────────────
  const seguradoras = useMemo(() => {
    const s = new Set(parcelas.map(p => p.seguradora).filter(Boolean));
    return [...s].sort();
  }, [parcelas]);

  const filtered = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return parcelas.filter(p => {
      if (filtroStatus === 'pendentes') {
        if (p.status === 'baixada' || p.status === 'baixada_sistema' || p.status === 'cancelado') return false;
      } else if (filtroStatus !== 'todas') {
        if (p.status !== filtroStatus) return false;
      }
      if (filtroSeguradora && p.seguradora !== filtroSeguradora) return false;
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
    }).sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  }, [parcelas, filtroStatus, filtroSeguradora, filtroVencDe, filtroVencAte, filtroPrazo, busca]);

  // KPIs
  const kpis = useMemo(() => {
    const pendentes = parcelas.filter(p => p.status !== 'baixada' && p.status !== 'baixada_sistema' && p.status !== 'cancelado');
    const baixadasSistema = parcelas.filter(p => p.status === 'baixada_sistema');
    const valorAberto = pendentes.reduce((s, p) => s + p.valorParcela, 0);
    const naoTratadas = pendentes.filter(p => p.status === '' || p.status === 'nao_tratada').length;
    return { pendentes: pendentes.length, baixadasSistema: baixadasSistema.length, valorAberto, naoTratadas };
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
      const linhasIgnoradas: { linha: number; motivo: string }[] = [];

      let totalNovas = 0, totalAtualizadas = 0;
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
            status: '',
            observacoes: [],
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          };
          updated.push(nova);
          parcelasMap.set(chave, nova);
          // Propaga o vínculo para próximas parcelas da mesma apólice neste import
          if (clienteAutoId) vinculoIndex.set(`${apolice}|${seguradora}`, clienteAutoId);
          totalNovas++;
        }
      });

      // Marcar baixadas sistema: parcelas das seguradoras consideradas que NÃO apareceram
      let totalBaixadas = 0;
      parcelas.forEach(p => {
        if (chavesSeen.has(p.chaveUnica)) return; // já está na lista atualizada
        if (!seguradorasConsideradas.has(p.seguradora)) {
          // seguradora não veio neste import → não marcar
          updated.push(p);
          return;
        }
        // Seguradora veio no import mas esta parcela não apareceu
        const statusAtual = p.status;
        // Se já está baixada/cancelada/análise crítica, só verificar data limite
        if (statusAtual === 'baixada' || statusAtual === 'cancelado' || statusAtual === 'baixada_sistema') {
          updated.push(p);
          return;
        }
        // Verificar se passou da data limite → análise crítica
        let novoStatus: StatusParcela = 'baixada_sistema';
        if (p.dataLimite && dataImport > p.dataLimite) {
          novoStatus = 'analise_critica';
        }
        updated.push({ ...p, status: novoStatus, atualizadoEm: new Date().toISOString() });
        totalBaixadas++;
      });

      const lote: ImportacaoParcelas = {
        id: generateId(),
        nomeArquivo: file.name,
        dataImport,
        seguradorasConsideradas: [...seguradorasConsideradas],
        totalImportadas: dataRows.length - linhasIgnoradas.length,
        totalNovas,
        totalAtualizadas,
        totalBaixadas,
        totalIgnoradas: linhasIgnoradas.length,
        linhasIgnoradas,
        criadoEm: new Date().toISOString(),
      };

      setParcelas(updated);
      setImportacoesParcelas([lote, ...importacoesParcelas]);
      setImportResult(lote);
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Edição de parcela ─────────────────────────────────────────────────────
  function abrirEdicao(p: Parcela) {
    setEditando(p);
    setFormStatus(p.status);
    setFormDataLimite(p.dataLimite ?? '');
    setNovaObs('');
    setNovosArquivos([]);
  }

  function salvarEdicao() {
    if (!editando) return;
    const obs: Observacao[] = (novaObs.trim() || novosArquivos.length > 0)
      ? [...editando.observacoes, {
          id: generateId(),
          texto: novaObs.trim(),
          autor: usuario?.nome ?? 'Sistema',
          data: new Date().toISOString(),
          arquivos: novosArquivos,
        }]
      : editando.observacoes;

    const updated: Parcela = {
      ...editando,
      status: formStatus,
      dataLimite: formDataLimite || undefined,
      observacoes: obs,
      atualizadoEm: new Date().toISOString(),
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
            onClick={() => setShowHistorico(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
          >
            <History size={14} /> Histórico
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 cursor-pointer">
            <Upload size={14} /> Importar XLSX
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={importarXLSX} />
          </label>
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

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pendentes', value: kpis.pendentes, color: 'bg-blue-700', text: 'text-blue-700' },
          { label: 'Não Tratadas', value: kpis.naoTratadas, color: 'bg-amber-500', text: 'text-amber-600' },
          { label: 'Valor em Aberto', value: `R$ ${kpis.valorAberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, color: 'bg-green-600', text: 'text-green-700' },
          { label: 'Baixadas Sistema', value: kpis.baixadasSistema, color: 'bg-purple-600', text: 'text-purple-700' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-xs font-semibold mb-1 ${k.text}`}>{k.label}</div>
            <div className="text-xl font-bold text-gray-900">{k.value}</div>
          </div>
        ))}
      </div>

      {/* Histórico de imports */}
      {showHistorico && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">Histórico de Importações</span>
            <button onClick={() => setShowHistorico(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          {importacoesParcelas.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 text-sm">Nenhuma importação realizada.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {importacoesParcelas.map(imp => (
                <div key={imp.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{imp.nomeArquivo}</span>
                    <span className="text-xs text-gray-400">{formatDate(imp.dataImport)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {imp.totalNovas} novas · {imp.totalAtualizadas} atualizadas · {imp.totalBaixadas} baixadas ·{' '}
                    {imp.totalIgnoradas} ignoradas
                    {imp.seguradorasConsideradas.length > 0 && (
                      <span> · Seguradoras: {imp.seguradorasConsideradas.join(', ')}</span>
                    )}
                  </div>
                  {imp.linhasIgnoradas.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {imp.linhasIgnoradas.map((l, i) => (
                        <div key={i} className="text-xs text-red-500">Linha {l.linha}: {l.motivo}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
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
          <option value="">Não Tratada</option>
          {STATUSES_EDITAVEIS.filter(s => s !== '').map(s => (
            <option key={s} value={s}>{STATUS_PARCELA_LABELS[s]}</option>
          ))}
          <option value="baixada_sistema">Baixada Sistema</option>
          <option value="analise_critica">Análise Crítica</option>
        </select>
        <select value={filtroSeguradora} onChange={e => setFiltroSeguradora(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todas as seguradoras</option>
          {seguradoras.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <span className="text-xs text-gray-400">Venc.</span>
          <DateInput value={filtroVencDe} onChange={e => setFiltroVencDe(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" />
          <span className="text-gray-400">–</span>
          <DateInput value={filtroVencAte} onChange={e => setFiltroVencAte(e.target.value)}
            className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-36" />
        </div>
        {(busca || filtroSeguradora || filtroVencDe || filtroVencAte || filtroPrazo.length > 0) && (
          <button onClick={() => { setBusca(''); setFiltroSeguradora(''); setFiltroVencDe(''); setFiltroVencAte(''); setFiltroPrazo([]); }}
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
                {['Vencimento','Cliente','Apólice / Parcela','Valor','Seguradora','Forma Pgto','Status','Data Limite','Prazo',''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400 text-sm">Nenhuma parcela encontrada</td></tr>
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
                      {p.apolice}<br /><span className="text-gray-400">Parc. {p.numeroParcela}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-800 font-medium">
                      {p.valorParcela > 0 ? `R$ ${p.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{p.seguradora}</td>
                    <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{p.formaPagamento || '—'}</td>
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
                <div><div className="text-xs text-gray-400 mb-0.5">Valor</div><div className="font-medium">R$ {editando.valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Forma Pagamento</div><div className="font-medium">{editando.formaPagamento || '—'}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Chave Única</div><div className="font-mono text-xs text-gray-600">{editando.chaveUnica}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">1ª Atualização</div><div className="font-medium">{formatDate(editando.primeiraAtualizacao)}</div></div>
                <div><div className="text-xs text-gray-400 mb-0.5">Últ. Atualização</div><div className="font-medium">{formatDate(editando.ultimaAtualizacao)}</div></div>
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

              {/* Status + Data Limite */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={formStatus} onChange={e => setFormStatus(e.target.value as StatusParcela)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {STATUSES_EDITAVEIS.map(s => (
                      <option key={s} value={s}>{STATUS_PARCELA_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data Limite</label>
                  <DateInput value={formDataLimite} onChange={e => setFormDataLimite(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">Data máxima para pagamento desta parcela.</p>
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
    </div>
  );
}
