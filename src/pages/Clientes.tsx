import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Eye, X, Save, Download, Upload, Bell, Link2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as XLSX from 'xlsx';
import type { Cliente, Renovacao, SeguroNovo, Usuario, CampoCustomizavel, TipoVinculo, ImportacaoLote } from '../types';
import { ImportPreviewModal } from '../components/ImportPreviewModal';
import type { LinhaValida, LinhaInvalida } from '../components/ImportPreviewModal';
import { formatCpfCnpj, formatDate, generateId, parseImportDate } from '../utils/formatters';
import { validateCpfCnpj } from '../utils/validators';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DateInput } from '../components/DateInput';
import { Tooltip } from '../components/Tooltip';

interface Props {
  clientes: Cliente[];
  setClientes: (c: Cliente[]) => void;
  renovacoes: Renovacao[];
  segurosNovos: SeguroNovo[];
  usuarios: Usuario[];
  camposCustomizaveis?: CampoCustomizavel[];
  importacoes: ImportacaoLote[];
  setImportacoes: (items: ImportacaoLote[]) => void;
}

type FormCliente = Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm' | 'tipo'>;

const formVazio: FormCliente = {
  cpfCnpj: '', nome: '', email: '', telefone: '', dataNascimento: '',
  observacaoImportante: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  camposCustomizados: [],
};

