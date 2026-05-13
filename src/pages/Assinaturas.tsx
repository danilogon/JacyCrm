import { useState, useRef, useEffect } from 'react';
import { FileSignature, Plus, X, Upload, CheckCircle, Clock, XCircle, AlertTriangle, Search, RefreshCw, User, FileDown, Loader2 } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { enviarDocumentoParaAssinatura, baixarDocumentoAssinado, buscarDocumentId } from '../lib/clicksign';
import { generateId } from '../utils/formatters';
import { supabase } from '../lib/supabase';
import type { ConfigClickSign, ModeloAssinatura, EnvelopeAssinatura, StatusEnvelope, Cliente } from '../types';

interface Props {
  clientes: Cliente[];
}

const STATUS_LABEL: Record<StatusEnvelope, string> = {
  enviado:   'Aguardando Assinatura',
  assinado:  'Assinado',
  cancelado: 'Cancelado',
  expirado:  'Expirado',
};

const STATUS_COLOR: Record<StatusEnvelope, string> = {
  enviado:   'bg-yellow-100 text-yellow-700',
  assinado:  'bg-green-100 text-green-700',
  cancelado: 'bg-red-100 text-red-700',
  expirado:  'bg-gray-100 text-gray-500',
};

const STATUS_ICON: Record<StatusEnvelope, React.ReactNode> = {
  enviado:   <Clock size={13} />,
  assinado:  <CheckCircle size={13} />,
  cancelado: <XCircle size={13} />,
  expirado:  <AlertTriangle size={13} />,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function diasDesdeEnvio(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return '1 dia';
  return `${diff} dias`;
}

export function Assinaturas({ clientes }: Props) {
  const [config]    = useLocalStorage<ConfigClickSign>('clicksign_config', { token: '', emailPadrao: '', nomePadrao: '', webhookSecret: '', ativo: false });
  const [modelos]   = useLocalStorage<ModeloAssinatura[]>('clicksign_modelos', []);
  const [envelopes, setEnvelopes] = useLocalStorage<EnvelopeAssinatura[]>('clicksign_envelopes', []);

  const [modalAberto, setModalAberto]     = useState(false);
  const [enviando, setEnviando]           = useState(false);
  const [erro, setErro]                   = useState<string | null>(null);
  const [busca, setBusca]                 = useState('');
  const [sincronizando, setSincronizando]   = useState(false);
  const [ultimaSync, setUltimaSync]         = useState<string | null>(null);
  const [baixando, setBaixando]             = useState<string | null>(null);
  const [erroDownload, setErroDownload]     = useState<{ id: string; msg: string } | null>(null);
  const [filtroStatus, setFiltroStatus]     = useState<StatusEnvelope | 'todos'>('todos');

  // Busca de cliente no modal
  const [buscaCliente, setBuscaCliente]         = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [dropdownAberto, setDropdownAberto]     = useState(false);
  const buscaRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    nomeSignatario:  '',
    emailSignatario: '',
    modeloId:        '',
    mensagemCustom:  '',
  });
  const [arquivo, setArquivo] = useState<{ nome: string; base64: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const tokenOk = config.token.trim().length > 0;

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownAberto(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const clientesFiltrados = buscaCliente.trim().length >= 1
    ? clientes.filter(c =>
        c.nome.toLowerCase().includes(buscaCliente.toLowerCase()) ||
        c.email.toLowerCase().includes(buscaCliente.toLowerCase()) ||
        c.cpfCnpj.includes(buscaCliente)
      ).slice(0, 8)
    : [];

  function selecionarCliente(cliente: Cliente) {
    setClienteSelecionado(cliente);
    setBuscaCliente(cliente.nome);
    setDropdownAberto(false);
    setForm(f => ({
      ...f,
      nomeSignatario:  cliente.nome,
      emailSignatario: cliente.email,
    }));
  }

  function limparCliente() {
    setClienteSelecionado(null);
    setBuscaCliente('');
    setForm(f => ({ ...f, nomeSignatario: '', emailSignatario: '' }));
    setTimeout(() => buscaRef.current?.focus(), 50);
  }

  function abrirModal() {
    setForm({ nomeSignatario: '', emailSignatario: '', modeloId: modelos[0]?.id ?? '', mensagemCustom: '' });
    setArquivo(null);
    setErro(null);
    setClienteSelecionado(null);
    setBuscaCliente('');
    setDropdownAberto(false);
    setModalAberto(true);
  }

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { setErro('Apenas arquivos PDF são aceitos.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setArquivo({ nome: file.name, base64: reader.result as string });
      setErro(null);
    };
    reader.readAsDataURL(file);
  }

  const modeloSelecionado = modelos.find(m => m.id === form.modeloId);
  const mensagemFinal = modeloSelecionado
    ? modeloSelecionado.mensagem
        .replace(/\{\{nome\}\}/g, form.nomeSignatario)
        .replace(/\{\{email\}\}/g, form.emailSignatario)
    : form.mensagemCustom;

  async function sincronizarStatus() {
    if (envelopes.length === 0) return;
    setSincronizando(true);
    try {
      // Passo 1: popular documentIdClicksign nos envelopes que ainda não têm.
      // O ID do documento v3 = chave v1 usada pelo webhook — sem ele não há match.
      const semDocId = envelopes.filter(
        e => !e.documentIdClicksign && e.status !== 'assinado'
      );
      let envelopesAtualizados = envelopes;
      if (semDocId.length > 0 && config.token) {
        const novoDocIds: Record<string, string> = {};
        await Promise.all(
          semDocId.map(async e => {
            const docId = await buscarDocumentId(config.token, e.envelopeIdClicksign);
            if (docId) novoDocIds[e.id] = docId;
          })
        );
        if (Object.keys(novoDocIds).length > 0) {
          envelopesAtualizados = envelopes.map(e =>
            novoDocIds[e.id] ? { ...e, documentIdClicksign: novoDocIds[e.id] } : e
          );
          setEnvelopes(envelopesAtualizados);
        }
      }

      // Passo 2: buscar TODOS os eventos recentes do Supabase (sem filtro de ID)
      // para garantir que encontramos mesmo quando o ID do webhook diverge.
      const { data } = await supabase
        .from('clicksign_eventos')
        .select('envelope_id_clicksign, status_local, recebido_em')
        .not('status_local', 'is', null)
        .order('recebido_em', { ascending: false })
        .limit(500);

      if (data && data.length > 0) {
        const maiorStatus: Record<string, StatusEnvelope> = {};
        for (const ev of data) {
          if (!maiorStatus[ev.envelope_id_clicksign]) {
            maiorStatus[ev.envelope_id_clicksign] = ev.status_local as StatusEnvelope;
          }
        }
        setEnvelopes(prev => prev.map(e => {
          const novoStatus =
            maiorStatus[e.envelopeIdClicksign] ??
            (e.documentIdClicksign ? maiorStatus[e.documentIdClicksign] : undefined);
          return novoStatus && novoStatus !== e.status ? { ...e, status: novoStatus } : e;
        }));
      }

      setUltimaSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setSincronizando(false);
    }
  }

  useEffect(() => { sincronizarStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function abrirDocumentoAssinado(env: EnvelopeAssinatura) {
    setBaixando(env.id);
    setErroDownload(null);
    const resultado = await baixarDocumentoAssinado(config.token, env.envelopeIdClicksign);
    setBaixando(null);
    if (!resultado.ok) {
      setErroDownload({ id: env.id, msg: resultado.erro ?? 'Erro ao baixar documento.' });
      return;
    }
    window.open(resultado.blobUrl!, '_blank');
  }

  async function enviar() {
    if (!arquivo) { setErro('Selecione um arquivo PDF.'); return; }
    if (!form.nomeSignatario.trim()) { setErro('Informe o nome do signatário.'); return; }
    if (!form.emailSignatario.trim()) { setErro('Informe o e-mail do signatário.'); return; }
    if (!mensagemFinal.trim()) { setErro('Defina uma mensagem para o signatário.'); return; }

    setEnviando(true);
    setErro(null);

    const resultado = await enviarDocumentoParaAssinatura({
      token:           config.token,
      nomeArquivo:     arquivo.nome,
      conteudoBase64:  arquivo.base64,
      nomeSignatario:  form.nomeSignatario.trim(),
      emailSignatario: form.emailSignatario.trim(),
      mensagem:        mensagemFinal,
    });

    setEnviando(false);

    if (!resultado.ok) {
      setErro(resultado.erro ?? 'Erro ao enviar documento.');
      return;
    }

    const novoEnvelope: EnvelopeAssinatura = {
      id:                   generateId(),
      envelopeIdClicksign:  resultado.envelopeId!,
      documentIdClicksign:  resultado.documentId,
      nomeDocumento:        arquivo.nome,
      nomeSignatario:       form.nomeSignatario.trim(),
      emailSignatario:      form.emailSignatario.trim(),
      modeloId:             form.modeloId || undefined,
      status:               'enviado',
      linkAssinatura:       resultado.linkAssinatura,
      avisoEnvio:           resultado.erro,
      clienteId:            clienteSelecionado?.id,
      responsavelId:        '',
      criadoEm:             new Date().toISOString(),
    };

    setEnvelopes(prev => [novoEnvelope, ...prev]);
    setModalAberto(false);
  }

  const envelopesFiltrados = envelopes.filter(e => {
    const matchBusca =
      e.nomeSignatario.toLowerCase().includes(busca.toLowerCase()) ||
      e.emailSignatario.toLowerCase().includes(busca.toLowerCase()) ||
      e.nomeDocumento.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = filtroStatus === 'todos' || e.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const contagemPorStatus = {
    todos:     envelopes.length,
    enviado:   envelopes.filter(e => e.status === 'enviado').length,
    assinado:  envelopes.filter(e => e.status === 'assinado').length,
    cancelado: envelopes.filter(e => e.status === 'cancelado').length,
    expirado:  envelopes.filter(e => e.status === 'expirado').length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSignature size={22} className="text-blue-700" />
          <h1 className="text-xl font-bold text-gray-900">Assinaturas Eletrônicas</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={sincronizarStatus}
            disabled={sincronizando}
            title={ultimaSync ? `Última sync: ${ultimaSync}` : 'Sincronizar status via webhook'}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
            {ultimaSync ? `Sync ${ultimaSync}` : 'Sincronizar'}
          </button>
          <button
            onClick={abrirModal}
            disabled={!tokenOk}
            title={!tokenOk ? 'Configure o token do ClickSign em Configurações → Assinaturas' : ''}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Plus size={15} /> Enviar Documento
          </button>
        </div>
      </div>

      {/* Aviso sem token */}
      {!tokenOk && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <AlertTriangle size={16} className="shrink-0 text-amber-500" />
          <span>
            Token do ClickSign não configurado ou inativo.{' '}
            <a href="/configuracoes" className="underline font-medium">Configure em Configurações → Assinaturas</a>.
          </span>
        </div>
      )}

      {/* Busca + lista */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por signatário, e-mail ou documento…"
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
            />
          </div>
          <div className="flex items-center gap-1">
            {([
              { key: 'todos',     label: 'Todos' },
              { key: 'enviado',   label: 'Aguardando' },
              { key: 'assinado',  label: 'Assinado' },
              { key: 'cancelado', label: 'Cancelado' },
              { key: 'expirado',  label: 'Expirado' },
            ] as { key: StatusEnvelope | 'todos'; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFiltroStatus(key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  filtroStatus === key
                    ? 'bg-blue-700 text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {label}
                {contagemPorStatus[key] > 0 && (
                  <span className={`ml-1 ${filtroStatus === key ? 'text-blue-200' : 'text-gray-400'}`}>
                    {contagemPorStatus[key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {envelopesFiltrados.length === 0 ? (
          <div className="py-14 text-center text-gray-400 text-sm">
            <FileSignature size={32} className="mx-auto mb-3 opacity-30" />
            {busca ? 'Nenhum resultado encontrado.' : 'Nenhum documento enviado ainda.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Documento</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Signatário</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Enviado em</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {envelopesFiltrados.map(env => {
                const cliente = clientes.find(c => c.id === env.clienteId);
                return (
                  <tr key={env.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px] truncate" title={env.nomeDocumento}>
                      {env.nomeDocumento}
                      {env.avisoEnvio && (
                        <span title={env.avisoEnvio}>
                          <AlertTriangle size={13} className="inline ml-1 text-amber-400" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800 flex items-center gap-1">
                        {cliente && <User size={12} className="text-blue-400 shrink-0" />}
                        {env.nomeSignatario}
                      </div>
                      <div className="text-xs text-gray-400">{env.emailSignatario}</div>
                      {cliente && <div className="text-xs text-blue-500 mt-0.5">Cliente vinculado</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[env.status]}`}>
                        {STATUS_ICON[env.status]}
                        {STATUS_LABEL[env.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      <div>{formatDate(env.criadoEm)}</div>
                      <div className="text-gray-400 mt-0.5">{diasDesdeEnvio(env.criadoEm)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          {env.status === 'assinado' && (
                            <button
                              onClick={() => abrirDocumentoAssinado(env)}
                              disabled={baixando === env.id}
                              title="Abrir documento assinado"
                              className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium disabled:opacity-50"
                            >
                              {baixando === env.id
                                ? <><Loader2 size={12} className="animate-spin" /> Baixando…</>
                                : <><FileDown size={12} /> Documento</>}
                            </button>
                          )}
                          <select
                            value={env.status}
                            onChange={e => setEnvelopes(prev => prev.map(x => x.id === env.id ? { ...x, status: e.target.value as StatusEnvelope } : x))}
                            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400"
                          >
                            <option value="enviado">Aguardando</option>
                            <option value="assinado">Assinado</option>
                            <option value="cancelado">Cancelado</option>
                            <option value="expirado">Expirado</option>
                          </select>
                        </div>
                        {erroDownload?.id === env.id && (
                          <p className="text-xs text-red-600">{erroDownload.msg}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal novo envelope */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Enviar Documento para Assinatura</h2>
              <button onClick={() => setModalAberto(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">

              {/* Busca de cliente */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente <span className="text-gray-400 font-normal">(opcional — preenche nome e e-mail automaticamente)</span>
                </label>
                <div className="relative" ref={dropdownRef}>
                  {clienteSelecionado ? (
                    <div className="flex items-center gap-2 px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg">
                      <User size={15} className="text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-blue-800 truncate">{clienteSelecionado.nome}</div>
                        <div className="text-xs text-blue-500 truncate">{clienteSelecionado.email}</div>
                      </div>
                      <button
                        onClick={limparCliente}
                        className="text-blue-400 hover:text-blue-600 shrink-0"
                        title="Remover cliente"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          ref={buscaRef}
                          value={buscaCliente}
                          onChange={e => { setBuscaCliente(e.target.value); setDropdownAberto(true); }}
                          onFocus={() => buscaCliente.trim() && setDropdownAberto(true)}
                          placeholder="Buscar cliente por nome, e-mail ou CPF/CNPJ…"
                          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      {dropdownAberto && clientesFiltrados.length > 0 && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                          {clientesFiltrados.map(c => (
                            <button
                              key={c.id}
                              onMouseDown={() => selecionarCliente(c)}
                              className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-50 last:border-0"
                            >
                              <div className="text-sm font-medium text-gray-800">{c.nome}</div>
                              <div className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                                <span>{c.email || <span className="italic text-gray-300">sem e-mail</span>}</span>
                                <span className="text-gray-200">·</span>
                                <span>{c.cpfCnpj}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                      {dropdownAberto && buscaCliente.trim().length >= 1 && clientesFiltrados.length === 0 && (
                        <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-3 text-sm text-gray-400 text-center">
                          Nenhum cliente encontrado
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Upload PDF */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Documento PDF</label>
                <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={handleArquivo} />
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-200 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  <Upload size={22} />
                  <span className="text-sm">
                    {arquivo ? (
                      <span className="text-green-600 font-medium">✓ {arquivo.nome}</span>
                    ) : (
                      'Clique para selecionar o PDF'
                    )}
                  </span>
                </button>
              </div>

              {/* Nome e e-mail do signatário */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Signatário</label>
                  <input
                    value={form.nomeSignatario}
                    onChange={e => setForm(f => ({ ...f, nomeSignatario: e.target.value }))}
                    placeholder="Nome e Sobrenome"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-mail do Signatário</label>
                  <input
                    type="email"
                    value={form.emailSignatario}
                    onChange={e => setForm(f => ({ ...f, emailSignatario: e.target.value }))}
                    placeholder="email@exemplo.com"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Mensagem */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Mensagem</label>
                {modelos.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      value={form.modeloId}
                      onChange={e => setForm(f => ({ ...f, modeloId: e.target.value, mensagemCustom: '' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Digitar mensagem manualmente —</option>
                      {modelos.map(m => (
                        <option key={m.id} value={m.id}>{m.nome}</option>
                      ))}
                    </select>
                    {form.modeloId && modeloSelecionado && (
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 whitespace-pre-wrap">
                        {mensagemFinal}
                      </div>
                    )}
                  </div>
                ) : null}
                {!form.modeloId && (
                  <textarea
                    value={form.mensagemCustom}
                    onChange={e => setForm(f => ({ ...f, mensagemCustom: e.target.value }))}
                    rows={3}
                    placeholder="Mensagem que será enviada ao signatário..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none mt-2"
                  />
                )}
                <p className="text-xs text-gray-400 mt-1">Variáveis disponíveis: {`{{nome}}`}, {`{{email}}`}</p>
              </div>

              {erro && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <XCircle size={15} className="shrink-0 mt-0.5" />
                  {erro}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModalAberto(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Cancelar
              </button>
              <button
                onClick={enviar}
                disabled={enviando}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60"
              >
                {enviando ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando…</>
                ) : (
                  <><FileSignature size={15} /> Enviar para Assinatura</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
