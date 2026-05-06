import { useState, useMemo, useRef, useEffect, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Plus, Download, Upload, Edit2, X, Save, MessageSquare, Search, UserCheck, Bell, Lock, FileUp, AlertTriangle, Link2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import type { SeguroNovo, Prospeccao, StatusSeguroNovo, Usuario, Seguradora, Ramo, MotivoPerda, CampoCustomizavel, CampoCustomizadoValor, Cliente, Observacao, ArquivoAnexo, Tarefa, OrigemProspeccao, ImportacaoLote } from '../types';
import { ImportPreviewModal } from '../components/ImportPreviewModal';
import type { LinhaValida, LinhaInvalida } from '../components/ImportPreviewModal';
import { ObservacoesPanel } from '../components/ObservacoesPanel';
import { TarefasPanel } from '../components/TarefasPanel';
import { formatCurrency, formatPercent, formatDate, generateId, formatCpfCnpj, parseImportDate, parsePercent } from '../utils/formatters';
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
  origensNegocio: OrigemProspeccao[];
  importacoes: ImportacaoLote[];
  setImportacoes: (items: ImportacaoLote[]) => void;
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
  dataNascimentoCliente: string;
  responsavelId: string;
  inicioVigencia: string;
  ramo: string;
  seguradora: string;
  premioLiquido: string;
  percentComissao: string;
  status: StatusSeguroNovo;
  motivoPerdaId: string;
  origemId: string;
  novaObservacao: string;
  novosArquivos: ArquivoAnexo[];
  camposCustomizados: CampoCustomizadoValor[];
};