export function Clientes({ clientes, setClientes, renovacoes, segurosNovos, camposCustomizaveis, importacoes, setImportacoes }: Props) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const isAdmin = usuario?.role === 'admin';
  const camposAplicaveis = (camposCustomizaveis ?? []).filter(c =>
    c.ativo && c.aplicavelA === 'clientes'
  );

  type PreviewImportCli = {
    linhasValidas: LinhaValida[];
    linhasInvalidas: LinhaInvalida[];
    novos: Cliente[];
    nomeArquivo: string;
  };
  const [previewImport, setPreviewImport] = useState<PreviewImportCli | null>(null);
  const [importando, setImportando] = useState(false);

  const [busca, setBusca] = useState('');
  const [filtroFaltando, setFiltroFaltando] = useState<'' | 'telefone' | 'email' | 'nascimento'>('');
  const [modalForm, setModalForm] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [visualizando, setVisualizando] = useState<Cliente | null>(null);
  const [form, setForm] = useState<FormCliente>(formVazio);
  const [confirmExcluir, setConfirmExcluir] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [erroCep, setErroCep] = useState('');
  const [modalVinculo, setModalVinculo] = useState<Cliente | null>(null);
  const [buscaVinculo, setBuscaVinculo] = useState('');
  const [clienteVinculoSel, setClienteVinculoSel] = useState<Cliente | null>(null);
  const [tipoVinculo, setTipoVinculo] = useState<TipoVinculo>('Cônjuge');

  const tipoCpfCnpj = validateCpfCnpj(form.cpfCnpj).tipo ?? 'PF';

  const contFaltando = useMemo(() => ({
    telefone:   clientes.filter(c => !c.telefone?.trim()).length,
    email:      clientes.filter(c => !c.email?.trim()).length,
    nascimento: clientes.filter(c => c.tipo === 'PF' && !c.dataNascimento?.trim()).length,
  }), [clientes]);

  const filtered = useMemo(() => {
    const q = busca.toLowerCase();
    return clientes
      .filter(c => {
        if (q && !c.nome.toLowerCase().includes(q) && !c.cpfCnpj.includes(q) &&
            !c.email.toLowerCase().includes(q) && !c.telefone.includes(q) &&
            !c.cidade.toLowerCase().includes(q)) return false;
        if (filtroFaltando === 'telefone'   && c.telefone?.trim())                           return false;
        if (filtroFaltando === 'email'      && c.email?.trim())                              return false;
        if (filtroFaltando === 'nascimento' && (c.tipo !== 'PF' || c.dataNascimento?.trim())) return false;
        return true;
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [clientes, busca, filtroFaltando]);

  async function buscarCep(cep: string) {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    setErroCep('');
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await resp.json();
      if (data.erro) { setErroCep('CEP não encontrado.'); return; }
      setForm(f => ({
        ...f,
        logradouro: data.logradouro ?? f.logradouro,
        bairro: data.bairro ?? f.bairro,
        cidade: data.localidade ?? f.cidade,
        uf: data.uf ?? f.uf,
      }));
    } catch {
      setErroCep('Erro ao buscar CEP.');
    } finally {
      setBuscandoCep(false);
    }
  }

  function abrirCriacao() {
    setForm(formVazio);
    setEditando(null);
    setModalForm(true);
  }

  function abrirEdicao(c: Cliente) {
    setForm({
      cpfCnpj: c.cpfCnpj, nome: c.nome, email: c.email, telefone: c.telefone,
      dataNascimento: c.dataNascimento ?? '',
      observacaoImportante: c.observacaoImportante ?? '',
      cep: c.cep, logradouro: c.logradouro,
      numero: c.numero, complemento: c.complemento, bairro: c.bairro, cidade: c.cidade, uf: c.uf,
      camposCustomizados: c.camposCustomizados ?? [],
    });
    setEditando(c);
    setModalForm(true);
  }

  function salvar() {
    const cpfDigits = form.cpfCnpj.replace(/\D/g, '');
    const { tipo } = validateCpfCnpj(cpfDigits);
    if (!tipo) { alert('CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.'); return; }
    if (!form.nome.trim()) { alert('Nome é obrigatório.'); return; }

    const duplicado = clientes.find(c => c.cpfCnpj === cpfDigits && c.id !== editando?.id);
    if (duplicado) { alert('Já existe um cliente com este CPF/CNPJ.'); return; }

    if (editando) {
      // Busca a versão mais recente do cliente no array (pode ter vinculos
      // criados após o modal ser aberto — editando é stale)
      const clienteAtual = clientes.find(c => c.id === editando.id) ?? editando;
      const updated: Cliente = {
        ...clienteAtual,
        cpfCnpj: cpfDigits,
        tipo,
        nome: form.nome.trim(),
        email: form.email,
        telefone: form.telefone,
        dataNascimento: tipo === 'PF' ? form.dataNascimento : undefined,
        observacaoImportante: form.observacaoImportante?.trim() || undefined,
        cep: form.cep.replace(/\D/g, ''),
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        camposCustomizados: form.camposCustomizados ?? [],
        // vinculos vêm de clienteAtual (fresco), nunca do editando stale
        atualizadoEm: new Date().toISOString(),
      };
      setClientes(clientes.map(c => c.id === updated.id ? updated : c));
    } else {
      const novo: Cliente = {
        id: generateId(),
        cpfCnpj: cpfDigits,
        tipo,
        nome: form.nome.trim(),
        email: form.email,
        telefone: form.telefone,
        dataNascimento: tipo === 'PF' ? form.dataNascimento : undefined,
        observacaoImportante: form.observacaoImportante?.trim() || undefined,
        cep: form.cep.replace(/\D/g, ''),
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        camposCustomizados: form.camposCustomizados ?? [],
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      setClientes([...clientes, novo]);
    }
    setModalForm(false);
    setEditando(null);
  }

  function excluir(id: string) {
    const temRen = renovacoes.some(r => r.clienteId === id);
    const temSn = segurosNovos.some(s => s.clienteId === id);
    if (temRen || temSn) {
      alert('Não é possível excluir este cliente pois está vinculado a renovações ou seguros.');
      return;
    }
    setConfirmExcluir(id);
  }

  function criarVinculo() {
    if (!modalVinculo || !clienteVinculoSel) return;

    // Sempre usa dados frescos do array para evitar stale closure
    const clienteA = clientes.find(c => c.id === modalVinculo.id);
    const clienteB = clientes.find(c => c.id === clienteVinculoSel.id);
    if (!clienteA || !clienteB) return;

    const updatedA: Cliente = {
      ...clienteA,
      vinculos: [
        ...(clienteA.vinculos ?? []).filter(v => v.clienteId !== clienteB.id),
        { clienteId: clienteB.id, tipo: tipoVinculo },
      ],
      atualizadoEm: new Date().toISOString(),
    };
    const updatedB: Cliente = {
      ...clienteB,
      vinculos: [
        ...(clienteB.vinculos ?? []).filter(v => v.clienteId !== clienteA.id),
        { clienteId: clienteA.id, tipo: tipoVinculo },
      ],
      atualizadoEm: new Date().toISOString(),
    };

    setClientes(clientes.map(c =>
      c.id === updatedA.id ? updatedA :
      c.id === updatedB.id ? updatedB : c
    ));

    setModalVinculo(null);
    setBuscaVinculo('');
    setClienteVinculoSel(null);
    setTipoVinculo('Cônjuge');
  }

  function removerVinculo(clienteBaseId: string, vinculoClienteId: string) {
    // Lê sempre do array fresco
    const clienteBase = clientes.find(c => c.id === clienteBaseId);
    const clienteB = clientes.find(c => c.id === vinculoClienteId);
    if (!clienteBase) return;

    const updatedA: Cliente = {
      ...clienteBase,
      vinculos: (clienteBase.vinculos ?? []).filter(v => v.clienteId !== vinculoClienteId),
      atualizadoEm: new Date().toISOString(),
    };
    const updatedB = clienteB ? {
      ...clienteB,
      vinculos: (clienteB.vinculos ?? []).filter(v => v.clienteId !== clienteBaseId),
      atualizadoEm: new Date().toISOString(),
    } : null;

    setClientes(clientes.map(c =>
      c.id === updatedA.id ? updatedA :
      (updatedB && c.id === updatedB.id) ? updatedB : c
    ));
  }

  // ── XLSX helpers ─────────────────────────────────────────────────────────────

  function exportarXLSX() {
    const headers = ['CPF_CNPJ','Nome','Email','Telefone','Data_Nascimento','CEP','Logradouro','Numero','Complemento','Bairro','Cidade','UF','Observacao_Importante'];
    const rows = clientes.map(c => [
      c.cpfCnpj, c.nome, c.email, c.telefone,
      c.dataNascimento ?? '', c.cep, c.logradouro, c.numero,
      c.complemento, c.bairro, c.cidade, c.uf,
      c.observacaoImportante ?? '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, `clientes_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function baixarModeloXLSX() {
    const headers = ['CPF_CNPJ','Nome','Email','Telefone','Data_Nascimento','CEP','Logradouro','Numero','Complemento','Bairro','Cidade','UF','Observacao_Importante'];
    const ex1 = ['12345678901','João da Silva','joao@email.com','11999990000','1985-03-20','01310100','Av. Paulista','1000','Apto 42','Bela Vista','São Paulo','SP','Cliente prefere WhatsApp'];
    const ex2 = ['12345678000195','Empresa ABC Ltda','contato@abc.com.br','1133330000','','04571010','Rua das Flores','200','','Itaim Bibi','São Paulo','SP',''];
    const ws = XLSX.utils.aoa_to_sheet([headers, ex1, ex2]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, 'modelo_importacao_clientes.xlsx');
  }

  function lerXLSX(file: File): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '', raw: true }) as string[][];
        resolve(rows);
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async function importarXLSX(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const allRows = await lerXLSX(file);
    if (allRows.length < 2) { alert('Arquivo XLSX vazio ou sem dados.'); return; }

    const cpfsExistentes = new Set(clientes.map(c => c.cpfCnpj));
    const novos: Cliente[] = [];
    const linhasValidas: LinhaValida[] = [];
    const duplicados: string[] = [];
    const rejeitados: { linha: number; motivo: string }[] = [];

    allRows.slice(1).forEach((cols, idx) => {
      const lineNum = idx + 2;
      const [cpfCnpjRaw, nome, email, telefone, dataNascimento, cep, logradouro, numero, complemento, bairro, cidade, uf, observacaoImportante] = cols.map(c => String(c ?? ''));

      const cpfDigits = (cpfCnpjRaw ?? '').replace(/\D/g, '');
      const nomeClean = (nome ?? '').trim();

      if (!nomeClean) { rejeitados.push({ linha: lineNum, motivo: 'Nome ausente' }); return; }
      if (!cpfDigits) { rejeitados.push({ linha: lineNum, motivo: `${nomeClean} — CPF/CNPJ ausente` }); return; }

      const { tipo } = validateCpfCnpj(cpfDigits);
      if (!tipo) { rejeitados.push({ linha: lineNum, motivo: `${nomeClean} — CPF/CNPJ inválido (${cpfDigits.length} dígitos)` }); return; }

      if (cpfsExistentes.has(cpfDigits)) { duplicados.push(nomeClean); return; }

      cpfsExistentes.add(cpfDigits);
      const novoCliente: Cliente = {
        id: generateId(),
        cpfCnpj: cpfDigits,
        tipo,
        nome: nomeClean,
        email: (email ?? '').trim(),
        telefone: (telefone ?? '').trim(),
        dataNascimento: tipo === 'PF' && dataNascimento?.trim() ? (parseImportDate(dataNascimento) || dataNascimento.trim()) : undefined,
        observacaoImportante: (observacaoImportante ?? '').trim() || undefined,
        cep: (cep ?? '').replace(/\D/g, ''),
        logradouro: (logradouro ?? '').trim(),
        numero: (numero ?? '').trim(),
        complemento: (complemento ?? '').trim(),
        bairro: (bairro ?? '').trim(),
        cidade: (cidade ?? '').trim(),
        uf: (uf ?? '').trim().toUpperCase().slice(0, 2),
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString(),
      };
      novos.push(novoCliente);
      linhasValidas.push({
        linha: lineNum,
        nome: nomeClean,
        detalhe: `CPF ${cpfDigits}`,
        clienteNovo: false,
      });
    });

    // Duplicates and rejections become invalid lines
    const linhasInvalidas: LinhaInvalida[] = [
      ...duplicados.map(nome => ({
        linha: 0,
        nome,
        motivo: 'CPF/CNPJ já cadastrado',
      })),
      ...rejeitados.map(r => ({
        linha: r.linha,
        nome: '',
        motivo: r.motivo,
      })),
    ];

    setPreviewImport({
      linhasValidas,
      linhasInvalidas,
      novos,
      nomeArquivo: file.name,
    });
  }

  async function confirmarImportCli() {
    if (!previewImport) return;
    setImportando(true);
    try {
      const novos = previewImport.novos;
      if (novos.length > 0) setClientes([...clientes, ...novos]);

      const lote: ImportacaoLote = {
        id: generateId(),
        tipo: 'clientes',
        nomeArquivo: previewImport.nomeArquivo,
        totalImportados: novos.length,
        totalRejeitados: previewImport.linhasInvalidas.length,
        idsSalvos: novos.map(c => c.id),
        idsClientesCriados: [],
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

  const clienteRenovacoes = visualizando
    ? renovacoes.filter(r => r.clienteId === visualizando.id || r.cpfCnpjCliente === visualizando.cpfCnpj)
    : [];
  const clienteSeguros = visualizando
    ? segurosNovos.filter(s => s.clienteId === visualizando.id || s.cpfCnpjCliente === visualizando.cpfCnpj)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <button onClick={exportarXLSX} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                <Download size={14} /> Exportar
              </button>
              <button onClick={baixarModeloXLSX} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                <Download size={14} /> Modelo XLSX
              </button>
              <label className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 cursor-pointer">
                <Upload size={14} /> Importar XLSX
                <input type="file" accept=".xlsx" className="hidden" onChange={importarXLSX} />
              </label>
            </>
          )}
          <button onClick={abrirCriacao} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
            <Plus size={14} /> Novo Cliente
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
          <input
            type="text"
            placeholder="Buscar por nome, CPF/CNPJ, email..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filtros de dados faltando */}
        <div className="flex flex-wrap gap-2">
          {([
            { key: '', label: 'Todos', count: undefined as number | undefined },
            { key: 'telefone',   label: 'Sem telefone',        count: contFaltando.telefone },
            { key: 'email',      label: 'Sem e-mail',          count: contFaltando.email },
            { key: 'nascimento', label: 'Sem data nascimento', count: contFaltando.nascimento },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFiltroFaltando(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                filtroFaltando === key
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {label}
              {count !== undefined && count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  filtroFaltando === key ? 'bg-white/20 text-white' : 'bg-orange-100 text-orange-700'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        <span className="ml-auto text-sm text-gray-400 whitespace-nowrap">{filtered.length} cliente(s)</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['CPF/CNPJ','Tipo','Nome','Email','Telefone','Cidade/UF','Ações'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Nenhum cliente encontrado</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} onDoubleClick={() => setVisualizando(c)} className="hover:bg-gray-50 cursor-pointer select-none" title="Duplo clique para ver detalhes">
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap font-mono text-xs">{formatCpfCnpj(c.cpfCnpj)}</td>
                  <td className="px-4 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.tipo === 'PF' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {c.tipo}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-800">
                    <div className="flex items-center gap-1.5">
                      {c.nome}
                      {c.observacaoImportante && (
                        <Tooltip content={c.observacaoImportante} width={240}>
                          <Bell size={13} className="text-amber-500 cursor-help shrink-0" />
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{c.email}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{c.telefone}</td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{c.cidade}/{c.uf}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setVisualizando(c)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Ver detalhes">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => abrirEdicao(c)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => excluir(c.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {modalForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900">{editando ? 'Editar Cliente' : 'Novo Cliente'}</h2>
              <div className="flex items-center gap-2">
                {editando && (
                  <button
                    onClick={() => setModalVinculo(editando)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                  >
                    <Link2 size={14} /> Vincular
                  </button>
                )}
                <button onClick={() => setModalForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF/CNPJ <span className="text-red-500">*</span></label>
                  <input
                    value={form.cpfCnpj}
                    onChange={e => setForm(f => ({...f, cpfCnpj: e.target.value.replace(/\D/g, '')}))}
                    placeholder="Somente números"
                    maxLength={14}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="text-xs text-gray-400 mt-1">
                    {form.cpfCnpj.replace(/\D/g,'').length} dígitos — {tipoCpfCnpj === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                  <input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
                  <input value={form.telefone} onChange={e => setForm(f => ({...f, telefone: e.target.value}))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {tipoCpfCnpj === 'PF' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                    <DateInput value={form.dataNascimento} onChange={e => setForm(f => ({...f, dataNascimento: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}
              </div>

              {/* Observação importante */}
              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Bell size={13} className="text-amber-500" />
                  Observação Importante
                </h3>
                <p className="text-xs text-gray-400 mb-2">
                  Informação que o responsável precisa saber antes de falar com este cliente. Será exibida como alerta nas renovações e seguros novos vinculados.
                </p>
                <textarea
                  value={form.observacaoImportante ?? ''}
                  onChange={e => setForm(f => ({ ...f, observacaoImportante: e.target.value }))}
                  placeholder="Ex.: Cliente prefere contato por WhatsApp · Não ligar antes das 9h · Aguardar retorno sobre sinistro em aberto..."
                  rows={3}
                  className="w-full px-3 py-2 border border-amber-200 bg-amber-50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none placeholder:text-gray-400"
                />
              </div>

              <div className="border-t border-gray-100 pt-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Endereço</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                    <div className="flex gap-2">
                      <input
                        value={form.cep}
                        onChange={e => setForm(f => ({...f, cep: e.target.value.replace(/\D/g, '')}))}
                        onBlur={e => buscarCep(e.target.value)}
                        maxLength={8}
                        placeholder="00000000"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button type="button" onClick={() => buscarCep(form.cep)} disabled={buscandoCep}
                        className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg text-sm hover:bg-blue-200 disabled:opacity-60">
                        {buscandoCep ? '...' : 'Buscar'}
                      </button>
                    </div>
                    {erroCep && <div className="text-xs text-red-500 mt-1">{erroCep}</div>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                    <input value={form.logradouro} onChange={e => setForm(f => ({...f, logradouro: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                    <input value={form.numero} onChange={e => setForm(f => ({...f, numero: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                    <input value={form.complemento} onChange={e => setForm(f => ({...f, complemento: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                    <input value={form.bairro} onChange={e => setForm(f => ({...f, bairro: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                    <input value={form.cidade} onChange={e => setForm(f => ({...f, cidade: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                    <input value={form.uf} onChange={e => setForm(f => ({...f, uf: e.target.value.toUpperCase().slice(0,2)}))}
                      maxLength={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>
              </div>

              {/* ── Campos Adicionais ── */}
              {camposAplicaveis.length > 0 && (
                <div className="col-span-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-2">Campos Adicionais</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {camposAplicaveis.map(campo => {
                      const valorAtual = (form.camposCustomizados ?? []).find(c => c.campoId === campo.id)?.valor ?? '';
                      const setValor = (v: string | string[]) => setForm(f => ({
                        ...f,
                        camposCustomizados: (f.camposCustomizados ?? []).some(c => c.campoId === campo.id)
                          ? (f.camposCustomizados ?? []).map(c => c.campoId === campo.id ? { ...c, valor: v } : c)
                          : [...(f.camposCustomizados ?? []), { campoId: campo.id, valor: v }],
                      }));
                      return (
                        <div key={campo.id}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            {campo.nome}{campo.obrigatorio && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          {campo.tipo === 'texto' && (
                            <input type="text" value={valorAtual as string}
                              onChange={e => setValor(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          )}
                          {campo.tipo === 'data' && (
                            <DateInput value={valorAtual as string}
                              onChange={e => setValor(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                          )}
                          {campo.tipo === 'lista' && (
                            <select value={valorAtual as string}
                              onChange={e => setValor(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                              <option value="">— Selecione —</option>
                              {(campo.opcoes ?? []).map(op => <option key={op} value={op}>{op}</option>)}
                            </select>
                          )}
                          {campo.tipo === 'arquivo' && (
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 text-sm text-gray-500">
                                <span>📎 {campo.multiplosArquivos ? 'Selecionar arquivos' : 'Selecionar arquivo'}</span>
                                <input type="file" className="hidden"
                                  accept={(campo.tiposPermitidos ?? []).join(',')}
                                  multiple={!!campo.multiplosArquivos}
                                  onChange={e => {
                                    const files = Array.from(e.target.files ?? []);
                                    const readers = files.map(f => new Promise<string>(resolve => {
                                      const r = new FileReader();
                                      r.onload = ev => resolve(JSON.stringify({ id: crypto.randomUUID(), nome: f.name, tipo: f.type, tamanho: f.size, dataBase64: ev.target?.result as string }));
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
                                          <button type="button" title="Remover" onClick={() => {
                                            if (Array.isArray(valorAtual)) setValor((valorAtual as string[]).filter((_, idx) => idx !== i));
                                            else setValor('');
                                          }} className="p-1 text-red-400 hover:text-red-600">×</button>
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

              {/* ── Vínculos existentes ── */}
              {editando && (() => {
                // Lê vinculos do array fresco (não do objeto stale)
                const vinculos = clientes.find(c => c.id === editando.id)?.vinculos ?? [];
                if (vinculos.length === 0) return null;
                return (
                  <div className="col-span-2">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vínculos</h3>
                    <div className="space-y-1.5">
                      {vinculos.map(v => {
                        const cli = clientes.find(c => c.id === v.clienteId);
                        if (!cli) return null;
                        return (
                          <div key={v.clienteId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                            <div className="flex items-center gap-2">
                              <Link2 size={13} className="text-blue-500 shrink-0" />
                              <span className="font-medium text-gray-800">{cli.nome}</span>
                              <span className="text-xs text-gray-400">· {v.tipo}</span>
                            </div>
                            <button
                              onClick={() => removerVinculo(editando.id, v.clienteId)}
                              className="p-1 text-red-400 hover:text-red-600 rounded"
                              title="Remover vínculo"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => setModalForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={salvar} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                <Save size={14} /> {editando ? 'Salvar' : 'Criar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Visualização */}
      {visualizando && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <div>
                <h2 className="font-bold text-gray-900">{visualizando.nome}</h2>
                <div className="text-sm text-gray-500">{formatCpfCnpj(visualizando.cpfCnpj)} · {visualizando.tipo === 'PF' ? 'Pessoa Física' : 'Pessoa Jurídica'}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setModalVinculo(visualizando); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
                >
                  <Link2 size={14} /> Vincular
                </button>
                <button onClick={() => setVisualizando(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {/* Observação importante em destaque */}
              {visualizando.observacaoImportante && (
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-300 rounded-lg px-4 py-3">
                  <Bell size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Observação Importante</p>
                    <p className="text-sm text-amber-900">{visualizando.observacaoImportante}</p>
                  </div>
                </div>
              )}
              {(() => {
                // Lê vinculos do array fresco (não do objeto stale)
                const vinculos = clientes.find(c => c.id === visualizando.id)?.vinculos ?? [];
                if (vinculos.length === 0) return null;
                return (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vínculos</h3>
                    <div className="space-y-1.5">
                      {vinculos.map(v => {
                        const cli = clientes.find(c => c.id === v.clienteId);
                        if (!cli) return null;
                        return (
                          <div key={v.clienteId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
                            <div className="flex items-center gap-2">
                              <Link2 size={13} className="text-blue-500 shrink-0" />
                              <span className="font-medium text-gray-800">{cli.nome}</span>
                              <span className="text-xs text-gray-400">· {v.tipo}</span>
                            </div>
                            <button
                              onClick={() => removerVinculo(visualizando.id, v.clienteId)}
                              className="p-1 text-red-400 hover:text-red-600 rounded"
                              title="Remover vínculo"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><div className="text-xs text-gray-400">Email</div><div className="text-gray-700">{visualizando.email || '—'}</div></div>
                <div><div className="text-xs text-gray-400">Telefone</div><div className="text-gray-700">{visualizando.telefone || '—'}</div></div>
                {visualizando.dataNascimento && <div><div className="text-xs text-gray-400">Nascimento</div><div className="text-gray-700">{formatDate(visualizando.dataNascimento)}</div></div>}
                <div><div className="text-xs text-gray-400">Endereço</div><div className="text-gray-700">{visualizando.logradouro}, {visualizando.numero} {visualizando.complemento} — {visualizando.bairro}, {visualizando.cidade}/{visualizando.uf}</div></div>
              </div>

              {clienteRenovacoes.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Renovações ({clienteRenovacoes.length})</h3>
                  <div className="space-y-1.5">
                    {clienteRenovacoes.map(r => (
                      <div
                        key={r.id}
                        onDoubleClick={() => { setVisualizando(null); navigate('/renovacoes', { state: { openId: r.id } }); }}
                        className="flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-sm cursor-pointer select-none"
                        title="Duplo clique para abrir"
                      >
                        <span className="text-gray-700">{r.ramo} · {r.seguradoraAnterior}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{formatDate(r.fimVigencia)}</span>
                          <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{r.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {clienteSeguros.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Seguros Novos ({clienteSeguros.length})</h3>
                  <div className="space-y-1.5">
                    {clienteSeguros.map(s => (
                      <div
                        key={s.id}
                        onDoubleClick={() => { setVisualizando(null); navigate('/seguros-novos', { state: { openId: s.id } }); }}
                        className="flex items-center justify-between py-2 px-3 bg-gray-50 hover:bg-blue-50 rounded-lg text-sm cursor-pointer select-none"
                        title="Duplo clique para abrir"
                      >
                        <span className="text-gray-700">{s.ramo} · {s.seguradora}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">{formatDate(s.inicioVigencia)}</span>
                          <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">{s.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {clienteRenovacoes.length === 0 && clienteSeguros.length === 0 && (
                <div className="text-sm text-gray-400 text-center py-4">Nenhuma apólice vinculada a este cliente.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmExcluir}
        title="Excluir cliente"
        message="Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita."
        onConfirm={() => { setClientes(clientes.filter(c => c.id !== confirmExcluir)); setConfirmExcluir(null); }}
        onCancel={() => setConfirmExcluir(null)}
      />

      {/* Modal de Vínculo */}
      {modalVinculo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">Vincular Cliente</h2>
              <button onClick={() => { setModalVinculo(null); setBuscaVinculo(''); setClienteVinculoSel(null); }}
                className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-sm text-gray-600">
                Vinculando a: <span className="font-semibold text-gray-800">{modalVinculo.nome}</span>
              </div>

              {/* Search for client to link */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Buscar cliente para vincular</label>
                {clienteVinculoSel ? (
                  <div className="flex items-center justify-between px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg">
                    <span className="text-sm font-medium text-blue-800">{clienteVinculoSel.nome}</span>
                    <button type="button" onClick={() => setClienteVinculoSel(null)}
                      className="p-0.5 text-blue-400 hover:text-blue-700 rounded"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={buscaVinculo}
                      onChange={e => setBuscaVinculo(e.target.value)}
                      placeholder="Nome ou CPF/CNPJ..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {buscaVinculo.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden max-h-48 overflow-y-auto">
                        {clientes
                          .filter(c =>
                            c.id !== modalVinculo.id &&
                            !(modalVinculo.vinculos ?? []).some(v => v.clienteId === c.id) &&
                            (c.nome.toLowerCase().includes(buscaVinculo.toLowerCase()) ||
                             c.cpfCnpj.includes(buscaVinculo))
                          )
                          .slice(0, 8)
                          .map(c => (
                            <button key={c.id} type="button"
                              onMouseDown={() => { setClienteVinculoSel(c); setBuscaVinculo(''); }}
                              className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0">
                              <div className="font-medium text-gray-800">{c.nome}</div>
                              <div className="text-xs text-gray-400">{c.cpfCnpj}</div>
                            </button>
                          ))
                        }
                        {clientes.filter(c =>
                          c.id !== modalVinculo.id &&
                          !(modalVinculo.vinculos ?? []).some(v => v.clienteId === c.id) &&
                          (c.nome.toLowerCase().includes(buscaVinculo.toLowerCase()) ||
                           c.cpfCnpj.includes(buscaVinculo))
                        ).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-400">Nenhum cliente encontrado</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Relationship type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de vínculo</label>
                <select value={tipoVinculo} onChange={e => setTipoVinculo(e.target.value as TipoVinculo)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Cônjuge">Cônjuge</option>
                  <option value="Filho(a)">Filho(a)</option>
                  <option value="Pai/Mãe">Pai/Mãe</option>
                  <option value="Sócio(a)">Sócio(a)</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => { setModalVinculo(null); setBuscaVinculo(''); setClienteVinculoSel(null); }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button onClick={criarVinculo} disabled={!clienteVinculoSel}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50">
                <Link2 size={14} /> Confirmar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}

      {previewImport && (
        <ImportPreviewModal
          titulo="Importação de Clientes"
          nomeArquivo={previewImport.nomeArquivo}
          linhasValidas={previewImport.linhasValidas}
          linhasInvalidas={previewImport.linhasInvalidas}
          importando={importando}
          onConfirmar={confirmarImportCli}
          onCancelar={() => setPreviewImport(null)}
        />
      )}
    </div>
  );
}
