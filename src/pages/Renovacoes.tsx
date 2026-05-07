import { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, Upload, Edit2, MessageSquare, X, Save, Search, UserCheck, AlertTriangle, Bell, Lock, Link2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import type { Renovacao, Prospeccao, StatusRenovacao, Usuario, Seguradora, Ramo, MotivoPerda, CampoCustomizavel, CampoCustomizadoValor, Cliente, Observacao, ArquivoAnexo, Tarefa, ImportacaoLote, ModeloEmail, EmailDisparo } from '../types';
import { ImportPreviewModal } from '../components/ImportPreviewModal';
import type { LinhaValida, LinhaInvalida } from '../components/ImportPreviewModal';
import { ObservacoesPanel } from '../components/ObservacoesPanel';
import { TarefasPanel } from '../components/TarefasPanel';
import { formatCurrency, formatPercent, formatDate, generateId, formatCpfCnpj, parseImportDate, parsePercent } from '../utils/formatters';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DateInput } from '../components/DateInput';

interface Props {
  renovacoes: Renovacao[];
  setRenovacoes: (r: Renovacao[]) => void;
  prospeccoes: Prospeccao[];
  setProspeccoes: (p: Prospeccao[]) => void;
  usuarios: Usuario[];
  seguradoras: Seguradora[];
  ramos: Ramo[];
  motivos: MotivoPerda[];
  camposCustomizaveis?: CampoCustomizavel[];
  clientes: Cliente[];
  setClientes: (c: Cliente[]) => void;
  tarefas: Tarefa[];
  setTarefas: (t: Tarefa[]) => void;
  importacoes: ImportacaoLote[];
  setImportacoes: (items: ImportacaoLote[]) => void;
  modelosEmail?: ModeloEmail[];
  emailsDisparo?: EmailDisparo[];
  setEmailsDisparo?: (items: EmailDisparo[]) => void;
}

const STATUS_LABELS: Record<StatusRenovacao, string> = {
  a_trabalhar: 'A Trabalhar', em_orcamento: 'Em Orçamento', em_negociacao: 'Em Negociação',
  vencidas: 'Vencida', a_transmitir: 'A Transmitir', pendente: 'Pendente',
  renovado: 'Renovado', nao_renovada: 'Não Renovada',
};

const STATUS_COLORS: Record<StatusRenovacao, string> = {
  a_trabalhar: 'bg-gray-100 text-gray-700',
  em_orcamento: 'bg-blue-100 text-blue-700',
  em_negociacao: 'bg-yellow-100 text-yellow-800',
  vencidas: 'bg-red-100 text-red-700',
  a_transmitir: 'bg-blue-100 text-blue-800',
  pendente: 'bg-orange-100 text-orange-700',
  renovado: 'bg-green-100 text-green-700',
  nao_renovada: 'bg-red-100 text-red-700',
};

const STATUS_FINAIS: StatusRenovacao[] = ['renovado', 'nao_renovada'];
const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function isVencida(r: Renovacao): boolean {
  const hoje = new Date().toISOString().split('T')[0];
  return r.fimVigencia < hoje && !STATUS_FINAIS.includes(r.status);
}

type FormState = {
  responsavelId: string;
  status: StatusRenovacao;
  seguradoraAnterior: string;
  premioAnterior: string;
  percentComissaoAnterior: string;
  seguradoraNova: string;
  premioNovo: string;
  percentComissaoNova: string;
  motivoPerdaId: string;
  novaObservacao: string;
  novosArquivos: ArquivoAnexo[];
  camposCustomizados: CampoCustomizadoValor[];
};

// ── Componente de busca de cliente ──────────────────────────────────────────
interface ClienteSearchProps {
  clientes: Cliente[];
  clienteSelecionado: Cliente | null;
  onSelect: (c: Cliente | null) => void;
}

function ClienteSearch({ clientes, clienteSelecionado, onSelect }: ClienteSearchProps) {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const resultados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (q.length < 2) return [];
    return clientes
      .filter(c =>
        c.nome.toLowerCase().includes(q) ||
        c.cpfCnpj.includes(q) ||
        c.email.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [busca, clientes]);

  if (clienteSelecionado) {
    return (
      <div className="flex items-center justify-between px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg">
        <div className="flex items-center gap-2">
          <UserCheck size={15} className="text-blue-600 shrink-0" />
          <div>
            <div className="text-sm font-medium text-blue-800">{clienteSelecionado.nome}</div>
            <div className="text-xs text-blue-500">{formatCpfCnpj(clienteSelecionado.cpfCnpj)} · {clienteSelecionado.email}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="p-1 text-blue-400 hover:text-blue-700 rounded"
          title="Remover cliente"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={busca}
          onChange={e => { setBusca(e.target.value); setAberto(true); }}
          onFocus={() => setAberto(true)}
          onBlur={() => setTimeout(() => setAberto(false), 150)}
          placeholder="Buscar por nome, CPF/CNPJ ou email..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      {aberto && resultados.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {resultados.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => { onSelect(c); setBusca(''); setAberto(false); }}
              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0"
            >
              <div className="font-medium text-gray-800">{c.nome}</div>
              <div className="text-xs text-gray-400">{formatCpfCnpj(c.cpfCnpj)} · {c.email}</div>
            </button>
          ))}
        </div>
      )}
      {aberto && busca.length >= 2 && resultados.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 px-3 py-2 text-sm text-gray-400">
          Nenhum cliente encontrado
        </div>
      )}
    </div>
  );
}

