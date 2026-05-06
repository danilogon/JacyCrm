import { useState, useMemo, useRef } from 'react';
import { Plus, X, Search, UserCheck, Target, ExternalLink, CheckCircle2, Download, Upload, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type {
  Prospeccao, StatusProspeccao, Usuario, Seguradora, Ramo,
  SeguroNovo, MotivoPerda, Tarefa, Cliente, OrigemProspeccao, CampoCustomizavel, CampoCustomizadoValor,
  ImportacaoLote,
} from '../types';
import { ImportPreviewModal } from '../components/ImportPreviewModal';
import type { LinhaValida, LinhaInvalida } from '../components/ImportPreviewModal';
import { ObservacoesPanel } from '../components/ObservacoesPanel';
import { TarefasPanel } from '../components/TarefasPanel';
import { formatCurrency, formatDate, generateId, formatCpfCnpj, parseImportDate } from '../utils/formatters';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Props {
  prospeccoes: Prospeccao[];
  setProspeccoes: (p: Prospeccao[]) => void;
  segurosNovos: SeguroNovo[];
  setSegurosNovos: (s: SeguroNovo[]) => void;
  clientes: Cliente[];
  setClientes: (c: Cliente[]) => void;
  usuarios: Usuario[];
  seguradoras: Seguradora[];
  ramos: Ramo[];
  motivos: MotivoPerda[];
  tarefas: Tarefa[];
  setTarefas: (t: Tarefa[]) => void;
  podeDescartar: boolean;
  origensProspeccao: OrigemProspeccao[];
  camposCustomizaveis?: CampoCustomizavel[];
  importacoes: ImportacaoLote[];
  setImportacoes: (items: ImportacaoLote[]) => void;
}

const STATUS_LABELS: Record<StatusProspeccao, string> = {
  a_contatar:      'A Contatar',
  em_contato:      'Em Contato',
  proposta_enviada:'Proposta Enviada',
  convertido:      'Assumida',
  descartado:      'Descartada',
};

const STATUS_CORES: Record<StatusProspeccao, string> = {
  a_contatar:       'bg-gray-100 text-gray-700',
  em_contato:       'bg-blue-100 text-blue-700',
  proposta_enviada: 'bg-yellow-100 text-yellow-800',
  convertido:       'bg-green-100 text-green-700',
  descartado:       'bg-red-100 text-red-700',
};

const ORIGEM_CORES: Record<string, string> = {
  manual:              'bg-purple-100 text-purple-700',
  renovacao_perdida:   'bg-amber-100 text-amber-700',
  seguro_novo_perdido: 'bg-blue-100 text-blue-700',
};

function getOrigemLabel(origensProspeccao: OrigemProspeccao[], origemId: string): string {
  return origensProspeccao.find(o => o.id === origemId)?.nome ?? origemId;
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── Form de criação manual (admin/gestor) ──────────────────────────────────────
interface FormNova {
  nomeCliente: string;
  emailCliente: string;
  telefoneCliente: string;
  cpfCnpjCliente: string;
  dataNascimentoCliente: string;
  ramo: string;
  seguradora: string;
  premioReferencia: string;
  dataContato: string;
  origemId: string;
}

const formNovaVazio = (): FormNova => ({
  nomeCliente: '', emailCliente: '', telefoneCliente: '', cpfCnpjCliente: '', dataNascimentoCliente: '',
  ramo: '', seguradora: '', premioReferencia: '', dataContato: new Date().toISOString().split('T')[0],
  origemId: 'manual',
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

export function ProspeccaoPage({
  prospeccoes, setProspeccoes,
  segurosNovos, setSegurosNovos,
  clientes, setClientes,
  usuarios, seguradoras, ramos, motivos: _motivos,
  tarefas, setTarefas,
  podeDescartar,
  origensProspeccao,
  camposCustomizaveis = [],
  importacoes, setImportacoes,
}: Props) {
  const { usuario } = useAuth();
  const isAdmin  = usuario?.role === 'admin';

  const now = new Date();
  const [filtroAno, setFiltroAno]     = useState(now.getFullYear());
  const [filtroMes, setFiltroMes]     = useState(now.getMonth() + 1);
  const [busca, setBusca]             = useState('');
  const [filtroRamo, setFiltroRamo]   = useState('');
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false);

  type PreviewImportProsp = {
    linhasValidas: LinhaValida[];
    linhasInvalidas: LinhaInvalida[];
    novas: Prospeccao[];
    clientesAtualizados: Cliente[];
    idsClientesCriados: string[];
    nomeArquivo: string;
    respNaoEncontrados: string[];
  };
  const [previewImport, setPreviewImport] = useState<PreviewImportProsp | null>(null);
  const [importando, setImportando] = useState(false);

  const [visualizando, setVisualizando] = useState<Prospeccao | null>(null);
  const [confirmAssumir, setConfirmAssumir] = useState(false);
  const [criando, setCriando] = useState(false);
  const [formNova, setFormNova] = useState<FormNova>(formNovaVazio());
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [confirmDescarte, setConfirmDescarte] = useState<string | null>(null);

  function handleSelecionarCliente(c: Cliente | null) {
    setClienteSelecionado(c);
    if (c) {
      setFormNova(f => ({
        ...f,
        nomeCliente: c.nome,
        emailCliente: c.email,
        telefoneCliente: c.telefone,
        cpfCnpjCliente: c.cpfCnpj,
        dataNascimentoCliente: c.dataNascimento ?? '',
      }));
    }
  }

  // usuariosVisiveis removido — não utilizado na renderização atual

  const ramosOrd = useMemo(() =>
    ramos.filter(r => r.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [ramos]);

  const seguradOrd = useMemo(() =>
    seguradoras.filter(s => s.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [seguradoras]);

  const hoje = new Date().toISOString().split('T')[0];

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>();
    prospeccoes.forEach(p => { if (p.dataContato) set.add(+p.dataContato.split('-')[0]); });
    if (!set.has(now.getFullYear())) set.add(now.getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [prospeccoes]);

  // Todas as prospecções visíveis (oportunidades de todos, sem filtro por responsável)
  const filtradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return prospeccoes
      .filter(p => {
        const encerrada = p.status === 'convertido' || p.status === 'descartado';
        if (!mostrarEncerradas && encerrada) return false;
        // filtro de ano/mês por dataContato
        if (p.dataContato) {
          const [y, m] = p.dataContato.split('-').map(Number);
          if (filtroAno && y !== filtroAno) return false;
          if (filtroMes && m !== filtroMes) return false;
        }
        if (filtroRamo && p.ramo !== filtroRamo) return false;
        if (q && !p.nomeCliente.toLowerCase().includes(q) &&
            !p.cpfCnpjCliente.includes(q) && !p.ramo.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => a.dataContato.localeCompare(b.dataContato));
  }, [prospeccoes, busca, filtroRamo, mostrarEncerradas, filtroAno, filtroMes]);

  const totalAtivas = useMemo(() =>
    prospeccoes.filter(p => p.status !== 'convertido' && p.status !== 'descartado').length,
    [prospeccoes]);

  function nomeUsuario(id?: string) {
    return id ? (usuarios.find(u => u.id === id)?.nome ?? '—') : '—';
  }

  function setCampoCustom(prospId: string, campoId: string, valor: string | string[]) {
    setProspeccoes(prospeccoes.map(p => {
      if (p.id !== prospId) return p;
      const lista = p.camposCustomizados ?? [];
      const atualizado: CampoCustomizadoValor[] = lista.some(c => c.campoId === campoId)
        ? lista.map(c => c.campoId === campoId ? { ...c, valor } : c)
        : [...lista, { campoId, valor }];
      return { ...p, camposCustomizados: atualizado };
    }));
  }

  // ── Assumir prospecção ───────────────────────────────────────────────────────
  function assumir() {
    if (!visualizando || !usuario) return;
    const now = new Date().toISOString();

    // Cria SeguroNovo com dados da prospecção
    const cpfDigits = visualizando.cpfCnpjCliente.replace(/\D/g, '');

    // Auto-criar cliente se não existir
    let clienteId = visualizando.clienteId;
    if (!clienteId && visualizando.nomeCliente && cpfDigits) {
      const existente = clientes.find(c => c.cpfCnpj.replace(/\D/g, '') === cpfDigits);
      if (existente) {
        clienteId = existente.id;
      } else {
        const novoCliente: Cliente = {
          id: generateId(),
          cpfCnpj: cpfDigits,
          tipo: cpfDigits.length === 14 ? 'PJ' : 'PF',
          nome: visualizando.nomeCliente,
          email: visualizando.emailCliente,
          telefone: visualizando.telefoneCliente,
          dataNascimento: visualizando.dataNascimentoCliente || undefined,
          cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
          criadoEm: now,
          atualizadoEm: now,
        };
        setClientes([...clientes, novoCliente]);
        clienteId = novoCliente.id;
      }
    }

    const novoSN: SeguroNovo = {
      id: generateId(),
      responsavelId: usuario.id,
      clienteId,
      nomeCliente: visualizando.nomeCliente,
      emailCliente: visualizando.emailCliente,
      telefoneCliente: visualizando.telefoneCliente,
      cpfCnpjCliente: cpfDigits,
      inicioVigencia: '',
      ramo: visualizando.ramo,
      seguradora: visualizando.seguradora ?? '',
      premioLiquido: visualizando.premioReferencia ?? 0,
      percentComissao: 0,
      comissao: 0,
      comissaoAReceber: 0,
      status: 'a_trabalhar',
      origemProspeccaoId: visualizando.id,
      observacoes: [],
      camposCustomizados: [],
      criadoEm: now,
      atualizadoEm: now,
    };
    setSegurosNovos([...segurosNovos, novoSN]);

    // Atualiza prospecção como assumida
    setProspeccoes(prospeccoes.map(p =>
      p.id === visualizando.id
        ? { ...p, status: 'convertido' as StatusProspeccao, assumidoPor: usuario.id, assumidoEm: now, seguroNovoId: novoSN.id, atualizadoEm: now }
        : p
    ));

    setConfirmAssumir(false);
    setVisualizando(null);
  }

  // ── Criar prospecção manual ──────────────────────────────────────────────────
  function salvarNova() {
    if (!clienteSelecionado) {
      const camposFaltando: string[] = [];
      if (!formNova.nomeCliente.trim()) camposFaltando.push('Nome');
      if (!formNova.cpfCnpjCliente.trim()) camposFaltando.push('CPF/CNPJ');
      if (!formNova.dataNascimentoCliente.trim()) camposFaltando.push('Data de Nascimento');
      if (!formNova.telefoneCliente.trim()) camposFaltando.push('Telefone');
      if (!formNova.emailCliente.trim()) camposFaltando.push('E-mail');
      if (camposFaltando.length > 0) {
        alert(`Para criar uma prospecção sem cliente cadastrado, preencha os dados obrigatórios:\n• ${camposFaltando.join('\n• ')}`);
        return;
      }
    }
    if (!formNova.ramo) { alert('Selecione o Ramo. Este campo é obrigatório.'); return; }

    const nomeCliente     = clienteSelecionado?.nome    || formNova.nomeCliente.trim();
    const emailCliente    = clienteSelecionado?.email    || formNova.emailCliente.trim();
    const telefoneCliente = clienteSelecionado?.telefone || formNova.telefoneCliente.trim();
    const cpfCnpjCliente  = (clienteSelecionado?.cpfCnpj || formNova.cpfCnpjCliente).replace(/\D/g, '');

    // Auto-criar cliente se não vinculado
    let clienteId = clienteSelecionado?.id;
    if (!clienteId && nomeCliente && cpfCnpjCliente) {
      const existente = clientes.find(c => c.cpfCnpj.replace(/\D/g, '') === cpfCnpjCliente);
      if (existente) {
        clienteId = existente.id;
      } else {
        const novoCliente: Cliente = {
          id: generateId(),
          cpfCnpj: cpfCnpjCliente,
          tipo: cpfCnpjCliente.length === 14 ? 'PJ' : 'PF',
          nome: nomeCliente,
          email: emailCliente,
          telefone: telefoneCliente,
          dataNascimento: formNova.dataNascimentoCliente || undefined,
          cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        };
        setClientes([...clientes, novoCliente]);
        clienteId = novoCliente.id;
      }
    }

    const nova: Prospeccao = {
      id: generateId(),
      origem: formNova.origemId || 'manual',
      responsavelId: usuario?.id ?? '',
      clienteId,
      nomeCliente,
      emailCliente,
      telefoneCliente,
      cpfCnpjCliente,
      dataNascimentoCliente: formNova.dataNascimentoCliente || undefined,
      ramo: formNova.ramo,
      seguradora: formNova.seguradora,
      premioReferencia: parseFloat(formNova.premioReferencia) || 0,
      dataContato: formNova.dataContato,
      status: 'a_contatar',
      observacoes: [],
      camposCustomizados: [],
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    setProspeccoes([...prospeccoes, nova]);
    setCriando(false);
    setFormNova(formNovaVazio());
    setClienteSelecionado(null);
  }

  function descartar(id: string) {
    setProspeccoes(prospeccoes.map(p =>
      p.id === id ? { ...p, status: 'descartado' as StatusProspeccao, atualizadoEm: new Date().toISOString() } : p
    ));
    setConfirmDescarte(null);
  }

  function isAtrasada(p: Prospeccao) {
    return p.status !== 'convertido' && p.status !== 'descartado' && p.dataContato < hoje;
  }

  const prosp = visualizando ? prospeccoes.find(p => p.id === visualizando.id) ?? visualizando : null;

  function baixarCSVHelper(conteudo: string, nomeArquivo: string) {
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + conteudo);
    a.download = nomeArquivo;
    a.click();
  }

  function exportarCSV() {
    const headers = ['ID','Responsável','Cliente','Email','Telefone','CPF/CNPJ','Ramo','Seguradora','Prêmio Referência','Data Contato','Status','Origem'];
    const rows = prospeccoes.map(p => [
      p.id,
      nomeUsuario(p.responsavelId),
      p.nomeCliente, p.emailCliente, p.telefoneCliente, p.cpfCnpjCliente,
      p.ramo, p.seguradora, p.premioReferencia, p.dataContato,
      STATUS_LABELS[p.status], getOrigemLabel(origensProspeccao, p.origem),
    ]);
    const csv = [headers, ...rows].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    baixarCSVHelper(csv, `prospeccoes_${new Date().toISOString().split('T')[0]}.csv`);
  }

  function baixarModeloCSV() {
    const headers = [
      'Responsavel',
      'Nome do Cliente',
      'Email do Cliente',
      'Telefone do Cliente',
      'CPF/CNPJ Cliente',
      'Ramo',
      'Seguradora',
      'Premio Referencia',
      'Data Contato',
    ];
    const exemplo = [
      'João Silva',
      'Maria da Silva',
      'maria@email.com',
      '11999990000',
      '12345678901',
      'Auto',
      'Porto Seguro',
      '2500.00',
      '2025-06-30',
    ];
    const csv = [headers, exemplo].map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    baixarCSVHelper(csv, 'modelo_importacao_prospeccoes.csv');
  }

  function importarCSVProspeccao(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter(l => l.trim());
      const dataLines = lines.slice(1);

      const clientesAtualizados = [...clientes];
      const clientesCriados: string[] = [];
      const clientesIncompletos: string[] = [];
      type LinhaRejeitada = { linha: number; nome: string; motivo: string };
      const rejeitadas: LinhaRejeitada[] = [];
      const novas: Prospeccao[] = [];
      const linhasValidas: LinhaValida[] = [];
      const respNaoEncontrados: string[] = [];

      dataLines.forEach((line, idx) => {
        const lineNum = idx + 2;
        const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim());
        const [respNome, nomeCliente, emailCliente, telefoneCliente, cpfCnpj, ramo, seguradora, premioStr, dataContato] = cols;

        const nome = nomeCliente?.trim() ?? '';
        const cpfDigits = cpfCnpj?.replace(/\D/g, '') ?? '';
        const cpfValido = cpfDigits.length === 11 || cpfDigits.length === 14;

        const erros: string[] = [];
        if (!nome) erros.push('nome ausente');
        if (!cpfDigits) erros.push('CPF/CNPJ ausente');
        else if (!cpfValido) erros.push(`CPF/CNPJ inválido (${cpfDigits.length} dígitos)`);
        if (!ramo?.trim()) erros.push('ramo ausente');

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
          origem: 'manual' as const,
          responsavelId: resp?.id ?? '',
          clienteId: clienteVinc?.id,
          nomeCliente: clienteVinc?.nome ?? nome,
          emailCliente: clienteVinc?.email ?? emailCliente?.trim() ?? '',
          telefoneCliente: clienteVinc?.telefone ?? telefoneCliente?.trim() ?? '',
          cpfCnpjCliente: cpfDigits,
          ramo: ramo.trim().toUpperCase(),
          seguradora: (seguradora?.trim() ?? '').toUpperCase(),
          premioReferencia: parseFloat(premioStr) || 0,
          dataContato: parseImportDate(dataContato) || new Date().toISOString().split('T')[0],
          status: 'a_contatar' as const,
          observacoes: [], camposCustomizados: [],
          criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(),
        });
        const isNovo = !clientes.some(c => c.cpfCnpj === cpfDigits);
        linhasValidas.push({
          linha: lineNum,
          nome: clienteVinc?.nome ?? nome,
          detalhe: `CPF ${cpfDigits} · ramo ${ramo?.trim() || '?'}`,
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
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function confirmarImportProsp() {
    if (!previewImport) return;
    setImportando(true);
    try {
      if (previewImport.idsClientesCriados.length > 0) setClientes(previewImport.clientesAtualizados);
      const novas = previewImport.novas;
      if (novas.length > 0) setProspeccoes([...prospeccoes, ...novas]);

      const lote: ImportacaoLote = {
        id: generateId(),
        tipo: 'prospeccoes',
        nomeArquivo: previewImport.nomeArquivo,
        totalImportados: novas.length,
        totalRejeitados: previewImport.linhasInvalidas.length,
        idsSalvos: novas.map(p => p.id),
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

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Prospecção</h1>
          <p className="text-sm text-gray-500 mt-0.5">{totalAtivas} oportunidade{totalAtivas !== 1 ? 's' : ''} ativa{totalAtivas !== 1 ? 's' : ''}</p>
        </div>
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
                <Download size={14} /> Modelo CSV
              </button>
              <label className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">
                <Upload size={14} /> Importar CSV
                <input type="file" accept=".csv" className="hidden" onChange={importarCSVProspeccao} />
              </label>
            </>
          )}
          <button onClick={() => { setCriando(true); setFormNova(formNovaVazio()); setClienteSelecionado(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
            <Plus size={14} /> Nova Prospecção
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        {/* Ano */}
        <select value={filtroAno} onChange={e => setFiltroAno(+e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={0}>Todos os anos</option>
          {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {/* Mês */}
        <select value={filtroMes} onChange={e => setFiltroMes(+e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={0}>Todos os meses</option>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={busca} onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por cliente, CPF ou ramo..."
            className="pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64" />
        </div>
        <select value={filtroRamo} onChange={e => setFiltroRamo(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos os ramos</option>
          {ramosOrd.map(r => <option key={r.id} value={r.nome}>{r.nome}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={mostrarEncerradas} onChange={e => setMostrarEncerradas(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
          Mostrar encerradas
        </label>
        <span className="ml-auto text-sm text-gray-400">{filtradas.length} registro(s)</span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[550px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Cliente','Ramo','Data','Origem',''].map((h, i) => (
                <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">Nenhuma prospecção encontrada</td></tr>
            ) : filtradas.map(p => (
              <tr key={p.id}
                onDoubleClick={() => setVisualizando(p)}
                className="hover:bg-gray-50 cursor-pointer select-none transition-colors"
                title="Duplo clique para ver detalhes">

                {/* Cliente */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-800">{p.nomeCliente}</span>
                    {p.clienteId && <UserCheck size={11} className="text-blue-500 shrink-0" aria-label="Cliente cadastrado" />}
                    {p.assumidoPor && <CheckCircle2 size={11} className="text-green-500 shrink-0" aria-label={`Assumida por ${nomeUsuario(p.assumidoPor)}`} />}
                    {(() => {
                      const obs = clientes.find(c => c.id === p.clienteId)?.observacaoImportante;
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
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{formatCpfCnpj(p.cpfCnpjCliente)}</div>
                </td>

                {/* Ramo */}
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{p.ramo || '—'}</td>

                {/* Data */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={isAtrasada(p) ? 'text-red-600 font-medium' : 'text-gray-700'}>
                    {formatDate(p.dataContato)}
                  </span>
                  {isAtrasada(p) && (
                    <div className="text-red-400 text-xs mt-0.5">Atrasada</div>
                  )}
                </td>

                {/* Origem */}
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ORIGEM_CORES[p.origem] ?? 'bg-gray-100 text-gray-600'}`}>
                    {getOrigemLabel(origensProspeccao, p.origem)}
                  </span>
                </td>

                {/* Ação */}
                <td className="px-4 py-3">
                  <button onClick={e => { e.stopPropagation(); setVisualizando(p); }}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Ver detalhes">
                    <ExternalLink size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── Modal Visualizar ──────────────────────────────────────────────────── */}
      {prosp && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900">{prosp.nomeCliente}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CORES[prosp.status]}`}>
                    {STATUS_LABELS[prosp.status]}
                  </span>
                  <span className="text-xs text-gray-400">{getOrigemLabel(origensProspeccao, prosp.origem)}</span>
                </div>
              </div>
              <button onClick={() => setVisualizando(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Two-column body */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left column — static/context info */}
              <div className="w-2/5 overflow-y-auto p-5 space-y-5 border-r border-gray-100">
                {/* Assumida por */}
                {prosp.assumidoPor && (
                  <div className="flex items-center gap-2.5 px-4 py-3 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        Assumida por {nomeUsuario(prosp.assumidoPor)}
                      </p>
                      {prosp.assumidoEm && (
                        <p className="text-xs text-green-600">
                          em {formatDate(prosp.assumidoEm.split('T')[0])}
                        </p>
                      )}
                    </div>
                    {prosp.seguroNovoId && (
                      <span className="ml-auto text-xs text-green-600 flex items-center gap-1">
                        <Target size={12} /> Seguro Novo criado
                      </span>
                    )}
                  </div>
                )}

                {/* Dados do cliente */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cliente</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div><span className="text-xs text-gray-400 block">CPF/CNPJ</span>{formatCpfCnpj(prosp.cpfCnpjCliente) || '—'}</div>
                    <div><span className="text-xs text-gray-400 block">Telefone</span>{prosp.telefoneCliente || '—'}</div>
                    <div className="col-span-2"><span className="text-xs text-gray-400 block">E-mail</span>{prosp.emailCliente || '—'}</div>
                  </div>
                </div>
              </div>

              {/* Right column — business data, tasks, observations */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Dados do negócio */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Negócio</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <div><span className="text-xs text-gray-400 block">Ramo</span>{prosp.ramo || '—'}</div>
                    <div><span className="text-xs text-gray-400 block">Seguradora</span>{prosp.seguradora || '—'}</div>
                    <div>
                      <span className="text-xs text-gray-400 block">Prêmio Referência</span>
                      {prosp.premioReferencia ? formatCurrency(prosp.premioReferencia) : '—'}
                    </div>
                    <div>
                      <span className="text-xs text-gray-400 block">Data de Contato</span>
                      <span className={isAtrasada(prosp) ? 'text-red-600 font-medium' : ''}>
                        {formatDate(prosp.dataContato)}
                        {isAtrasada(prosp) && ' ⚠ Atrasada'}
                      </span>
                    </div>
                    <div><span className="text-xs text-gray-400 block">Responsável</span>{nomeUsuario(prosp.responsavelId)}</div>
                    <div><span className="text-xs text-gray-400 block">Origem</span>{getOrigemLabel(origensProspeccao, prosp.origem)}</div>
                  </div>
                </div>

                {/* Tarefas */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Tarefas / Agenda</h3>
                  <TarefasPanel
                    origemTipo="prospeccao"
                    origemId={prosp.id}
                    nomeCliente={prosp.nomeCliente}
                    responsavelId={prosp.responsavelId}
                    tarefas={tarefas}
                    setTarefas={setTarefas}
                  />
                </div>

                {/* Observações */}
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Observações</h3>
                  <ObservacoesPanel
                    observacoes={prosp.observacoes ?? []}
                    novaObservacao=""
                    onChangeNovaObservacao={() => {}}
                    novosArquivos={[]}
                    onChangeNovosArquivos={() => {}}
                    somenteLeitura
                  />
                </div>

                {/* Campos Customizáveis */}
                {(() => {
                  const campos = camposCustomizaveis.filter(c =>
                    c.ativo &&
                    ['prospeccoes', 'seguros_novos_prospeccoes', 'todos'].includes(c.aplicavelA) &&
                    (!c.ramosAplicaveis?.length || c.ramosAplicaveis.includes(prosp.ramo))
                  );
                  if (campos.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Campos Adicionais</h3>
                      <div className="space-y-3">
                        {campos.map(campo => {
                          const valorAtual = (prosp.camposCustomizados ?? []).find(c => c.campoId === campo.id)?.valor ?? '';
                          if (campo.tipo === 'texto') return (
                            <div key={campo.id}>
                              <label className="block text-xs font-medium text-gray-600 mb-1">{campo.nome}{campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}</label>
                              <input value={valorAtual as string} onChange={e => setCampoCustom(prosp.id, campo.id, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          );
                          if (campo.tipo === 'data') return (
                            <div key={campo.id}>
                              <label className="block text-xs font-medium text-gray-600 mb-1">{campo.nome}{campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}</label>
                              <input type="date" value={valorAtual as string} onChange={e => setCampoCustom(prosp.id, campo.id, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                          );
                          if (campo.tipo === 'lista') {
                            const opcoes = campo.opcoes ?? [];
                            const selecionados = Array.isArray(valorAtual) ? valorAtual as string[] : (valorAtual ? [valorAtual as string] : []);
                            return (
                              <div key={campo.id}>
                                <label className="block text-xs font-medium text-gray-600 mb-1">{campo.nome}{campo.obrigatorio && <span className="text-red-500 ml-0.5">*</span>}</label>
                                {campo.multiplosArquivos ? (
                                  <div className="flex flex-wrap gap-2">
                                    {opcoes.map(op => (
                                      <button key={op} type="button" onClick={() => {
                                        const novo = selecionados.includes(op) ? selecionados.filter(x => x !== op) : [...selecionados, op];
                                        setCampoCustom(prosp.id, campo.id, novo);
                                      }} className={`px-2 py-1 rounded-full text-xs border ${selecionados.includes(op) ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>{op}</button>
                                    ))}
                                  </div>
                                ) : (
                                  <select value={valorAtual as string} onChange={e => setCampoCustom(prosp.id, campo.id, e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="">Selecione...</option>
                                    {opcoes.map(op => <option key={op} value={op}>{op}</option>)}
                                  </select>
                                )}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 p-5 border-t border-gray-200 shrink-0">
              <div>
                {!prosp.assumidoPor && podeDescartar && (
                  <button
                    onClick={() => setConfirmDescarte(prosp.id)}
                    className="px-3 py-2 text-sm text-red-600 border border-red-200 hover:bg-red-50 rounded-lg"
                  >
                    Descartar
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setVisualizando(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Fechar
                </button>
                {!prosp.assumidoPor && prosp.status !== 'descartado' && (
                  <button
                    onClick={() => setConfirmAssumir(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 font-medium"
                  >
                    <Target size={14} /> Assumir Prospecção
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Criar (admin/gestor) ─────────────────────────────────────────── */}
      {criando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">Nova Prospecção</h2>
              <button onClick={() => { setCriando(false); setClienteSelecionado(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Busca de cliente cadastrado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar Cliente Cadastrado</label>
                <ClienteSearch
                  clientes={clientes}
                  clienteSelecionado={clienteSelecionado}
                  onSelect={handleSelecionarCliente}
                />
              </div>

              {!clienteSelecionado && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Nenhum cliente selecionado — preencha os dados abaixo para cadastrá-lo automaticamente.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome do Cliente <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={formNova.nomeCliente}
                    onChange={e => setFormNova(f => ({ ...f, nomeCliente: e.target.value }))}
                    disabled={!!clienteSelecionado}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 ${!clienteSelecionado && !formNova.nomeCliente.trim() ? 'border-red-300' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF / CNPJ <span className="text-red-500">*</span></label>
                  <input
                    value={formNova.cpfCnpjCliente}
                    onChange={e => setFormNova(f => ({ ...f, cpfCnpjCliente: e.target.value }))}
                    disabled={!!clienteSelecionado}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 ${!clienteSelecionado && !formNova.cpfCnpjCliente.trim() ? 'border-red-300' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento <span className="text-red-500">*</span></label>
                  <input
                    type="date"
                    value={formNova.dataNascimentoCliente}
                    onChange={e => setFormNova(f => ({ ...f, dataNascimentoCliente: e.target.value }))}
                    disabled={!!clienteSelecionado}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 ${!clienteSelecionado && !formNova.dataNascimentoCliente ? 'border-red-300' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone <span className="text-red-500">*</span></label>
                  <input
                    value={formNova.telefoneCliente}
                    onChange={e => setFormNova(f => ({ ...f, telefoneCliente: e.target.value }))}
                    disabled={!!clienteSelecionado}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 ${!clienteSelecionado && !formNova.telefoneCliente.trim() ? 'border-red-300' : 'border-gray-300'}`}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    value={formNova.emailCliente}
                    onChange={e => setFormNova(f => ({ ...f, emailCliente: e.target.value }))}
                    disabled={!!clienteSelecionado}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400 ${!clienteSelecionado && !formNova.emailCliente.trim() ? 'border-red-300' : 'border-gray-300'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ramo <span className="text-red-500">*</span>
                  </label>
                  <select value={formNova.ramo} onChange={e => setFormNova(f => ({ ...f, ramo: e.target.value }))}
                    className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${!formNova.ramo ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}>
                    <option value="">Selecione...</option>
                    {ramosOrd.map(r => <option key={r.id} value={r.nome}>{r.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seguradora</label>
                  <select value={formNova.seguradora} onChange={e => setFormNova(f => ({ ...f, seguradora: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Selecione...</option>
                    {seguradOrd.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                  <select value={formNova.origemId} onChange={e => setFormNova(f => ({ ...f, origemId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {origensProspeccao.filter(o => o.ativo && (o.isSystem || !o.aplicavelA || o.aplicavelA === 'prospeccoes' || o.aplicavelA === 'ambos')).map(o => (
                      <option key={o.id} value={o.id}>{o.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prêmio Referência (R$)</label>
                  <input type="number" min="0" step="0.01" value={formNova.premioReferencia}
                    onChange={e => setFormNova(f => ({ ...f, premioReferencia: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Contato</label>
                  <input type="date" value={formNova.dataContato} onChange={e => setFormNova(f => ({ ...f, dataContato: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => setCriando(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={salvarNova} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">Criar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar assumir */}
      <ConfirmDialog
        open={confirmAssumir}
        title="Assumir Prospecção"
        message={`Deseja assumir a prospecção de "${prosp?.nomeCliente}"? Um novo Seguro Novo será criado no seu nome com status "A Trabalhar".`}
        confirmLabel="Assumir"
        danger={false}
        onConfirm={assumir}
        onCancel={() => setConfirmAssumir(false)}
      />

      {/* Confirmar descarte */}
      <ConfirmDialog
        open={!!confirmDescarte}
        title="Descartar Prospecção"
        message="Tem certeza que deseja descartar esta prospecção? Ela ficará marcada como descartada."
        confirmLabel="Descartar"
        danger
        onConfirm={() => confirmDescarte && descartar(confirmDescarte)}
        onCancel={() => setConfirmDescarte(null)}
      />

      {previewImport && (
        <ImportPreviewModal
          titulo="Importação de Prospecções"
          nomeArquivo={previewImport.nomeArquivo}
          linhasValidas={previewImport.linhasValidas}
          linhasInvalidas={previewImport.linhasInvalidas}
          avisos={previewImport.respNaoEncontrados.length > 0
            ? [`Responsável(is) não encontrado(s) no sistema: ${previewImport.respNaoEncontrados.join(', ')}`]
            : []}
          importando={importando}
          onConfirmar={confirmarImportProsp}
          onCancelar={() => setPreviewImport(null)}
        />
      )}
    </div>
  );
}
