import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Download, Edit2, X, Save, MessageSquare, Search, UserCheck, Bell, Lock, FileUp, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { SeguroNovo, Prospeccao, StatusSeguroNovo, Usuario, Seguradora, Ramo, MotivoPerda, CampoCustomizavel, Cliente, Observacao, ArquivoAnexo, Tarefa } from '../types';
import { ObservacoesPanel } from '../components/ObservacoesPanel';
import { TarefasPanel } from '../components/TarefasPanel';
import { formatCurrency, formatPercent, formatDate, generateId, formatCpfCnpj } from '../utils/formatters';
import { calcularComissaoAReceber } from '../utils/calculations';
import { ConfirmDialog } from '../components/ConfirmDialog';
const ImportarPdfModal = lazy(() =>
  import('../components/ImportarPdfModal').then(m => ({ default: m.ImportarPdfModal }))
);
import type { DadosCotacao } from '../utils/parsePdfCotacao';

interface Props {
  segurosNovos: SeguroNovo[];
  setSegurosNovos: (s: SeguroNovo[]) => void;
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
}

const STATUS_LABELS: Record<StatusSeguroNovo, string> = {
  a_trabalhar: 'A Trabalhar', em_orcamento: 'Em Orçamento', em_negociacao: 'Em Negociação',
  vencidas: 'Vencida', a_transmitir: 'A Transmitir', pendente: 'Pendente',
  fechado: 'Fechado', perdido: 'Perdido',
};