export function Renovacoes({ renovacoes, setRenovacoes, prospeccoes, setProspeccoes, usuarios, seguradoras, motivos, clientes, setClientes, tarefas, setTarefas, camposCustomizaveis, importacoes, setImportacoes, modelosEmail, emailsDisparo, setEmailsDisparo }: Props) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';
  const isGestor = usuario?.role === 'gestor';
  const camposAplicaveis = (camposCustomizaveis ?? []).filter(c =>
    c.ativo && ['renovacoes', 'ambos', 'todos'].includes(c.aplicavelA)
  );
  const location = useLocation();
  const navigateRen = useNavigate();

  const isCampoRestrito = (campo: string) => {
    if (!usuario || usuario.role === 'admin' || usuario.role === 'gestor') return false;
    return usuario.camposRestritos?.renovacoes?.includes(campo) ?? false;
  };

  type PreviewImport = {
    linhasValidas: LinhaValida[];
    linhasInvalidas: LinhaInvalida[];
    novas: Renovacao[];
    clientesAtualizados: Cliente[];
    idsClientesCriados: string[];
    nomeArquivo: string;
    respNaoEncontrados: string[];
  };
  const [previewImport, setPreviewImport] = useState<PreviewImport | null>(null);
  const [importando, setImportando] = useState(false);

  const now = new Date();
  const [filtroAno, setFiltroAno] = useState(now.getFullYear());
  const [filtroMes, setFiltroMes] = useState(now.getMonth() + 1);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroResp, setFiltroResp] = useState(usuario?.role === 'usuario' ? usuario.id : '');

  const [editando, setEditando] = useState<Renovacao | null>(null);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const isFinalizado = editando?.status === 'renovado' || editando?.status === 'nao_renovada';
  // Admin pode reeditar mesmo após renovado/não renovada
  const bloqueado = isFinalizado && !isAdmin;
  const [form, setForm] = useState<FormState>({
    responsavelId: '', status: 'a_trabalhar',
    seguradoraAnterior: '', premioAnterior: '', percentComissaoAnterior: '',
    seguradoraNova: '', premioNovo: '', percentComissaoNova: '',
    motivoPerdaId: '', novaObservacao: '', novosArquivos: [], camposCustomizados: [],
  });
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null);
  const [clienteVisualizando, setClienteVisualizando] = useState<Cliente | null>(null);
  const [clienteEditandoModal, setClienteEditandoModal] = useState<Cliente | null>(null);
  const [formCliEdit, setFormCliEdit] = useState<Partial<Cliente>>({});
  const [buscandoCepCli, setBuscandoCepCli] = useState(false);
  const [erroCepCli, setErroCepCli] = useState('');

  const anos = useMemo(() => {
    const set = new Set<number>();
    renovacoes.forEach(r => { if (r.fimVigencia) set.add(+r.fimVigencia.split('-')[0]); });
    if (!set.has(now.getFullYear())) set.add(now.getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [renovacoes]);

  const filtered = useMemo(() => {
    return renovacoes
      .filter(r => {
        if (!r.fimVigencia) return false;
        const [y, m] = r.fimVigencia.split('-').map(Number);
        if (y !== filtroAno) return false;
        if (filtroMes && m !== filtroMes) return false;
        if (filtroStatus === 'ativos') { if (r.status === 'renovado' || r.status === 'nao_renovada') return false; }
        else if (filtroStatus && r.status !== filtroStatus) return false;
        if (filtroResp && r.responsavelId !== filtroResp) return false;
        if (usuario?.role === 'usuario' && r.responsavelId !== usuario.id) return false;
        return true;
      })
      .sort((a, b) => a.fimVigencia.localeCompare(b.fimVigencia));
  }, [renovacoes, filtroAno, filtroMes, filtroStatus, filtroResp, usuario]);

  const usuariosVisiveis = useMemo(() =>
    usuarios.filter(u => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [usuarios]);

  const seguradOrd = useMemo(() =>
    seguradoras.filter(s => s.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [seguradoras]);

  function abrirEdicao(r: Renovacao) {
    // pré-selecionar cliente vinculado, se existir
    const cliVinc = clientes.find(c => c.id === r.clienteId || c.cpfCnpj === r.cpfCnpjCliente) ?? null;
    setClienteEditando(cliVinc);
    setForm({
      responsavelId: r.responsavelId,
      status: r.status,
      seguradoraAnterior: r.seguradoraAnterior,
      premioAnterior: r.premioAnterior ? String(r.premioAnterior) : '',
      percentComissaoAnterior: r.percentComissaoAnterior ? String(r.percentComissaoAnterior) : '',
      seguradoraNova: r.seguradoraNova,
      premioNovo: r.premioNovo ? String(r.premioNovo) : '',
      percentComissaoNova: r.percentComissaoNova ? String(r.percentComissaoNova) : '',
      motivoPerdaId: r.motivoPerdaId ?? '',
      novaObservacao: '', novosArquivos: [], camposCustomizados: r.camposCustomizados ?? [],
    });
    setEditando(r);
  }

  // Abrir registro via navegação (ex: duplo clique em Clientes)
  useEffect(() => {
    const openId = (location.state as { openId?: string } | null)?.openId;
    if (openId) {
      const r = renovacoes.find(x => x.id === openId);
      if (r) abrirEdicao(r);
      navigateRen('/renovacoes', { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function calcular(premioStr: string, percentStr: string, comissaoAnt: number) {
    const premio = parseFloat(premioStr) || 0;
    const percent = parseFloat(percentStr) || 0;
    const comissaoNova = premio * percent / 100;
    const resultado = comissaoNova - comissaoAnt;
    return { comissaoNova, resultado };
  }

  function salvar() {
    if (!editando) return;
    // Negócio finalizado e sem permissão de admin: apenas salvar observação
    if (bloqueado) {
      if (form.novaObservacao.trim() || form.novosArquivos.length > 0) {
        const obs = [...editando.observacoes, { id: generateId(), texto: form.novaObservacao.trim(), autor: usuario?.nome ?? '', data: new Date().toISOString(), arquivos: form.novosArquivos }];
        setRenovacoes(renovacoes.map(r => r.id === editando.id ? { ...editando, observacoes: obs, atualizadoEm: new Date().toISOString() } : r));
      }
      setEditando(null); setClienteEditando(null);
      return;
    }
    if (form.status === 'renovado') {
      const erros: string[] = [];
      if (!form.seguradoraNova) erros.push('Seguradora Nova');
      if (!(parseFloat(form.premioNovo) > 0)) erros.push('Prêmio Novo');
      if (!(parseFloat(form.percentComissaoNova) > 0)) erros.push('% Comissão Nova');
      if (erros.length > 0) {
        alert(`Para concluir como "Renovado", preencha os campos obrigatórios:\n• ${erros.join('\n• ')}`);
        return;
      }
    }
    if (form.status === 'nao_renovada' && !form.motivoPerdaId) {
      alert('Selecione o motivo de perda para "Não Renovada".');
      return;
    }
    const premioAnt = parseFloat(form.premioAnterior) || 0;
    const percentAnt = parseFloat(form.percentComissaoAnterior) || 0;
    const comissaoAnteriorCalc = premioAnt * percentAnt / 100;
    const naoRenovada = form.status === 'nao_renovada';
    const { comissaoNova, resultado } = naoRenovada
      ? { comissaoNova: 0, resultado: 0 }
      : calcular(form.premioNovo, form.percentComissaoNova, comissaoAnteriorCalc);
    const obs: Observacao[] = (form.novaObservacao.trim() || form.novosArquivos.length > 0)
      ? [...editando.observacoes, { id: generateId(), texto: form.novaObservacao.trim(), autor: usuario?.nome ?? '', data: new Date().toISOString(), arquivos: form.novosArquivos }]
      : editando.observacoes;

    const updated: Renovacao = {
      ...editando,
      responsavelId: form.responsavelId,
      clienteId: clienteEditando?.id ?? editando.clienteId,
      // se cliente selecionado, atualiza dados do cliente
      nomeCliente: clienteEditando?.nome ?? editando.nomeCliente,
      emailCliente: clienteEditando?.email ?? editando.emailCliente,
      telefoneCliente: clienteEditando?.telefone ?? editando.telefoneCliente,
      cpfCnpjCliente: clienteEditando?.cpfCnpj ?? editando.cpfCnpjCliente,
      seguradoraAnterior: form.seguradoraAnterior,
      premioAnterior: premioAnt,
      percentComissaoAnterior: percentAnt,
      comissaoAnterior: comissaoAnteriorCalc,
      status: form.status,
      seguradoraNova: naoRenovada ? '' : form.seguradoraNova,
      premioNovo: naoRenovada ? 0 : (parseFloat(form.premioNovo) || 0),
      percentComissaoNova: naoRenovada ? 0 : (parseFloat(form.percentComissaoNova) || 0),
      comissaoNova,
      resultado,
      motivoPerdaId: form.status === 'nao_renovada' ? form.motivoPerdaId : undefined,
      observacoes: obs,
      camposCustomizados: form.camposCustomizados,
      atualizadoEm: new Date().toISOString(),
    };
    setRenovacoes(renovacoes.map(r => r.id === updated.id ? updated : r));

    // Trigger email for status change (renovado / nao_renovada)
    if (updated.status === 'renovado' || updated.status === 'nao_renovada') {
      const gatilhoRen = updated.status === 'renovado' ? 'seguro_renovado' : 'seguro_nao_renovado';
      const modeloRen = modelosEmail?.find(m => m.ativo && m.gatilho === gatilhoRen);
      if (modeloRen && updated.emailCliente) {
        const disparoRen: EmailDisparo = {
          id: generateId(),
          modeloId: modeloRen.id,
          modeloNome: modeloRen.nome,
          destinatarioEmail: updated.emailCliente,
          destinatarioNome: updated.nomeCliente,
          assunto: modeloRen.assunto.replace(/\{\{nome\}\}/g, updated.nomeCliente).replace(/\{\{produto\}\}/g, updated.ramo).replace(/\{\{seguradora\}\}/g, updated.seguradoraAnterior).replace(/\{\{vencimento\}\}/g, updated.fimVigencia),
          corpo: modeloRen.corpo.replace(/\{\{nome\}\}/g, updated.nomeCliente).replace(/\{\{produto\}\}/g, updated.ramo).replace(/\{\{seguradora\}\}/g, updated.seguradoraAnterior).replace(/\{\{vencimento\}\}/g, updated.fimVigencia),
          status: 'pendente',
          gatilho: gatilhoRen,
          referenciaId: updated.id,
          criadoEm: new Date().toISOString(),
        };
        setEmailsDisparo?.([...(emailsDisparo ?? []), disparoRen]);
      }
    }

    // Auto-criar prospecção se motivo gera prospeccao e não existe ainda
    if (updated.status === 'nao_renovada' && updated.motivoPerdaId) {
      const motivoSel = motivos.find(m => m.id === updated.motivoPerdaId);
      if (motivoSel?.geraProspeccao) {
        const jaExiste = prospeccoes.some(p => p.origemId === updated.id);
        if (!jaExiste) {
          // data de contato = fim de vigência + 1 ano
          const dataContato = updated.fimVigencia
            ? (() => {
                const d = new Date(updated.fimVigencia + 'T00:00:00');
                d.setFullYear(d.getFullYear() + 1);
                return d.toISOString().split('T')[0];
              })()
            : new Date().toISOString().split('T')[0];
          const novaProsp: Prospeccao = {
            id: generateId(),
            origem: 'renovacao_perdida',
            origemId: updated.id,
            responsavelId: updated.responsavelId,
            clienteId: updated.clienteId,
            nomeCliente: updated.nomeCliente,
            emailCliente: updated.emailCliente,
            telefoneCliente: updated.telefoneCliente,
            cpfCnpjCliente: updated.cpfCnpjCliente,
            ramo: updated.ramo,
            seguradora: updated.seguradoraAnterior,
            premioReferencia: updated.premioAnterior,
            dataContato,
            status: 'a_contatar',
            observacoes: [],
            camposCustomizados: [],
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          };
          setProspeccoes([...prospeccoes, novaProsp]);
        }
      }
    }

    setEditando(null);
    setClienteEditando(null);
  }

  function abrirEditarCliente(cli: Cliente) {
    setClienteEditandoModal(cli);
    setFormCliEdit({ ...cli });
    setErroCepCli('');
  }

  async function buscarCepCli(cep: string) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setBuscandoCepCli(true);
    setErroCepCli('');
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await resp.json();
      if (data.erro) { setErroCepCli('CEP não encontrado.'); return; }
      setFormCliEdit(f => ({
        ...f,
        logradouro: data.logradouro ?? f.logradouro,
        bairro: data.bairro ?? f.bairro,
        cidade: data.localidade ?? f.cidade,
        uf: data.uf ?? f.uf,
      }));
    } catch {
      setErroCepCli('Erro ao buscar CEP.');
    } finally {
      setBuscandoCepCli(false);
    }
  }

  function salvarClienteEdit() {
    if (!clienteEditandoModal) return;
    const updated: Cliente = { ...clienteEditandoModal, ...formCliEdit } as Cliente;
    setClientes(clientes.map(c => c.id === updated.id ? updated : c));
    setClienteEditandoModal(null);
  }

  // ── XLSX: exportar dados ─────────────────────────────────────────────────
  function exportarCSV() {
    const headers = ['ID','Responsável','Cliente','Email','Telefone','CPF/CNPJ','Fim Vigência','Ramo','Seg Anterior','Prêmio Ant','%Com Ant','Com Ant','Seg Nova','Prêmio Novo','%Com Nova','Com Nova','Resultado','Status','Motivo Perda'];
    const rows = renovacoes.map(r => [
      r.id,
      usuarios.find(u => u.id === r.responsavelId)?.nome ?? r.responsavelId,
      r.nomeCliente, r.emailCliente, r.telefoneCliente, r.cpfCnpjCliente,
      r.fimVigencia, r.ramo, r.seguradoraAnterior,
      r.premioAnterior, r.percentComissaoAnterior, r.comissaoAnterior,
      r.seguradoraNova, r.premioNovo, r.percentComissaoNova, r.comissaoNova, r.resultado,
      STATUS_LABELS[r.status],
      motivos.find(m => m.id === r.motivoPerdaId)?.nome ?? '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, `renovacoes_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  // ── XLSX: modelo para importação ─────────────────────────────────────────
  function baixarModeloCSV() {
    const headers = [
      'Responsavel',
      'Nome do Cliente',
      'Email do Cliente',
      'Telefone do Cliente',
      'Fim de Vigencia',
      'Ramo',
      'Seguradora Anterior',
      'Premio Liquido Anterior',
      'Percentual Comissao Anterior',
      'CPF/CNPJ Cliente',
      'Seguradora Nova',
      'Premio Novo',
      'Percentual Comissao Nova',
      'Status',
    ];
    // linha de exemplo para orientar o preenchimento
    // Status aceitos: A Trabalhar | Em Orçamento | Em Negociação | Vencida | A Transmitir | Pendente | Renovado | Não Renovada
    const exemplo = [
      'João Silva',
      'Maria da Silva',
      'maria@email.com',
      '11999990000',
      '2025-06-30',
      'Auto',
      'Porto Seguro',
      '2500.00',
      '10',
      '12345678901',
      'Allianz',
      '2600.00',
      '12',
      'Renovado',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, exemplo]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, 'modelo_importacao_renovacoes.xlsx');
  }

  // ── XLSX: importar ────────────────────────────────────────────────────────
  async function importarCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const allRows = await new Promise<string[][]>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = ev => {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: true }) as string[][];
        resolve(rows);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });

    const dataLines = allRows.slice(1); // ignora cabeçalho

      const clientesAtualizados = [...clientes];
      const clientesCriados: string[] = [];
      const clientesIncompletos: string[] = []; // criados mas com campos faltando
      type LinhaRejeitada = { linha: number; nome: string; motivo: string };
      const rejeitadas: LinhaRejeitada[] = [];

      const novas: Renovacao[] = [];
      const linhasValidas: LinhaValida[] = [];
      const respNaoEncontrados: string[] = []; // nomes da planilha sem match no sistema

      dataLines.forEach((cols, idx) => {
        const lineNum = idx + 2; // +2: 1 base + 1 cabeçalho
        const [respNome, nomeCliente, emailCliente, telefoneCliente, fimVigencia, ramo, seguradoraAnterior, premioStr, percentStr, cpfCnpj, seguradoraNovaCsv, premioNovoStr, percentNovoStr, statusCsv] = cols.map(c => String(c ?? ''));

        const nome = nomeCliente?.trim() ?? '';
        const cpfDigits = cpfCnpj?.replace(/\D/g, '') ?? '';
        const cpfValido = cpfDigits.length === 11 || cpfDigits.length === 14;

        // ── Validação: nome E CPF/CNPJ são obrigatórios ───────────────────
        const erros: string[] = [];
        if (!nome) erros.push('nome ausente');
        if (!cpfDigits) erros.push('CPF/CNPJ ausente');
        else if (!cpfValido) erros.push(`CPF/CNPJ inválido (${cpfDigits.length} dígitos)`);

        if (erros.length > 0) {
          rejeitadas.push({ linha: lineNum, nome: nome || '(sem nome)', motivo: erros.join(' · ') });
          return; // pula esta linha
        }

        const respNomeTrim = respNome?.trim().toLowerCase() ?? '';
        const resp = respNomeTrim
          ? usuarios.find(u => u.nome.trim().toLowerCase() === respNomeTrim)
          : undefined;
        if (respNomeTrim && !resp && !respNaoEncontrados.includes(respNome.trim())) {
          respNaoEncontrados.push(respNome.trim());
        }
        const premioAnterior = parseFloat(premioStr) || 0;
        const percentComissaoAnterior = parsePercent(percentStr);

        // Mapeia o label de status para o valor interno
        const statusImportado = ((): StatusRenovacao => {
          const labelMap: Record<string, StatusRenovacao> = {
            'a trabalhar': 'a_trabalhar', 'em orçamento': 'em_orcamento',
            'em negociação': 'em_negociacao', 'vencida': 'vencidas',
            'a transmitir': 'a_transmitir', 'pendente': 'pendente',
            'renovado': 'renovado', 'não renovada': 'nao_renovada',
            'nao renovada': 'nao_renovada',
          };
          return labelMap[(statusCsv ?? '').toLowerCase().trim()] ?? 'a_trabalhar';
        })();

        // Campos da renovação nova (opcionais — zerados se não renovada)
        const isNaoRenovada = statusImportado === 'nao_renovada';
        const premioNovo = isNaoRenovada ? 0 : (parseFloat(premioNovoStr ?? '') || 0);
        const percentComissaoNova = isNaoRenovada ? 0 : parsePercent(percentNovoStr ?? '');
        const comissaoNova = premioNovo * percentComissaoNova / 100;
        const seguradoraNova = isNaoRenovada ? '' : (seguradoraNovaCsv?.trim() ?? '').toUpperCase();

        // Tenta encontrar cliente já cadastrado pelo CPF/CNPJ
        let clienteVinc = clientesAtualizados.find(c => c.cpfCnpj === cpfDigits);

        if (!clienteVinc) {
          // Cria o cliente automaticamente com os dados disponíveis
          const tipo: 'PF' | 'PJ' = cpfDigits.length === 11 ? 'PF' : 'PJ';
          const novoCliente: Cliente = {
            id: generateId(),
            cpfCnpj: cpfDigits,
            tipo,
            nome,
            email: emailCliente?.trim() ?? '',
            telefone: telefoneCliente?.trim() ?? '',
            cep: '', logradouro: '', numero: '', complemento: '',
            bairro: '', cidade: '', uf: '',
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          };
          clientesAtualizados.push(novoCliente);
          clientesCriados.push(nome);
          // Verifica se o cliente ficou com campos faltando
          if (!novoCliente.email || !novoCliente.telefone) {
            clientesIncompletos.push(nome);
          }
          clienteVinc = novoCliente;
        } else {
          // Cliente existente — verifica se está incompleto
          if (!clienteVinc.email || !clienteVinc.telefone) {
            if (!clientesIncompletos.includes(clienteVinc.nome)) {
              clientesIncompletos.push(clienteVinc.nome);
            }
          }
        }

        const renovacaoNova: Renovacao = {
          id: generateId(),
          responsavelId: resp?.id ?? '',
          clienteId: clienteVinc?.id,
          nomeCliente: clienteVinc?.nome ?? nome,
          emailCliente: clienteVinc?.email ?? emailCliente?.trim() ?? '',
          telefoneCliente: clienteVinc?.telefone ?? telefoneCliente?.trim() ?? '',
          cpfCnpjCliente: cpfDigits,
          fimVigencia: parseImportDate(fimVigencia),
          ramo: (ramo?.trim() ?? '').toUpperCase(),
          seguradoraAnterior: (seguradoraAnterior?.trim() ?? '').toUpperCase(),
          premioAnterior,
          percentComissaoAnterior,
          comissaoAnterior: premioAnterior * percentComissaoAnterior / 100,
          seguradoraNova, premioNovo, percentComissaoNova, comissaoNova,
          resultado: isNaoRenovada ? 0 : comissaoNova - (premioAnterior * percentComissaoAnterior / 100),
          status: statusImportado,
          observacoes: [], camposCustomizados: [],
          criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(),
        };
        novas.push(renovacaoNova);
        const isNovo = !clientes.some(c => c.cpfCnpj === cpfDigits);
        linhasValidas.push({
          linha: lineNum,
          nome: clienteVinc?.nome ?? nome,
          detalhe: `CPF ${cpfDigits} · venc. ${fimVigencia?.trim() || '?'}`,
          clienteNovo: isNovo,
        });
      });

      const linhasInvalidas: LinhaInvalida[] = rejeitadas;

      const idsClientesCriados = clientesAtualizados
        .slice(clientes.length)
        .map(c => c.id);

      setPreviewImport({
        linhasValidas,
        linhasInvalidas,
        novas,
        clientesAtualizados,
        idsClientesCriados,
        nomeArquivo: file.name,
        respNaoEncontrados,
      });
  }

  async function confirmarImportRenovacoes() {
    if (!previewImport) return;
    setImportando(true);
    try {
      if (previewImport.idsClientesCriados.length > 0) setClientes(previewImport.clientesAtualizados);
      const novas = previewImport.novas;
      if (novas.length > 0) setRenovacoes([...renovacoes, ...novas]);

      const lote: ImportacaoLote = {
        id: generateId(),
        tipo: 'renovacoes',
        nomeArquivo: previewImport.nomeArquivo,
        totalImportados: novas.length,
        totalRejeitados: previewImport.linhasInvalidas.length,
        idsSalvos: novas.map(r => r.id),
        idsClientesCriados: previewImport.idsClientesCriados,
        criadoEm: new Date().toISOString(),
        criadoPor: usuario?.id ?? '',
        linhasValidas: previewImport.linhasValidas,
        linhasInvalidas: previewImport.linhasInvalidas,
      };
      setImportacoes([...importacoes, lote]);
      setPreviewImport(null);
    } finally {
      setImportando(false);
    }
  }

  const responsavelNome = (id: string) => usuarios.find(u => u.id === id)?.nome ?? id;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Renovações</h1>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <button onClick={exportarCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                <Download size={14} /> Exportar
              </button>
              <button
                onClick={baixarModeloCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg text-sm hover:bg-blue-100"
                title="Baixar planilha modelo para preenchimento e importação"
              >
                <Download size={14} /> Modelo XLSX
              </button>
              <label className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">
                <Upload size={14} /> Importar XLSX
                <input type="file" accept=".xlsx" className="hidden" onChange={importarCSV} />
              </label>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <select value={filtroAno} onChange={e => setFiltroAno(+e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filtroMes} onChange={e => setFiltroMes(+e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={0}>Todos os meses</option>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos os status</option>
          <option value="ativos">Todos, exceto concluídos</option>
          {(Object.keys(STATUS_LABELS) as StatusRenovacao[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {(isAdmin || isGestor) && (
          <select value={filtroResp} onChange={e => setFiltroResp(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos os responsáveis</option>
            {usuariosVisiveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </select>
        )}
        <span className="ml-auto self-center text-sm text-gray-500">{filtered.length} registro(s)</span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {[
                'Cliente / Responsável',
                'Vigência',
                'Ramo',
                'Anterior',
                'Com. Ant.',
                'Nova',
                'Com. Nova',
                'Resultado',
                'Status',
                '',
              ].map((h, i) => (
                <th key={i} className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Nenhuma renovação encontrada</td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} onDoubleClick={() => abrirEdicao(r)}
                className={`hover:bg-gray-50 transition-colors cursor-pointer select-none ${isVencida(r) ? 'bg-red-50 hover:bg-red-100' : ''}`}
                title="Duplo clique para abrir">

                {/* Cliente + Responsável */}
                <td className="px-2 py-2 max-w-[160px]">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-gray-800 truncate">{r.nomeCliente}</span>
                    {r.clienteId && <UserCheck size={10} className="text-blue-500 shrink-0" aria-label="Cliente vinculado" />}
                    {(() => {
                      const obs = clientes.find(c => c.id === r.clienteId)?.observacaoImportante;
                      if (!obs) return null;
                      return (
                        <span className="relative group inline-flex shrink-0 z-50">
                          <Bell size={11} className="text-amber-500 cursor-help" />
                          <span className="pointer-events-none absolute top-full left-0 mt-2 z-50 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed whitespace-normal">
                            {obs}
                            <span className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900" />
                          </span>
                        </span>
                      );
                    })()}
                    {(() => {
                      const cli = clientes.find(c => c.id === r.clienteId);
                      const vinculos = cli?.vinculos ?? [];
                      if (vinculos.length === 0) return null;
                      const labels = vinculos
                        .map(v => { const vc = clientes.find(c => c.id === v.clienteId); return vc ? `${vc.nome} (${v.tipo})` : null; })
                        .filter(Boolean)
                        .join(', ');
                      return (
                        <span className="relative group inline-flex shrink-0 z-50">
                          <Link2 size={11} className="text-indigo-400 cursor-help" />
                          <span className="pointer-events-none absolute top-full left-0 mt-2 z-50 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed whitespace-normal">
                            {labels}
                            <span className="absolute bottom-full left-4 border-4 border-transparent border-b-gray-900" />
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-gray-400 truncate">{responsavelNome(r.responsavelId)}</div>
                </td>

                {/* Vigência */}
                <td className="px-2 py-2 whitespace-nowrap">
                  <span className={isVencida(r) ? 'text-red-700 font-medium' : 'text-gray-700'}>{formatDate(r.fimVigencia)}</span>
                </td>

                {/* Ramo */}
                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{r.ramo}</td>

                {/* Anterior: seguradora + prêmio + % */}
                <td className="px-2 py-2">
                  <div className="text-gray-700 whitespace-nowrap">{r.seguradoraAnterior || '—'}</div>
                  <div className="text-gray-400 whitespace-nowrap">{formatCurrency(r.premioAnterior)} · {formatPercent(r.percentComissaoAnterior)}</div>
                </td>

                {/* Com. Ant. */}
                <td className="px-2 py-2 text-gray-700 whitespace-nowrap font-medium">{formatCurrency(r.comissaoAnterior)}</td>

                {/* Nova: seguradora + prêmio + % */}
                <td className="px-2 py-2">
                  {r.seguradoraNova ? (
                    <>
                      <div className="text-gray-700 whitespace-nowrap">{r.seguradoraNova}</div>
                      <div className="text-gray-400 whitespace-nowrap">{formatCurrency(r.premioNovo)} · {formatPercent(r.percentComissaoNova)}</div>
                    </>
                  ) : <span className="text-gray-300">—</span>}
                </td>

                {/* Com. Nova */}
                <td className="px-2 py-2 whitespace-nowrap font-medium">
                  {r.comissaoNova ? <span className="text-gray-700">{formatCurrency(r.comissaoNova)}</span> : <span className="text-gray-300">—</span>}
                </td>

                {/* Resultado */}
                <td className="px-2 py-2 whitespace-nowrap font-medium">
                  {r.resultado !== 0 ? (
                    <span className={r.resultado > 0 ? 'text-green-700' : 'text-red-600'}>
                      {r.resultado > 0 ? '+' : ''}{formatCurrency(r.resultado)}
                    </span>
                  ) : <span className="text-gray-300">—</span>}
                </td>

                {/* Status */}
                <td className="px-2 py-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                  {r.motivoPerdaId && (
                    <div className="text-gray-400 mt-0.5 truncate max-w-[100px]">{motivos.find(m => m.id === r.motivoPerdaId)?.nome}</div>
                  )}
                </td>

                {/* Ações */}
                <td className="px-2 py-2">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => abrirEdicao(r)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                      <Edit2 size={13} />
                    </button>
                    {r.observacoes.length > 0 && (
                      <span className="flex items-center gap-0.5 text-gray-400">
                        <MessageSquare size={11} />{r.observacoes.length}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal de Edição */}
      {editando && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900">Editar Renovação</h2>
                {(() => {
                  const cli = clienteEditando ?? clientes.find(c => c.id === editando.clienteId || (editando.cpfCnpjCliente && c.cpfCnpj === editando.cpfCnpjCliente)) ?? null;
                  return cli ? (
                    <div className="inline-flex items-center gap-1.5 mt-0.5">
                      <span
                        className="text-sm text-blue-600 cursor-pointer hover:text-blue-800 underline underline-offset-2 select-none"
                        onClick={() => setClienteVisualizando(cli)}
                        title="Ver dados do cliente"
                      >
                        {editando.nomeCliente}
                      </span>
                      <button
                        type="button"
                        onClick={() => abrirEditarCliente(cli)}
                        className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Editar dados do cliente"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 mt-0.5">{editando.nomeCliente}</div>
                  );
                })()}
              </div>
              <button onClick={() => { setEditando(null); setClienteEditando(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Full-width banners */}
            <div className="shrink-0 px-5 pt-4 space-y-3">
              {/* Banner de negócio finalizado */}
              {isFinalizado && bloqueado && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <Lock size={14} className="shrink-0" />
                  <span>Negócio finalizado — campos bloqueados. Somente observações podem ser adicionadas.</span>
                </div>
              )}
              {isFinalizado && !bloqueado && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <Lock size={14} className="shrink-0" />
                  <span>Negócio finalizado — como administrador, você pode alterar o status e os dados.</span>
                </div>
              )}
              {/* Aviso de cliente com dados incompletos */}
              {(() => {
                const cli = clientes.find(c => c.id === editando.clienteId);
                if (!cli) return null;
                const camposFaltando: string[] = [];
                if (!cli.email) camposFaltando.push('e-mail');
                if (!cli.telefone) camposFaltando.push('telefone');
                if (!cli.cep) camposFaltando.push('endereço');
                if (camposFaltando.length === 0) return null;
                return (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Cliente com informações incompletas</p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        O cadastro de <strong>{cli.nome}</strong> está sem: {camposFaltando.join(', ')}.
                        Acesse o módulo <strong>Clientes</strong> para completar os dados.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Alerta de observação importante do cliente */}
              {(() => {
                const obs = clientes.find(c => c.id === editando.clienteId)?.observacaoImportante;
                if (!obs) return null;
                return (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                    <Bell size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Atenção — Observação do Cliente</p>
                      <p className="text-sm text-amber-900">{obs}</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left column — static/context info */}
              <div className="w-2/5 overflow-y-auto p-5 space-y-5 border-r border-gray-100">
                {/* Vinculação de cliente */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Vincular Cliente Cadastrado
                  </h3>
                  <ClienteSearch
                    clientes={clientes}
                    clienteSelecionado={clienteEditando}
                    onSelect={setClienteEditando}
                  />
                  {clienteEditando && (
                    <p className="text-xs text-blue-600 mt-1.5">
                      ✓ Dados do cliente serão atualizados ao salvar
                    </p>
                  )}
                  {!clienteEditando && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Selecione um cliente cadastrado para vincular a esta renovação
                    </p>
                  )}
                </div>

                {/* Dados da Apólice */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados da Apólice</h3>
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-4">
                    {[
                      { label: 'Cliente', value: clienteEditando?.nome ?? editando.nomeCliente },
                      { label: 'CPF/CNPJ', value: formatCpfCnpj(clienteEditando?.cpfCnpj ?? editando.cpfCnpjCliente) },
                      { label: 'Ramo', value: editando.ramo },
                      { label: 'Fim de Vigência', value: formatDate(editando.fimVigencia) },
                    ].map(f => (
                      <div key={f.label}>
                        <div className="text-xs text-gray-400">{f.label}</div>
                        <div className="text-sm font-medium text-gray-700">{f.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Campos anteriores — apenas Admin e Gestor podem editar */}
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Seguradora Anterior
                        {!isAdmin && !isGestor && <span className="ml-1 text-xs text-gray-400">(somente admin/gestor)</span>}
                      </label>
                      <select value={form.seguradoraAnterior} onChange={e => setForm(f => ({...f, seguradoraAnterior: e.target.value}))}
                        disabled={bloqueado || (!isAdmin && !isGestor)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(bloqueado || (!isAdmin && !isGestor)) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                        <option value="">Selecione...</option>
                        {seguradOrd.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prêmio Anterior (R$)
                        {!isAdmin && !isGestor && <span className="ml-1 text-xs text-gray-400">(somente admin/gestor)</span>}
                      </label>
                      <input type="number" step="0.01" min="0" value={form.premioAnterior}
                        onChange={e => setForm(f => ({...f, premioAnterior: e.target.value}))}
                        disabled={bloqueado || (!isAdmin && !isGestor)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(bloqueado || (!isAdmin && !isGestor)) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        % Comissão Anterior
                        {!isAdmin && !isGestor && <span className="ml-1 text-xs text-gray-400">(somente admin/gestor)</span>}
                      </label>
                      <input type="number" step="0.01" min="0" max="100" value={form.percentComissaoAnterior}
                        onChange={e => setForm(f => ({...f, percentComissaoAnterior: e.target.value}))}
                        disabled={bloqueado || (!isAdmin && !isGestor)}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(bloqueado || (!isAdmin && !isGestor)) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Comissão Anterior (calc.)</label>
                      <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700">
                        {formatCurrency((parseFloat(form.premioAnterior) || 0) * (parseFloat(form.percentComissaoAnterior) || 0) / 100)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column — editable/action fields */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Banner: campos obrigatórios para "Renovado" */}
                {!isFinalizado && form.status === 'renovado' && (!form.seguradoraNova || !(parseFloat(form.premioNovo) > 0) || !(parseFloat(form.percentComissaoNova) > 0)) && (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      Para concluir como <strong>Renovado</strong>, preencha os campos obrigatórios marcados com <span className="text-red-500 font-bold">*</span>: seguradora nova, prêmio novo e % de comissão nova.
                    </p>
                  </div>
                )}

                {/* Campos editáveis */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Atualização</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {(isAdmin || isGestor || !isCampoRestrito('responsavelId')) && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                        <select value={form.responsavelId} onChange={e => setForm(f => ({...f, responsavelId: e.target.value}))}
                          disabled={bloqueado || isCampoRestrito('responsavelId')}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(bloqueado || isCampoRestrito('responsavelId')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                          {usuariosVisiveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as StatusRenovacao, motivoPerdaId: ''}))}
                        disabled={bloqueado || isCampoRestrito('status')}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(bloqueado || isCampoRestrito('status')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                        {(Object.keys(STATUS_LABELS) as StatusRenovacao[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </div>

                    {form.status === 'nao_renovada' && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Motivo de Perda <span className="text-red-500">*</span>
                        </label>
                        <select value={form.motivoPerdaId} onChange={e => setForm(f => ({...f, motivoPerdaId: e.target.value}))}
                          disabled={bloqueado || isCampoRestrito('motivoPerdaId')}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(bloqueado || isCampoRestrito('motivoPerdaId')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                          <option value="">Selecione o motivo</option>
                          {motivos.filter(m => m.ativo).sort((a,b) => a.ordem - b.ordem).map(m => (
                            <option key={m.id} value={m.id}>{m.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Seguradora Nova
                        {form.status === 'renovado' && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <select value={form.seguradoraNova} onChange={e => setForm(f => ({...f, seguradoraNova: e.target.value}))}
                        disabled={bloqueado || isCampoRestrito('seguradoraNova')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (bloqueado || isCampoRestrito('seguradoraNova')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                          : (form.status === 'renovado' && !form.seguradoraNova) ? 'border-red-400 bg-red-50'
                          : 'border-gray-300'
                        }`}>
                        <option value="">Selecione...</option>
                        {seguradOrd.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prêmio Novo (R$)
                        {form.status === 'renovado' && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input type="number" step="0.01" min="0" value={form.premioNovo}
                        onChange={e => setForm(f => ({...f, premioNovo: e.target.value}))}
                        disabled={bloqueado || isCampoRestrito('premioNovo')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (bloqueado || isCampoRestrito('premioNovo')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                          : (form.status === 'renovado' && !(parseFloat(form.premioNovo) > 0)) ? 'border-red-400 bg-red-50'
                          : 'border-gray-300'
                        }`} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        % Comissão Nova
                        {form.status === 'renovado' && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input type="number" step="0.01" min="0" max="100" value={form.percentComissaoNova}
                        onChange={e => setForm(f => ({...f, percentComissaoNova: e.target.value}))}
                        disabled={bloqueado || isCampoRestrito('percentComissaoNova')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (bloqueado || isCampoRestrito('percentComissaoNova')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                          : (form.status === 'renovado' && !(parseFloat(form.percentComissaoNova) > 0)) ? 'border-red-400 bg-red-50'
                          : 'border-gray-300'
                        }`} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Comissão Nova (calc.)</label>
                      <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-700">
                        {formatCurrency(calcular(form.premioNovo, form.percentComissaoNova, (parseFloat(form.premioAnterior)||0)*(parseFloat(form.percentComissaoAnterior)||0)/100).comissaoNova)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Resultado (calc.)</label>
                      <div className={`px-3 py-2 border rounded-lg text-sm font-medium ${
                        calcular(form.premioNovo, form.percentComissaoNova, (parseFloat(form.premioAnterior)||0)*(parseFloat(form.percentComissaoAnterior)||0)/100).resultado >= 0
                          ? 'border-green-200 bg-green-50 text-green-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}>
                        {formatCurrency(calcular(form.premioNovo, form.percentComissaoNova, (parseFloat(form.premioAnterior)||0)*(parseFloat(form.percentComissaoAnterior)||0)/100).resultado)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Campos Customizáveis ── */}
                {camposAplicaveis.filter(c => !c.ramosAplicaveis?.length || c.ramosAplicaveis.includes(editando?.ramo ?? '')).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Campos Adicionais</h3>
                    <div className="space-y-3">
                      {camposAplicaveis.filter(c => !c.ramosAplicaveis?.length || c.ramosAplicaveis.includes(editando?.ramo ?? '')).map(campo => {
                        const valorAtual = form.camposCustomizados.find(c => c.campoId === campo.id)?.valor ?? '';
                        const setValor = (v: string | string[]) => setForm(f => ({
                          ...f,
                          camposCustomizados: f.camposCustomizados.some(c => c.campoId === campo.id)
                            ? f.camposCustomizados.map(c => c.campoId === campo.id ? { ...c, valor: v } : c)
                            : [...f.camposCustomizados, { campoId: campo.id, valor: v }],
                        }));
                        return (
                          <div key={campo.id}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {campo.nome}{campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            {campo.tipo === 'texto' && (
                              <input type="text" value={valorAtual as string}
                                onChange={e => setValor(e.target.value)} disabled={bloqueado}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${bloqueado ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} />
                            )}
                            {campo.tipo === 'data' && (
                              <DateInput value={valorAtual as string}
                                onChange={e => setValor(e.target.value)} disabled={bloqueado}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${bloqueado ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} />
                            )}
                            {campo.tipo === 'lista' && (
                              <select value={valorAtual as string}
                                onChange={e => setValor(e.target.value)} disabled={bloqueado}
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${bloqueado ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                                <option value="">— Selecione —</option>
                                {(campo.opcoes ?? []).map(op => <option key={op} value={op}>{op}</option>)}
                              </select>
                            )}
                            {campo.tipo === 'arquivo' && (
                              <div className="space-y-2">
                                {!bloqueado && (
                                  <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 text-sm text-gray-500">
                                    <span>📎 {campo.multiplosArquivos ? 'Selecionar arquivos' : 'Selecionar arquivo'}</span>
                                    <input type="file" className="hidden"
                                      accept={(campo.tiposPermitidos ?? []).join(',')}
                                      multiple={!!campo.multiplosArquivos}
                                      onChange={e => {
                                        const files = Array.from(e.target.files ?? []);
                                        const readers = files.map(f => new Promise<string>(resolve => {
                                          const r = new FileReader();
                                          r.onload = ev => resolve(JSON.stringify({ id: generateId(), nome: f.name, tipo: f.type, tamanho: f.size, dataBase64: ev.target?.result as string }));
                                          r.readAsDataURL(f);
                                        }));
                                        Promise.all(readers).then(results => {
                                          if (campo.multiplosArquivos) {
                                            const cur = Array.isArray(valorAtual) ? valorAtual as string[] : (valorAtual ? [valorAtual as string] : []);
                                            setValor([...cur, ...results]);
                                          } else {
                                            setValor(results[0] ?? '');
                                          }
                                        });
                                        e.target.value = '';
                                      }} />
                                  </label>
                                )}
                                {(() => {
                                  const arqs = Array.isArray(valorAtual) ? valorAtual as string[] : (valorAtual ? [valorAtual as string] : []);
                                  return arqs.map((arqStr, i) => {
                                    try {
                                      const arq = JSON.parse(arqStr) as { nome: string; dataBase64: string };
                                      return (
                                        <div key={i} className="flex items-center justify-between py-1.5 px-3 bg-gray-50 rounded-lg text-xs border border-gray-100">
                                          <span className="text-gray-700 truncate">{arq.nome}</span>
                                          <div className="flex gap-1 shrink-0 ml-2">
                                            <button type="button" title="Baixar" onClick={() => { const a = document.createElement('a'); a.href = arq.dataBase64; a.download = arq.nome; a.click(); }}
                                              className="p-1 text-blue-500 hover:text-blue-700">↓</button>
                                            {!bloqueado && (
                                              <button type="button" title="Remover" onClick={() => {
                                                if (Array.isArray(valorAtual)) setValor((valorAtual as string[]).filter((_, idx) => idx !== i));
                                                else setValor('');
                                              }} className="p-1 text-red-400 hover:text-red-600">×</button>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    } catch { return null; }
                                  });
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Tarefas */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tarefas / Agenda</h3>
                  <TarefasPanel
                    origemTipo="renovacao"
                    origemId={editando.id}
                    nomeCliente={clienteEditando?.nome ?? editando.nomeCliente}
                    responsavelId={editando.responsavelId}
                    tarefas={tarefas}
                    setTarefas={setTarefas}
                  />
                </div>

                {/* Observações */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Observações</h3>
                  <ObservacoesPanel
                    observacoes={editando.observacoes}
                    novaObservacao={form.novaObservacao}
                    onChangeNovaObservacao={v => setForm(f => ({...f, novaObservacao: v}))}
                    novosArquivos={form.novosArquivos}
                    onChangeNovosArquivos={a => setForm(f => ({...f, novosArquivos: a}))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200 shrink-0">
              <button onClick={() => { setEditando(null); setClienteEditando(null); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={salvar} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                <Save size={14} /> {bloqueado ? 'Salvar Observação' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir renovação"
        message="Tem certeza que deseja excluir esta renovação? Esta ação não pode ser desfeita."
        onConfirm={() => { setRenovacoes(renovacoes.filter(r => r.id !== confirmExcluir)); setConfirmExcluir(null); }}
        onCancel={() => setConfirmExcluir(null)}
      />

      {/* Modal de edição de cliente */}
      {clienteEditandoModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setClienteEditandoModal(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900">Editar Cliente</h2>
                <p className="text-xs text-gray-400 mt-0.5">{clienteEditandoModal.nome}</p>
              </div>
              <button onClick={() => setClienteEditandoModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={formCliEdit.nome ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, nome: e.target.value }))} />
              </div>
              {/* Email + Telefone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                  <input type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={formCliEdit.email ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={formCliEdit.telefone ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, telefone: e.target.value }))} />
                </div>
              </div>
              {/* Nascimento */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data de Nascimento</label>
                <DateInput className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={formCliEdit.dataNascimento ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, dataNascimento: e.target.value }))} />
              </div>
              {/* CEP */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">CEP</label>
                <div className="flex gap-2">
                  <input className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={formCliEdit.cep ?? ''} maxLength={9}
                    onChange={e => setFormCliEdit(f => ({ ...f, cep: e.target.value.replace(/\D/g, '') }))}
                    onBlur={e => buscarCepCli(e.target.value)} />
                  <button type="button" onClick={() => buscarCepCli(formCliEdit.cep ?? '')} disabled={buscandoCepCli}
                    className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600">
                    {buscandoCepCli ? '...' : 'Buscar'}
                  </button>
                </div>
                {erroCepCli && <p className="text-xs text-red-500 mt-1">{erroCepCli}</p>}
              </div>
              {/* Logradouro + Número */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Logradouro</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={formCliEdit.logradouro ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, logradouro: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Número</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={formCliEdit.numero ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, numero: e.target.value }))} />
                </div>
              </div>
              {/* Complemento + Bairro */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Complemento</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={formCliEdit.complemento ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, complemento: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Bairro</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={formCliEdit.bairro ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, bairro: e.target.value }))} />
                </div>
              </div>
              {/* Cidade + UF */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cidade</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={formCliEdit.cidade ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, cidade: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">UF</label>
                  <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" maxLength={2}
                    value={formCliEdit.uf ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, uf: e.target.value.toUpperCase() }))} />
                </div>
              </div>
              {/* Observação importante */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observação importante</label>
                <textarea rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                  value={formCliEdit.observacaoImportante ?? ''} onChange={e => setFormCliEdit(f => ({ ...f, observacaoImportante: e.target.value }))} />
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-2">
              <button type="button" onClick={() => setClienteEditandoModal(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button type="button" onClick={salvarClienteEdit}
                className="px-4 py-2 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-800">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de dados do cliente */}
      {clienteVisualizando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setClienteVisualizando(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900">{clienteVisualizando.nome}</h2>
                <span className="text-xs text-gray-400">{clienteVisualizando.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</span>
              </div>
              <button onClick={() => setClienteVisualizando(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              {clienteVisualizando.observacaoImportante && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <Bell size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-amber-900 text-xs">{clienteVisualizando.observacaoImportante}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div><span className="text-xs text-gray-400 block">CPF/CNPJ</span><span className="text-gray-800">{formatCpfCnpj(clienteVisualizando.cpfCnpj)}</span></div>
                {clienteVisualizando.dataNascimento && <div><span className="text-xs text-gray-400 block">Nascimento</span><span className="text-gray-800">{formatDate(clienteVisualizando.dataNascimento)}</span></div>}
                {clienteVisualizando.email && <div className="col-span-2"><span className="text-xs text-gray-400 block">E-mail</span><span className="text-gray-800">{clienteVisualizando.email}</span></div>}
                {clienteVisualizando.telefone && <div><span className="text-xs text-gray-400 block">Telefone</span><span className="text-gray-800">{clienteVisualizando.telefone}</span></div>}
                {clienteVisualizando.cep && (
                  <div className="col-span-2">
                    <span className="text-xs text-gray-400 block">Endereço</span>
                    <span className="text-gray-800">
                      {clienteVisualizando.logradouro}{clienteVisualizando.numero ? `, ${clienteVisualizando.numero}` : ''}
                      {clienteVisualizando.complemento ? ` — ${clienteVisualizando.complemento}` : ''}<br />
                      {clienteVisualizando.bairro ? `${clienteVisualizando.bairro}, ` : ''}{clienteVisualizando.cidade} — {clienteVisualizando.uf} · CEP {clienteVisualizando.cep}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewImport && (
        <ImportPreviewModal
          titulo="Importação de Renovações"
          nomeArquivo={previewImport.nomeArquivo}
          linhasValidas={previewImport.linhasValidas}
          linhasInvalidas={previewImport.linhasInvalidas}
          avisos={previewImport.respNaoEncontrados.length > 0
            ? [`Responsável(is) não encontrado(s) no sistema — os registros ficarão sem responsável definido: ${previewImport.respNaoEncontrados.join(', ')}`]
            : []}
          importando={importando}
          onConfirmar={confirmarImportRenovacoes}
          onCancelar={() => setPreviewImport(null)}
        />
      )}
    </div>
  );
}