const formVazio = (usuarioId: string): FormState => ({
  nomeCliente: '', emailCliente: '', telefoneCliente: '', cpfCnpjCliente: '', dataNascimentoCliente: '',
  responsavelId: usuarioId, inicioVigencia: '', ramo: '', seguradora: '',
  premioLiquido: '', percentComissao: '', status: 'a_trabalhar', motivoPerdaId: '', origemId: '', novaObservacao: '', novosArquivos: [],
  camposCustomizados: [],
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

export function SeguroNovos({ segurosNovos, setSegurosNovos, prospeccoes, setProspeccoes, usuarios, seguradoras, ramos, motivos, clientes, setClientes, tarefas, setTarefas, origensNegocio, camposCustomizaveis, importacoes, setImportacoes }: Props) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.role === 'admin';
  const isGestor = usuario?.role === 'gestor';
  const camposAplicaveis = (camposCustomizaveis ?? []).filter(c =>
    c.ativo && ['seguros_novos', 'ambos', 'seguros_novos_prospeccoes', 'todos'].includes(c.aplicavelA)
  );
  const location = useLocation();
  const navigateSN = useNavigate();

  const isCampoRestrito = (campo: string) => {
    if (!usuario || usuario.role === 'admin' || usuario.role === 'gestor') return false;
    return usuario.camposRestritos?.segurosNovos?.includes(campo) ?? false;
  };

  type PreviewImportSN = {
    linhasValidas: LinhaValida[];
    linhasInvalidas: LinhaInvalida[];
    novas: SeguroNovo[];
    clientesAtualizados: Cliente[];
    idsClientesCriados: string[];
    nomeArquivo: string;
    respNaoEncontrados: string[];
  };
  const [previewImport, setPreviewImport] = useState<PreviewImportSN | null>(null);
  const [importando, setImportando] = useState(false);

  const now = new Date();
  const [filtroAno, setFiltroAno] = useState(now.getFullYear());
  const [filtroMes, setFiltroMes] = useState(now.getMonth() + 1);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroResp, setFiltroResp] = useState(usuario?.role === 'usuario' ? usuario.id : '');

  const [editando, setEditando] = useState<SeguroNovo | null>(null);
  const [criando, setCriando] = useState(false);
  const isFinalizado = !criando && (editando?.status === 'fechado' || editando?.status === 'perdido');
  // Admin pode reeditar mesmo após fechado/perdido
  const bloqueado = isFinalizado && !isAdmin;
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
        if (filtroStatus === 'ativos') { if (s.status === 'fechado' || s.status === 'perdido') return false; }
        else if (filtroStatus && s.status !== filtroStatus) return false;
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
        dataNascimentoCliente: c.dataNascimento ?? '',
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
      dataNascimentoCliente: cliVinc?.dataNascimento ?? '',
      responsavelId: s.responsavelId,
      inicioVigencia: s.inicioVigencia,
      ramo: s.ramo,
      seguradora: s.seguradora,
      premioLiquido: String(s.premioLiquido),
      percentComissao: String(s.percentComissao),
      status: s.status,
      motivoPerdaId: s.motivoPerdaId ?? '',
      origemId: s.origem ?? '',
      novaObservacao: '', novosArquivos: [],
      camposCustomizados: s.camposCustomizados ?? [],
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
    // Negócio finalizado e sem permissão de admin: apenas salvar observação
    if (bloqueado && editando) {
      if (form.novaObservacao.trim() || form.novosArquivos.length > 0) {
        const obs = [...editando.observacoes, { id: generateId(), texto: form.novaObservacao.trim(), autor: usuario?.nome ?? '', data: new Date().toISOString(), arquivos: form.novosArquivos }];
        setSegurosNovos(segurosNovos.map(s => s.id === editando.id ? { ...editando, observacoes: obs, atualizadoEm: new Date().toISOString() } : s));
      }
      setEditando(null); setCriando(false);
      return;
    }
    if (!clienteSelecionado) {
      const camposFaltando: string[] = [];
      if (!form.nomeCliente.trim()) camposFaltando.push('Nome');
      if (!form.cpfCnpjCliente.trim()) camposFaltando.push('CPF/CNPJ');
      if (!form.dataNascimentoCliente.trim()) camposFaltando.push('Data de Nascimento');
      if (!form.telefoneCliente.trim()) camposFaltando.push('Telefone');
      if (!form.emailCliente.trim()) camposFaltando.push('E-mail');
      if (camposFaltando.length > 0) {
        alert(`Para abrir um negócio sem cliente cadastrado, preencha os dados obrigatórios do cliente:\n• ${camposFaltando.join('\n• ')}`);
        return;
      }
    }
    if (!form.ramo) {
      alert('Selecione o Ramo. Este campo é obrigatório.');
      return;
    }
    if (!form.inicioVigencia) {
      alert('Informe o Início de Vigência. Este campo é obrigatório.');
      return;
    }
    if (form.status === 'fechado') {
      const erros: string[] = [];
      if (!form.seguradora) erros.push('Seguradora');
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
            dataNascimento: form.dataNascimentoCliente || undefined,
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
        origem: form.origemId || undefined,
        observacoes: (form.novaObservacao.trim() || form.novosArquivos.length > 0)
          ? [{ id: generateId(), texto: form.novaObservacao.trim(), autor: usuario?.nome ?? '', data: new Date().toISOString(), arquivos: form.novosArquivos }]
          : [],
        camposCustomizados: form.camposCustomizados,
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
            camposCustomizados: [],
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
        origem: form.origemId || undefined,
        observacoes: obs,
        camposCustomizados: form.camposCustomizados,
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
              camposCustomizados: [],
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
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, `seguros_novos_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function baixarModeloCSV() {
    const headers = [
      'Responsavel',
      'Nome do Cliente',
      'Email do Cliente',
      'Telefone do Cliente',
      'Inicio de Vigencia',
      'Ramo',
      'Seguradora',
      'Premio Liquido',
      'Percentual Comissao',
      'CPF/CNPJ Cliente',
      'Status',
    ];
    const exemplo = [
      'João Silva',
      'Maria da Silva',
      'maria@email.com',
      '11999990000',
      '2025-01-15',
      'Auto',
      'Porto Seguro',
      '2500.00',
      '10',
      '12345678901',
      'A Trabalhar',
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, exemplo]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, 'modelo_importacao_seguros_novos.xlsx');
  }

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

    const dataLines = allRows.slice(1);

      const clientesAtualizados = [...clientes];
      const clientesCriados: string[] = [];
      const clientesIncompletos: string[] = [];
      type LinhaRejeitada = { linha: number; nome: string; motivo: string };
      const rejeitadas: LinhaRejeitada[] = [];
      const novas: SeguroNovo[] = [];
      const linhasValidas: LinhaValida[] = [];
      const respNaoEncontrados: string[] = [];

      dataLines.forEach((cols, idx) => {
        const lineNum = idx + 2;
        const [respNome, nomeCliente, emailCliente, telefoneCliente, inicioVigencia, ramo, seguradora, premioStr, percentStr, cpfCnpj, statusCsv] = cols.map(c => String(c ?? ''));

        const nome = nomeCliente?.trim() ?? '';
        const cpfDigits = cpfCnpj?.replace(/\D/g, '') ?? '';
        const cpfValido = cpfDigits.length === 11 || cpfDigits.length === 14;

        const erros: string[] = [];
        if (!nome) erros.push('nome ausente');
        if (!cpfDigits) erros.push('CPF/CNPJ ausente');
        else if (!cpfValido) erros.push(`CPF/CNPJ inválido (${cpfDigits.length} dígitos)`);

        if (erros.length > 0) {
          rejeitadas.push({ linha: lineNum, nome: nome || '(sem nome)', motivo: erros.join(' · ') });
          return;
        }

        const respNomeTrim = respNome?.trim().toLowerCase() ?? '';
        const resp = respNomeTrim
          ? usuarios.find(u => u.nome.trim().toLowerCase() === respNomeTrim)
          : undefined;
        if (respNomeTrim && !resp && !respNaoEncontrados.includes(respNome.trim())) {
          respNaoEncontrados.push(respNome.trim());
        }
        const premioLiquido = parseFloat(premioStr) || 0;
        const percentComissao = parsePercent(percentStr);
        const comissao = premioLiquido * percentComissao / 100;

        const statusImportado = ((): StatusSeguroNovo => {
          const labelMap: Record<string, StatusSeguroNovo> = {
            'a trabalhar': 'a_trabalhar', 'em negociação': 'em_negociacao',
            'em negociacao': 'em_negociacao', 'pendente': 'pendente',
            'a transmitir': 'a_transmitir', 'fechado': 'fechado', 'perdido': 'perdido',
          };
          return labelMap[(statusCsv ?? '').toLowerCase().trim()] ?? 'a_trabalhar';
        })();

        let clienteVinc = clientesAtualizados.find(c => c.cpfCnpj === cpfDigits);
        if (!clienteVinc) {
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
          if (!novoCliente.email || !novoCliente.telefone) clientesIncompletos.push(nome);
          clienteVinc = novoCliente;
        } else {
          if (!clienteVinc.email || !clienteVinc.telefone) {
            if (!clientesIncompletos.includes(clienteVinc.nome)) clientesIncompletos.push(clienteVinc.nome);
          }
        }

        novas.push({
          id: generateId(),
          responsavelId: resp?.id ?? '',
          clienteId: clienteVinc?.id,
          nomeCliente: clienteVinc?.nome ?? nome,
          emailCliente: clienteVinc?.email ?? emailCliente?.trim() ?? '',
          telefoneCliente: clienteVinc?.telefone ?? telefoneCliente?.trim() ?? '',
          cpfCnpjCliente: cpfDigits,
          inicioVigencia: parseImportDate(inicioVigencia),
          ramo: ramo?.trim() ?? '',
          seguradora: seguradora?.trim() ?? '',
          premioLiquido,
          percentComissao,
          comissao,
          comissaoAReceber: comissao,
          status: statusImportado,
          observacoes: [], camposCustomizados: [],
          criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(),
        });
        const isNovo = !clientes.some(c => c.cpfCnpj === cpfDigits);
        linhasValidas.push({
          linha: lineNum,
          nome: clienteVinc?.nome ?? nome,
          detalhe: `CPF ${cpfDigits} · início ${inicioVigencia?.trim() || '?'}`,
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

  async function confirmarImportSN() {
    if (!previewImport) return;
    setImportando(true);
    try {
      if (previewImport.idsClientesCriados.length > 0) setClientes(previewImport.clientesAtualizados);
      const novas = previewImport.novas;
      if (novas.length > 0) setSegurosNovos([...segurosNovos, ...novas]);

      const lote: ImportacaoLote = {
        id: generateId(),
        tipo: 'seguros_novos',
        nomeArquivo: previewImport.nomeArquivo,
        totalImportados: novas.length,
        totalRejeitados: previewImport.linhasInvalidas.length,
        idsSalvos: novas.map(s => s.id),
        idsClientesCriados: previewImport.idsClientesCriados,
        criadoEm: new Date().toISOString(),
        criadoPor: usuario?.id ?? '',
      };
      setImportacoes([...importacoes, lote]);
      setPreviewImport(null);
    } finally {
      setImportando(false);
    }
  }

  const { comissao: formComissao } = calcCom(form);
  const responsavelNome = (id: string) => usuarios.find(u => u.id === id)?.nome ?? id;
  const modalAberto = editando !== null || criando;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Seguros Novos</h1>
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
              <button onClick={() => setImportandoPdf(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-blue-300 text-blue-700 bg-blue-50 rounded-lg text-sm hover:bg-blue-100">
                <FileUp size={14} /> Importar PDF
              </button>
            </>
          )}
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
          <option value="ativos">Todos, exceto concluídos</option>
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
        <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[700px]">
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
                    {s.clienteId && <UserCheck size={10} className="text-blue-500 shrink-0" aria-label="Cliente vinculado" />}
                    {(() => {
                      const obs = clientes.find(c => c.id === s.clienteId)?.observacaoImportante;
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
                      const cli = clientes.find(c => c.id === s.clienteId);
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
                        disabled={bloqueado || !!clienteSelecionado}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${!clienteSelecionado && !form.nomeCliente.trim() ? 'border-red-300' : 'border-gray-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ <span className="text-red-500">*</span></label>
                      <input
                        value={form.cpfCnpjCliente}
                        onChange={e => setForm(f => ({...f, cpfCnpjCliente: e.target.value}))}
                        disabled={bloqueado || !!clienteSelecionado}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${!clienteSelecionado && !form.cpfCnpjCliente.trim() ? 'border-red-300' : 'border-gray-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento <span className="text-red-500">*</span></label>
                      <input
                        type="date"
                        value={form.dataNascimentoCliente}
                        onChange={e => setForm(f => ({...f, dataNascimentoCliente: e.target.value}))}
                        disabled={bloqueado || !!clienteSelecionado}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${!clienteSelecionado && !form.dataNascimentoCliente ? 'border-red-300' : 'border-gray-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Telefone <span className="text-red-500">*</span></label>
                      <input
                        value={form.telefoneCliente}
                        onChange={e => setForm(f => ({...f, telefoneCliente: e.target.value}))}
                        disabled={bloqueado || !!clienteSelecionado}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${!clienteSelecionado && !form.telefoneCliente.trim() ? 'border-red-300' : 'border-gray-300'}`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">E-mail <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        value={form.emailCliente}
                        onChange={e => setForm(f => ({...f, emailCliente: e.target.value}))}
                        disabled={bloqueado || !!clienteSelecionado}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500 ${!clienteSelecionado && !form.emailCliente.trim() ? 'border-red-300' : 'border-gray-300'}`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right column — insurance fields, tasks, observations */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Banner: campos obrigatórios para "Fechado" */}
                {!isFinalizado && form.status === 'fechado' && (!form.seguradora || !(parseFloat(form.premioLiquido) > 0) || !(parseFloat(form.percentComissao) > 0)) && (
                  <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                    <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800">
                      Para fechar o negócio, preencha os campos obrigatórios marcados com <span className="text-red-500 font-bold">*</span>: seguradora, prêmio líquido e % de comissão.
                    </p>
                  </div>
                )}

                {/* ── Dados do seguro ── */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Dados do Seguro</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Início de Vigência <span className="text-red-500">*</span>
                      </label>
                      <input type="date" value={form.inicioVigencia}
                        onChange={e => setForm(f => ({...f, inicioVigencia: e.target.value}))}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          !isFinalizado && !form.inicioVigencia
                            ? 'border-red-400 bg-red-50' : 'border-gray-300'
                        }`} />
                    </div>

                    {(isAdmin || isGestor || !isCampoRestrito('responsavelId')) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                        <select value={form.responsavelId}
                          onChange={e => setForm(f => ({...f, responsavelId: e.target.value}))}
                          disabled={bloqueado || isCampoRestrito('responsavelId')}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(bloqueado || isCampoRestrito('responsavelId')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                          {usuariosVisiveis.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ramo <span className="text-red-500">*</span>
                      </label>
                      <select value={form.ramo} onChange={e => setForm(f => ({...f, ramo: e.target.value}))}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${!form.ramo ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
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
                        disabled={bloqueado || isCampoRestrito('seguradora')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (bloqueado || isCampoRestrito('seguradora')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                          : (!bloqueado && form.status === 'fechado' && !form.seguradora) ? 'border-red-400 bg-red-50'
                          : 'border-gray-300'
                        }`}>
                        <option value="">Selecione...</option>
                        {seguradOrd.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                      </select>
                    </div>

                    {origensNegocio.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Origem do Negócio</label>
                        <select value={form.origemId} onChange={e => setForm(f => ({...f, origemId: e.target.value}))}
                          disabled={bloqueado}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${bloqueado ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
                          <option value="">— Selecione a origem —</option>
                          {origensNegocio.filter(o => o.ativo && !o.isSystem && (!o.aplicavelA || o.aplicavelA === 'seguros_novos' || o.aplicavelA === 'ambos')).map(o => (
                            <option key={o.id} value={o.id}>{o.nome}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Prêmio Líquido (R$)
                        {form.status === 'fechado' && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      <input type="number" step="0.01" min="0" value={form.premioLiquido}
                        onChange={e => setForm(f => ({...f, premioLiquido: e.target.value}))}
                        disabled={bloqueado || isCampoRestrito('premioLiquido')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (bloqueado || isCampoRestrito('premioLiquido')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
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
                        disabled={bloqueado || isCampoRestrito('percentComissao')}
                        className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          (bloqueado || isCampoRestrito('percentComissao')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed border-gray-300'
                          : (!bloqueado && form.status === 'fechado' && !(parseFloat(form.percentComissao) > 0)) ? 'border-red-400 bg-red-50'
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
                        disabled={bloqueado || isCampoRestrito('status')}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(bloqueado || isCampoRestrito('status')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
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
                          disabled={bloqueado || isCampoRestrito('motivoPerdaId')}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${(bloqueado || isCampoRestrito('motivoPerdaId')) ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}>
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

                {/* ── Campos Customizáveis ── */}
                {camposAplicaveis.filter(c => !c.ramosAplicaveis?.length || c.ramosAplicaveis.includes(form.ramo)).length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Campos Adicionais</h3>
                    <div className="space-y-3">
                      {camposAplicaveis.filter(c => !c.ramosAplicaveis?.length || c.ramosAplicaveis.includes(form.ramo)).map(campo => {
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
                              <input type="date" value={valorAtual as string}
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
                <Save size={14} /> {criando ? 'Criar' : bloqueado ? 'Salvar Observação' : 'Salvar'}
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

      {previewImport && (
        <ImportPreviewModal
          titulo="Importação de Seguros Novos"
          nomeArquivo={previewImport.nomeArquivo}
          linhasValidas={previewImport.linhasValidas}
          linhasInvalidas={previewImport.linhasInvalidas}
          avisos={previewImport.respNaoEncontrados.length > 0
            ? [`Responsável(is) não encontrado(s) no sistema: ${previewImport.respNaoEncontrados.join(', ')}`]
            : []}
          importando={importando}
          onConfirmar={confirmarImportSN}
          onCancelar={() => setPreviewImport(null)}
        />
      )}
    </div>
  );
}