const STATUS_COLORS: Record<StatusSeguroNovo, string> = {
  a_trabalhar: 'bg-gray-100 text-gray-700',
  em_orcamento: 'bg-blue-100 text-blue-700',
  em_negociacao: 'bg-yellow-100 text-yellow-800',
  vencidas: 'bg-red-100 text-red-700',
  a_transmitir: 'bg-blue-100 text-blue-800',
  pendente: 'bg-orange-100 text-orange-700',
  fechado: 'bg-green-100 text-green-700',
  perdido: 'bg-red-100 text-red-700',
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

type FormState = {
  nomeCliente: string;
  emailCliente: string;
  telefoneCliente: string;
  cpfCnpjCliente: string;
  responsavelId: string;
  inicioVigencia: string;
  ramo: string;
  seguradora: string;
  premioLiquido: string;
  percentComissao: string;
  status: StatusSeguroNovo;
  motivoPerdaId: string;
  novaObservacao: string;
  novosArquivos: ArquivoAnexo[];
};

const formVazio = (usuarioId: string): FormState => ({
  nomeCliente: '', emailCliente: '', telefoneCliente: '', cpfCnpjCliente: '',
  responsavelId: usuarioId, inicioVigencia: '', ramo: '', seguradora: '',
  premioLiquido: '', percentComissao: '', status: 'a_trabalhar', motivoPerdaId: '', novaObservacao: '', novosArquivos: [],
});

// ── Busca e seleção de cliente cadastrado ────────────────────────────────────
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
            <div className="text-xs text-blue-500">
              {formatCpfCnpj(clienteSelecionado.cpfCnpj)} · {clienteSelecionado.email}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="p-1 text-blue-400 hover:text-blue-700 rounded"
          title="Remover seleção"
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
          placeholder="Buscar cliente por nome, CPF/CNPJ ou email..."
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

export function SeguroNovos({ segurosNovos, setSegurosNovos, prospeccoes, setProspeccoes, usuarios, seguradoras, ramos, motivos, clientes, setClientes, tarefas, setTarefas }: Props) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';
  const isGestor = usuario?.role === 'gestor';
  const location = useLocation();
  const navigateSN = useNavigate();

  const isCampoRestrito = (campo: string) => {
    if (!usuario || usuario.role === 'admin' || usuario.role === 'gestor') return false;
    return usuario.camposRestritos?.segurosNovos?.includes(campo) ?? false;
  };

  const now = new Date();
  const [filtroAno, setFiltroAno] = useState(now.getFullYear());
  const [filtroMes, setFiltroMes] = useState(now.getMonth() + 1);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroResp, setFiltroResp] = useState(usuario?.role === 'usuario' ? usuario.id : '');

  const [editando, setEditando] = useState<SeguroNovo | null>(null);
  const [criando, setCriando] = useState(false);
  const isFinalizado = !criando && (editando?.status === 'fechado' || editando?.status === 'perdido');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormState>(formVazio(usuario?.id ?? ''));
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null);
  const [clienteVisualizando, setClienteVisualizando] = useState<Cliente | null>(null);
  const [importandoPdf, setImportandoPdf] = useState(false);

  const anos = useMemo(() => {
    const set = new Set<number>();
    segurosNovos.forEach(s => {
      const ref = s.inicioVigencia || s.criadoEm?.slice(0, 10);
      if (ref) set.add(+ref.split('-')[0]);
    });
    if (!set.has(now.getFullYear())) set.add(now.getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [segurosNovos]);

  const filtered = useMemo(() => {
    return segurosNovos
      .filter(s => {
        const dateRef = s.inicioVigencia || s.criadoEm?.slice(0, 10);
        if (!dateRef) return false;
        const [y, m] = dateRef.split('-').map(Number);
        if (y !== filtroAno) return false;
        if (filtroMes && m !== filtroMes) return false;
        if (filtroStatus && s.status !== filtroStatus) return false;
        if (filtroResp && s.responsavelId !== filtroResp) return false;
        if (usuario?.role === 'usuario' && s.responsavelId !== usuario.id) return false;
        return true;
      })
      .sort((a, b) => (a.inicioVigencia || a.criadoEm || '').localeCompare(b.inicioVigencia || b.criadoEm || ''));
  }, [segurosNovos, filtroAno, filtroMes, filtroStatus, filtroResp, usuario]);

  const usuariosVisiveis = useMemo(() =>
    usuarios.filter(u => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [usuarios]);

  const seguradOrd = useMemo(() =>
    seguradoras.filter(s => s.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [seguradoras]);

  const ramosOrd = useMemo(() =>
    ramos.filter(r => r.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [ramos]);

  // Ao selecionar um cliente, preenche automaticamente os campos dele
  function handleSelecionarCliente(c: Cliente | null) {
    setClienteSelecionado(c);
    if (c) {
      setForm(f => ({
        ...f,
        nomeCliente: c.nome,
        emailCliente: c.email,
        telefoneCliente: c.telefone,
        cpfCnpjCliente: c.cpfCnpj,
      }));
    }
  }

  function abrirEdicao(s: SeguroNovo) {
    const cliVinc = clientes.find(c => c.id === s.clienteId || c.cpfCnpj === s.cpfCnpjCliente) ?? null;
    setClienteSelecionado(cliVinc);
    setForm({
      nomeCliente: s.nomeCliente,
      emailCliente: s.emailCliente,
      telefoneCliente: s.telefoneCliente,
      cpfCnpjCliente: s.cpfCnpjCliente,
      responsavelId: s.responsavelId,
      inicioVigencia: s.inicioVigencia,
      ramo: s.ramo,
      seguradora: s.seguradora,
      premioLiquido: String(s.premioLiquido),
      percentComissao: String(s.percentComissao),
      status: s.status,
      motivoPerdaId: s.motivoPerdaId ?? '',
      novaObservacao: '', novosArquivos: [],
    });
    setEditando(s);
    setCriando(false);
  }

  // Abrir registro via navegação (ex: duplo clique em Clientes)
  useEffect(() => {
    const openId = (location.state as { openId?: string } | null)?.openId;
    if (openId) {
      const s = segurosNovos.find(x => x.id === openId);
      if (s) abrirEdicao(s);
      navigateSN('/seguros-novos', { replace: true, state: {} });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirCriacao() {
    setForm(formVazio(usuario?.id ?? ''));
    setClienteSelecionado(null);
    setEditando(null);
    setCriando(true);
  }

  function handleImportarPdf(dados: DadosCotacao, ramoSistema: string) {
    setImportandoPdf(false);
    // Tenta vincular cliente já cadastrado pelo CPF/CNPJ
    const cpfLimpo = dados.cpfCnpj.replace(/\D/g, '');
    const cliExistente = clientes.find(c => c.cpfCnpj.replace(/\D/g, '') === cpfLimpo) ?? null;
    setClienteSelecionado(cliExistente);
    setForm({
      ...formVazio(usuario?.id ?? ''),
      nomeCliente:   cliExistente?.nome    ?? dados.nome,
      emailCliente:  cliExistente?.email   ?? dados.email,
      telefoneCliente: cliExistente?.telefone ?? dados.telefone,
      cpfCnpjCliente:  cliExistente?.cpfCnpj  ?? dados.cpfCnpj,
      ramo: ramoSistema,
    });
    setEditando(null);
    setCriando(true);
  }

  function fecharModal() {
    setEditando(null);
    setCriando(false);
    setClienteSelecionado(null);
  }

  function calcCom(f: FormState) {
    const premio = parseFloat(f.premioLiquido) || 0;
    const pct = parseFloat(f.percentComissao) || 0;
    const comissao = premio * pct / 100;
    const comissaoAReceber = calcularComissaoAReceber(f.ramo, comissao, ramos);
    return { comissao, comissaoAReceber };
  }

  function salvar() {
    // Negócio finalizado: apenas salvar observação
    if (isFinalizado && editando) {
      if (form.novaObservacao.trim() || form.novosArquivos.length > 0) {
        const obs = [...editando.observacoes, { id: generateId(), texto: form.novaObservacao.trim(), autor: usuario?.nome ?? '', data: new Date().toISOString(), arquivos: form.novosArquivos }];
        setSegurosNovos(segurosNovos.map(s => s.id === editando.id ? { ...editando, observacoes: obs, atualizadoEm: new Date().toISOString() } : s));
      }
      setEditando(null); setCriando(false);
      return;
    }
    if (!form.nomeCliente.trim() && !clienteSelecionado) {
      alert('Informe o nome do cliente ou selecione um cliente cadastrado.');
      return;
    }
    if (form.status === 'fechado') {
      const erros: string[] = [];
      if (!form.seguradora) erros.push('Seguradora');
      if (!form.inicioVigencia) erros.push('Início de Vigência');
      if (!(parseFloat(form.premioLiquido) > 0)) erros.push('Prêmio Líquido');
      if (!(parseFloat(form.percentComissao) > 0)) erros.push('% Comissão');
      if (erros.length > 0) {
        alert(`Para fechar o negócio, preencha os dados obrigatórios do seguro:\n• ${erros.join('\n• ')}`);
        return;
      }
    }
    if (form.status === 'perdido' && !form.motivoPerdaId) {
      alert('Selecione o motivo de perda para "Perdido".');
      return;
    }
    const { comissao, comissaoAReceber } = calcCom(form);
    const nomeCliente = clienteSelecionado?.nome || form.nomeCliente;
    const emailCliente = clienteSelecionado?.email || form.emailCliente;
    const telefoneCliente = clienteSelecionado?.telefone || form.telefoneCliente;
    const cpfCnpjCliente = (clienteSelecionado?.cpfCnpj || form.cpfCnpjCliente).replace(/\D/g, '');

    if (criando) {
      // ── Auto-criar cliente se não vinculado e houver nome + CPF/CNPJ ──
      let autoClienteId = clienteSelecionado?.id;
      if (!clienteSelecionado && nomeCliente.trim() && cpfCnpjCliente.trim()) {
        const cpfDigits = cpfCnpjCliente.replace(/\D/g, '');
        const existente = clientes.find(c => c.cpfCnpj.replace(/\D/g, '') === cpfDigits);
        if (existente) {
          autoClienteId = existente.id;
        } else {
          const tipo: 'PF' | 'PJ' = cpfDigits.length === 14 ? 'PJ' : 'PF';
          const novoCliente: Cliente = {
            id: generateId(),
            cpfCnpj: cpfDigits,
            tipo,
            nome: nomeCliente.trim(),
            email: emailCliente.trim(),
            telefone: telefoneCliente.trim(),
            cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          };
          setClientes([...clientes, novoCliente]);
          autoClienteId = novoCliente.id;
        }
      }

      const novo: SeguroNovo = {
        id: generateId(),
        responsavelId: form.responsavelId,
        clienteId: autoClienteId,
        nomeCliente, emailCliente, telefoneCliente, cpfCnpjCliente,
        inicioVigencia: form.inicioVigencia,
        ramo: form.ramo,
        seguradora: form.seguradora,
        premioLiquido: parseFloat(form.premioLiquido) || 0,
        percentComissao: parseFloat(form.percentComissao) || 0,
        comissao, comissaoAReceber,
        status: form.status,
        motivoPerdaId: form.status === 'perdido' ? form.motivoPerdaId : undefined,
        observacoes: (form.novaObservacao.trim() || form.novosArquivos.length > 0)
          ? [{ id: generateId(), texto: form.novaObservacao.trim(), autor: usuario?.nome ?? '', data: new Date().toISOString(), arquivos: form.novosArquivos }]
          : [],
        camposCustomizados: [],
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      setSegurosNovos([...segurosNovos, novo]);

      // Auto-criar prospecção se motivo gera prospeccao
      if (novo.status === 'perdido' && novo.motivoPerdaId) {
        const motivoSel = motivos.find(m => m.id === novo.motivoPerdaId);
        if (motivoSel?.geraProspeccao) {
          const novaProsp: Prospeccao = {
            id: generateId(),
            origem: 'seguro_novo_perdido',
            origemId: novo.id,
            responsavelId: novo.responsavelId,
            clienteId: novo.clienteId,
            nomeCliente: novo.nomeCliente,
            emailCliente: novo.emailCliente,
            telefoneCliente: novo.telefoneCliente,
            cpfCnpjCliente: novo.cpfCnpjCliente,
            ramo: novo.ramo,
            seguradora: novo.seguradora,
            premioReferencia: novo.premioLiquido,
            dataContato: novo.inicioVigencia || new Date().toISOString().split('T')[0],
            status: 'a_contatar',
            observacoes: [],
            criadoEm: new Date().toISOString(),
            atualizadoEm: new Date().toISOString(),
          };
          setProspeccoes([...prospeccoes, novaProsp]);
        }
      }
    } else if (editando) {
      const obs: Observacao[] = (form.novaObservacao.trim() || form.novosArquivos.length > 0)
        ? [...editando.observacoes, { id: generateId(), texto: form.novaObservacao.trim(), autor: usuario?.nome ?? '', data: new Date().toISOString(), arquivos: form.novosArquivos }]
        : editando.observacoes;

      const updated: SeguroNovo = {
        ...editando,
        responsavelId: form.responsavelId,
        clienteId: clienteSelecionado?.id ?? editando.clienteId,
        nomeCliente, emailCliente, telefoneCliente, cpfCnpjCliente,
        inicioVigencia: form.inicioVigencia,
        ramo: form.ramo,
        seguradora: form.seguradora,
        premioLiquido: parseFloat(form.premioLiquido) || 0,
        percentComissao: parseFloat(form.percentComissao) || 0,
        comissao, comissaoAReceber,
        status: form.status,
        motivoPerdaId: form.status === 'perdido' ? form.motivoPerdaId : undefined,
        observacoes: obs,
        atualizadoEm: new Date().toISOString(),
      };
      setSegurosNovos(segurosNovos.map(s => s.id === updated.id ? updated : s));

      // Auto-criar prospecção se motivo gera prospeccao e não existe ainda
      if (updated.status === 'perdido' && updated.motivoPerdaId) {
        const motivoSel = motivos.find(m => m.id === updated.motivoPerdaId);
        if (motivoSel?.geraProspeccao) {
          const jaExiste = prospeccoes.some(p => p.origemId === updated.id);
          if (!jaExiste) {
            const novaProsp: Prospeccao = {
              id: generateId(),
              origem: 'seguro_novo_perdido',
              origemId: updated.id,
              responsavelId: updated.responsavelId,
              clienteId: updated.clienteId,
              nomeCliente: updated.nomeCliente,
              emailCliente: updated.emailCliente,
              telefoneCliente: updated.telefoneCliente,
              cpfCnpjCliente: updated.cpfCnpjCliente,
              ramo: updated.ramo,
              seguradora: updated.seguradora,
              premioReferencia: updated.premioLiquido,
              dataContato: updated.inicioVigencia || new Date().toISOString().split('T')[0],
              status: 'a_contatar',
              observacoes: [],
              criadoEm: new Date().toISOString(),
              atualizadoEm: new Date().toISOString(),
            };
            setProspeccoes([...prospeccoes, novaProsp]);
          }
        }
      }
    }
    fecharModal();
  }

  function exportarCSV() {
    const headers = ['ID','Responsável','Cliente','Email','Telefone','CPF/CNPJ','Início Vigência','Ramo','Seguradora','Prêmio Líquido','%Comissão','Comissão','Com.Receber','Status','Motivo'];
    const rows = segurosNovos.map(s => [
      s.id, usuarios.find(u => u.id === s.responsavelId)?.nome ?? s.responsavelId,
      s.nomeCliente, s.emailCliente, s.telefoneCliente, s.cpfCnpjCliente,
      s.inicioVigencia, s.ramo, s.seguradora, s.premioLiquido, s.percentComissao,
      s.comissao, s.comissaoAReceber, STATUS_LABELS[s.status],
      motivos.find(m => m.id === s.motivoPerdaId)?.nome ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF' + csv);
    a.download = `seguros_novos_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  }

  const { comissao: formComissao } = calcCom(form);
  const responsavelNome = (id: string) => usuarios.find(u => u.id === id)?.nome ?? id;
  const modalAberto = editando !== null || criando;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Seguros Novos</h1>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportarCSV} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            <Download size={14} /> Exportar
          </button>
          <button onClick={() => setImportandoPdf(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg text-sm hover:bg-blue-100">
            <FileUp size={14} /> Importar PDF
          </button>
          <button onClick={abrirCriacao} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
            <Plus size={14} /> Novo Seguro
          </button>
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
          {(Object.keys(STATUS_LABELS) as StatusSeguroNovo[]).map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
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
        <table className="w-full text-xs">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Cliente / Responsável','Vigência','Ramo','Seguradora / Prêmio','Comissão','Status',''].map((h, i) => (
                <th key={i} className="px-2 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum seguro novo encontrado</td></tr>
            ) : filtered.map(s => (
              <tr key={s.id} onDoubleClick={() => abrirEdicao(s)} className="hover:bg-gray-50 transition-colors cursor-pointer select-none" title="Duplo clique para abrir">

                {/* Cliente + Responsável */}
                <td className="px-2 py-2 max-w-[160px]">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-gray-800 truncate">{s.nomeCliente}</span>
                    {s.clienteId && <UserCheck size={10} className="text-blue-500 shrink-0" title="Cliente vinculado" />}
                    {(() => {
                      const obs = clientes.find(c => c.id === s.clienteId)?.observacaoImportante;
                      if (!obs) return null;
                      return (
                        <span className="relative group inline-flex shrink-0">
                          <Bell size={11} className="text-amber-500 cursor-help" />
                          <span className="pointer-events-none absolute bottom-full left-0 mb-2 z-50 hidden group-hover:block w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed whitespace-normal">
                            {obs}
                            <span className="absolute top-full left-4 border-4 border-transparent border-t-gray-900" />
                          </span>
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-gray-400 truncate">{responsavelNome(s.responsavelId)}</div>
                </td>

                {/* Vigência */}
                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{formatDate(s.inicioVigencia)}</td>

                {/* Ramo */}
                <td className="px-2 py-2 text-gray-700 whitespace-nowrap">{s.ramo}</td>

                {/* Seguradora + Prêmio + % agrupados */}
                <td className="px-2 py-2">
                  <div className="text-gray-700 whitespace-nowrap">{s.seguradora || '—'}</div>
                  <div className="text-gray-400 whitespace-nowrap">{formatCurrency(s.premioLiquido)} · {formatPercent(s.percentComissao)}</div>
                </td>

                {/* Comissão bruta */}
                <td className="px-2 py-2 text-gray-700 whitespace-nowrap font-medium">{formatCurrency(s.comissao)}</td>

                {/* Status */}
                <td className="px-2 py-2">
                  <span className={`inline-block px-1.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[s.status]}`}>
                    {STATUS_LABELS[s.status]}
                  </span>
                  {s.motivoPerdaId && (
                    <div className="text-gray-400 mt-0.5 truncate max-w-[100px]">{motivos.find(m => m.id === s.motivoPerdaId)?.nome}</div>
                  )}
                </td>

                {/* Ações */}
                <td className="px-2 py-2">
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => abrirEdicao(s)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                      <Edit2 size={13} />
                    </button>
                    {s.observacoes.length > 0 && (
                      <span className="flex items-center gap-0.5 text-gray-400">
                        <MessageSquare size={11} />{s.observacoes.length}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Criar / Editar */}
      {modalAberto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900">{criando ? 'Novo Seguro' : 'Editar Seguro Novo'}</h2>
                {(() => {
                  const cli = clienteSelecionado ?? clientes.find(c => c.id === editando?.clienteId || (editando?.cpfCnpjCliente && c.cpfCnpj === editando.cpfCnpjCliente)) ?? null;
                  const nome = cli?.nome ?? editando?.nomeCliente;
                  if (!nome) return null;
                  return cli ? (
                    <div
                      className="text-sm text-blue-600 mt-0.5 cursor-pointer hover:text-blue-800 underline underline-offset-2 select-none inline-flex items-center gap-1"
                      onClick={() => setClienteVisualizando(cli)}
                      title="Clique para ver dados do cliente"
                    >
                      {nome}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 mt-0.5">{nome}</div>
                  );
                })()}
              </div>
              <button onClick={fecharModal} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Full-width banners */}
            <div className="shrink-0 px-5 pt-4 space-y-3">
              {/* Banner de negócio finalizado */}
              {isFinalizado && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <Lock size={14} className="shrink-0" />
                  <span>Negócio finalizado — campos bloqueados. Somente observações podem ser adicionadas.</span>
                </div>
              )}
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left column — client info */}
              <div className="w-2/5 overflow-y-auto p-5 space-y-5 border-r border-gray-100">
                {/* ── Seleção de cliente cadastrado ── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Cliente Cadastrado
                    </h3>
                    {clienteSelecionado && (
                      <span className="text-xs text-blue-600">Dados preenchidos automaticamente</span>
                    )}
                  </div>
                  <ClienteSearch
                    clientes={clientes}
                    clienteSelecionado={clienteSelecionado}
                    onSelect={handleSelecionarCliente}
                  />
                  {!clienteSelecionado && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      Opcional — selecione para vincular e preencher os dados automaticamente, ou preencha manualmente abaixo.
                    </p>
                  )}
                  {(() => {
                    const obs = clienteSelecionado?.observacaoImportante;
                    if (!obs) return null;
                    return (
                      <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mt-3">
                        <Bell size={15} className="text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Atenção — Observação do Cliente</p>
                          <p className="text-sm text-amber-900">{obs}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ── Dados do cliente (manual ou preenchido) ── */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados do Cliente</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nome <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={form.nomeCliente}
                        onChange={e => setForm(f => ({...f, nomeCliente: e.target.value}))}
                        disabled={isFinalizado || !!clienteSelecionado}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={form.emailCliente}
                        onChange={e => setForm(f => ({...f, emailCliente: e.target.value}))}
                        disabled={isFinalizado || !!clienteSelecionado}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                      <input
                        value={form.telefoneCliente}
                        onChange={e => setForm(f => ({...f, telefoneCliente: e.target.value}))}
                        disabled={isFinalizado || !!clienteSelecionado}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ</label>
                      <input
                        value={form.cpfCnpjCliente}
                        onChange={e => setForm(f => ({...f, cpfCnpjCliente: e.target.value}))}
                        disabled={isFinalizado || !!clienteSelecionado}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column — insurance fields, tasks, observations */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Banner: campos obrigatórios para "Fechado" */}
                {!isFinalizado && form.status === 'fechado' && (!form.seguradora || !form.inicioVigencia || !(parseFloat(form.premioLiquido) > 0) || !(parseFloat(form.percentComissao) > 0)) && (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      Para fechar o negócio, preencha os campos obrigatórios marcados com <span className="text-red-500 font-bold">*</span>: seguradora, início de vigência, prêmio líquido e % de comissão.
                    </p>
                  </div>
                )}

                {/* ── Dados do seguro ── */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados do Seguro</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Início de Vigência
                        {form.status === 'fechado' && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input type="date" value={form.inicioVigencia}
                        onChange={e => setForm(f => ({...f, inicioVigencia: e.target.value}))}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !isFinalizado && form.status === 'fechado' && !form.inicioVigencia
                            ? 'border-red-400 bg-red-50' : 'border-gray-300'
                        }`} />
                    </div>

                    {(isAdmin || isGestor || !isCampoRestrito('responsavelId')) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                        <select value={form.responsavelId}
                          onChange={e => setForm(f => ({...f, responsavelId: e.target.value}))}
                          disabled={isFinalizado || isCampoRestrito('responsavelId')}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(isFinalizado || isCampoRestrito('responsavelId')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                          {usuariosVisiveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Ramo</label>
                      <select value={form.ramo} onChange={e => setForm(f => ({...f, ramo: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Selecione...</option>
                        {ramosOrd.map(r => <option key={r.id} value={r.nome}>{r.nome}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Seguradora
                        {form.status === 'fechado' && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <select value={form.seguradora} onChange={e => setForm(f => ({...f, seguradora: e.target.value}))}
                        disabled={isFinalizado || isCampoRestrito('seguradora')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (isFinalizado || isCampoRestrito('seguradora')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                          : (!isFinalizado && form.status === 'fechado' && !form.seguradora) ? 'border-red-400 bg-red-50'
                          : 'border-gray-300'
                        }`}>
                        <option value="">Selecione...</option>
                        {seguradOrd.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prêmio Líquido (R$)
                        {form.status === 'fechado' && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input type="number" step="0.01" min="0" value={form.premioLiquido}
                        onChange={e => setForm(f => ({...f, premioLiquido: e.target.value}))}
                        disabled={isFinalizado || isCampoRestrito('premioLiquido')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (isFinalizado || isCampoRestrito('premioLiquido')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                          : (!isFinalizado && form.status === 'fechado' && !(parseFloat(form.premioLiquido) > 0)) ? 'border-red-400 bg-red-50'
                          : 'border-gray-300'
                        }`} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        % Comissão
                        {form.status === 'fechado' && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input type="number" step="0.01" min="0" max="100" value={form.percentComissao}
                        onChange={e => setForm(f => ({...f, percentComissao: e.target.value}))}
                        disabled={isFinalizado || isCampoRestrito('percentComissao')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (isFinalizado || isCampoRestrito('percentComissao')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                          : (!isFinalizado && form.status === 'fechado' && !(parseFloat(form.percentComissao) > 0)) ? 'border-red-400 bg-red-50'
                          : 'border-gray-300'
                        }`} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Comissão (calc.)</label>
                      <div className="px-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm text-gray-600">
                        {formatCurrency(formComissao)}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select value={form.status}
                        onChange={e => setForm(f => ({...f, status: e.target.value as StatusSeguroNovo, motivoPerdaId: ''}))}
                        disabled={isFinalizado || isCampoRestrito('status')}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(isFinalizado || isCampoRestrito('status')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                        {(Object.keys(STATUS_LABELS) as StatusSeguroNovo[]).map(s =>
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        )}
                      </select>
                    </div>

                    {form.status === 'perdido' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Motivo de Perda <span className="text-red-500">*</span>
                        </label>
                        <select value={form.motivoPerdaId}
                          onChange={e => setForm(f => ({...f, motivoPerdaId: e.target.value}))}
                          disabled={isFinalizado || isCampoRestrito('motivoPerdaId')}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(isFinalizado || isCampoRestrito('motivoPerdaId')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                          <option value="">Selecione o motivo</option>
                          {motivos.filter(m => m.ativo).sort((a,b) => a.ordem - b.ordem).map(m =>
                            <option key={m.id} value={m.id}>{m.nome}</option>
                          )}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Tarefas ── */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tarefas / Agenda</h3>
                  <TarefasPanel
                    origemTipo="seguro_novo"
                    origemId={editando?.id ?? null}
                    nomeCliente={form.nomeCliente || clienteSelecionado?.nome || ''}
                    responsavelId={form.responsavelId}
                    tarefas={tarefas}
                    setTarefas={setTarefas}
                  />
                </div>

                {/* ── Observações ── */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Observações</h3>
                  <ObservacoesPanel
                    observacoes={editando?.observacoes ?? []}
                    novaObservacao={form.novaObservacao}
                    onChangeNovaObservacao={v => setForm(f => ({...f, novaObservacao: v}))}
                    novosArquivos={form.novosArquivos}
                    onChangeNovosArquivos={a => setForm(f => ({...f, novosArquivos: a}))}
                    placeholder={editando ? 'Nova observação...' : 'Observação inicial (opcional)...'}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200 shrink-0">
              <button onClick={fecharModal} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={salvar} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                <Save size={14} /> {criando ? 'Criar' : isFinalizado ? 'Salvar Observação' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {importandoPdf && (
        <Suspense fallback={null}>
          <ImportarPdfModal
            ramos={ramos}
            onImportar={handleImportarPdf}
            onClose={() => setImportandoPdf(false)}
          />
        </Suspense>
      )}

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir seguro novo"
        message="Tem certeza que deseja excluir este seguro? Esta ação não pode ser desfeita."
        onConfirm={() => { setSegurosNovos(segurosNovos.filter(s => s.id !== confirmExcluir)); setConfirmExcluir(null); }}
        onCancel={() => setConfirmExcluir(null)}
      />

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
    </div>
  );
}
