import { useState, useMemo } from 'react';
import { Plus, X, Search, UserCheck, Target, ExternalLink, CheckCircle2, Download, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type {
  Prospeccao, StatusProspeccao, Usuario, Seguradora, Ramo,
  SeguroNovo, MotivoPerda, Tarefa, Cliente,
} from '../types';
import { ObservacoesPanel } from '../components/ObservacoesPanel';
import { TarefasPanel } from '../components/TarefasPanel';
import { formatCurrency, formatDate, generateId, formatCpfCnpj } from '../utils/formatters';
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

const ORIGEM_LABELS: Record<string, string> = {
  manual:              'Agendamento',
  renovacao_perdida:   'Renovações',
  seguro_novo_perdido: 'Seguros Novos',
};

const ORIGEM_CORES: Record<string, string> = {
  manual:              'bg-purple-100 text-purple-700',
  renovacao_perdida:   'bg-amber-100 text-amber-700',
  seguro_novo_perdido: 'bg-blue-100 text-blue-700',
};

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// ── Form de criação manual (admin/gestor) ──────────────────────────────────────
interface FormNova {
  nomeCliente: string;
  emailCliente: string;
  telefoneCliente: string;
  cpfCnpjCliente: string;
  ramo: string;
  seguradora: string;
  premioReferencia: string;
  dataContato: string;
}

const formNovaVazio = (): FormNova => ({
  nomeCliente: '', emailCliente: '', telefoneCliente: '', cpfCnpjCliente: '',
  ramo: '', seguradora: '', premioReferencia: '', dataContato: new Date().toISOString().split('T')[0],
});

export function ProspeccaoPage({
  prospeccoes, setProspeccoes,
  segurosNovos, setSegurosNovos,
  clientes, setClientes,
  usuarios, seguradoras, ramos, motivos: _motivos,
  tarefas, setTarefas,
  podeDescartar,
}: Props) {
  const { usuario } = useAuth();
  const isAdmin  = usuario?.role === 'admin';
  const isGestor = usuario?.role === 'gestor';

  const now = new Date();
  const [filtroAno, setFiltroAno]     = useState(now.getFullYear());
  const [filtroMes, setFiltroMes]     = useState(now.getMonth() + 1);
  const [busca, setBusca]             = useState('');
  const [filtroRamo, setFiltroRamo]   = useState('');
  const [mostrarEncerradas, setMostrarEncerradas] = useState(false);

  const [visualizando, setVisualizando] = useState<Prospeccao | null>(null);
  const [confirmAssumir, setConfirmAssumir] = useState(false);
  const [criando, setCriando] = useState(false);
  const [formNova, setFormNova] = useState<FormNova>(formNovaVazio());
  const [confirmDescarte, setConfirmDescarte] = useState<string | null>(null);

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
    if (!formNova.nomeCliente.trim()) { alert('Informe o nome do cliente.'); return; }
    if (!formNova.ramo) { alert('Selecione o Ramo. Este campo é obrigatório.'); return; }
    const nova: Prospeccao = {
      id: generateId(),
      origem: 'manual',
      responsavelId: usuario?.id ?? '',
      nomeCliente: formNova.nomeCliente.trim(),
      emailCliente: formNova.emailCliente.trim(),
      telefoneCliente: formNova.telefoneCliente.trim(),
      cpfCnpjCliente: formNova.cpfCnpjCliente.replace(/\D/g, ''),
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
      STATUS_LABELS[p.status], ORIGEM_LABELS[p.origem] ?? p.origem,
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

        const resp = usuarios.find(u => u.nome === respNome);

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
          responsavelId: resp?.id ?? usuario?.id ?? '',
          clienteId: clienteVinc?.id,
          nomeCliente: clienteVinc?.nome ?? nome,
          emailCliente: clienteVinc?.email ?? emailCliente?.trim() ?? '',
          telefoneCliente: clienteVinc?.telefone ?? telefoneCliente?.trim() ?? '',
          cpfCnpjCliente: cpfDigits,
          ramo: ramo.trim(),
          seguradora: seguradora?.trim() ?? '',
          premioReferencia: parseFloat(premioStr) || 0,
          dataContato: dataContato?.trim() || new Date().toISOString().split('T')[0],
          status: 'a_contatar' as const,
          observacoes: [], camposCustomizados: [],
          criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(),
        });
      });

      if (clientesCriados.length > 0) setClientes(clientesAtualizados);
      if (novas.length > 0) setProspeccoes([...prospeccoes, ...novas]);

      const partes: string[] = [];
      partes.push(`✅ ${novas.length} prospecção(ões) importada(s) com sucesso.`);
      if (clientesCriados.length > 0) partes.push(`\n🆕 ${clientesCriados.length} cliente(s) criado(s) automaticamente:\n  • ${clientesCriados.join('\n  • ')}`);
      if (clientesIncompletos.length > 0) partes.push(`\n⚠️ ${clientesIncompletos.length} cliente(s) com dados incompletos:\n  • ${clientesIncompletos.join('\n  • ')}`);
      if (rejeitadas.length > 0) {
        const detalhe = rejeitadas.map(r => `  • Linha ${r.linha} — "${r.nome}": ${r.motivo}`).join('\n');
        partes.push(`\n❌ ${rejeitadas.length} linha(s) não importada(s):\n${detalhe}`);
      }
      alert(partes.join('\n'));
    };
    reader.readAsText(file);
    e.target.value = '';
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
          {(isAdmin || isGestor) && (
            <button onClick={() => { setCriando(true); setFormNova(formNovaVazio()); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              <Plus size={14} /> Nova Prospecção
            </button>
          )}
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
        <table className="w-full text-sm">
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
                    {ORIGEM_LABELS[p.origem] ?? p.origem}
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
                  <span className="text-xs text-gray-400">{ORIGEM_LABELS[prosp.origem]}</span>
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
                    <div><span className="text-xs text-gray-400 block">Origem</span>{ORIGEM_LABELS[prosp.origem]}</div>
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
              <button onClick={() => setCriando(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Cliente <span className="text-red-500">*</span></label>
                  <input value={formNova.nomeCliente} onChange={e => setFormNova(f => ({ ...f, nomeCliente: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF / CNPJ</label>
                  <input value={formNova.cpfCnpjCliente} onChange={e => setFormNova(f => ({ ...f, cpfCnpjCliente: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input value={formNova.telefoneCliente} onChange={e => setFormNova(f => ({ ...f, telefoneCliente: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                  <input type="email" value={formNova.emailCliente} onChange={e => setFormNova(f => ({ ...f, emailCliente: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
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
    </div>
  );
}
