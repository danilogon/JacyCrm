import { useState, useRef, useEffect } from 'react';
import {
  FileSignature, Plus, X, Upload, CheckCircle, Clock, XCircle,
  AlertTriangle, Search, RefreshCw, User, FileDown, Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  enviarDocumentoParaAssinatura, baixarDocumentoAssinado,
  buscarDocumentId, buscarStatusEnvelope, arquivarDocumento, cancelarEnvelope,
} from '../lib/clicksign';
import { generateId } from '../utils/formatters';
import { supabase } from '../lib/supabase';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { ConfigClickSign, ModeloAssinatura, EnvelopeAssinatura, StatusEnvelope, Cliente, OrigemProspeccao, Usuario, Renovacao, SeguroNovo } from '../types';

interface Props {
  clientes: Cliente[];
  origens: OrigemProspeccao[];
  usuarios: Usuario[];
  envelopes: EnvelopeAssinatura[];
  setEnvelopes: (value: EnvelopeAssinatura[] | ((val: EnvelopeAssinatura[]) => EnvelopeAssinatura[])) => void;
  renovacoes: Renovacao[];
  segurosNovos: SeguroNovo[];
  config: ConfigClickSign;
  modelos: ModeloAssinatura[];
}

const STATUS_LABEL: Record<StatusEnvelope, string> = {
  enviado:   'Aguardando',
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
  enviado:   <Clock size={12} />,
  assinado:  <CheckCircle size={12} />,
  cancelado: <XCircle size={12} />,
  expirado:  <AlertTriangle size={12} />,
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function diasDesdeEnvio(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return '1 dia';
  return `${diff} dias`;
}

export function Assinaturas({ clientes, origens, usuarios, envelopes, setEnvelopes, renovacoes, segurosNovos, config, modelos }: Props) {
  const { usuario } = useAuth();

  const [modalAberto, setModalAberto]       = useState(false);
  const [enviando, setEnviando]             = useState(false);
  const [erro, setErro]                     = useState<string | null>(null);
  const [busca, setBusca]                   = useState('');
  const [sincronizando, setSincronizando]   = useState(false);
  const [ultimaSync, setUltimaSync]         = useState<string | null>(null);
  const [baixando, setBaixando]             = useState<string | null>(null);
  const [erroDownload, setErroDownload]     = useState<{ id: string; msg: string } | null>(null);
  const [filtroStatus, setFiltroStatus]     = useState<StatusEnvelope | 'todos'>('todos');
  const [cancelandoId, setCancelandoId]       = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [erroCancel, setErroCancel]           = useState<{ id: string; msg: string } | null>(null);

  // Modal — busca de cliente
  const [buscaCliente, setBuscaCliente]             = useState('');
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [dropdownAberto, setDropdownAberto]         = useState(false);
  const buscaRef   = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState({
    nomeSignatario:  '',
    emailSignatario: '',
    modeloId:        '',
    mensagemCustom:  '',
    origemId:        '',
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
    setForm(f => ({ ...f, nomeSignatario: cliente.nome, emailSignatario: cliente.email }));
  }

  function limparCliente() {
    setClienteSelecionado(null);
    setBuscaCliente('');
    setForm(f => ({ ...f, nomeSignatario: '', emailSignatario: '' }));
    setTimeout(() => buscaRef.current?.focus(), 50);
  }

  function abrirModal() {
    setForm({
      nomeSignatario:  '',
      emailSignatario: '',
      modeloId:        modelos[0]?.id ?? '',
      mensagemCustom:  '',
      origemId:        '',
    });
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

  // ── Arquivamento no Supabase Storage ─────────────────────────────────────
  async function arquivarSeNecessario(lista: EnvelopeAssinatura[]) {
    if (!config.token || lista.length === 0) return;
    for (const env of lista) {
      const resultado = await arquivarDocumento(
        config.token,
        env.envelopeIdClicksign,
        env.documentIdClicksign,
        env.nomeDocumento,
      );
      if (resultado.ok && resultado.url) {
        setEnvelopes(prev => prev.map(e =>
          e.id === env.id ? { ...e, documentoStorageUrl: resultado.url } : e
        ));
      }
    }
  }

  // ── Sincronização de status ───────────────────────────────────────────────
  async function sincronizarStatus() {
    if (envelopes.length === 0) return;
    setSincronizando(true);
    try {
      const pendentes = envelopes.filter(
        e => e.status !== 'assinado' && e.status !== 'cancelado' && e.status !== 'expirado'
      );

      // Passo 1: API ClickSign
      const recemAssinados: EnvelopeAssinatura[] = [];
      if (pendentes.length > 0 && config.token) {
        const atualizacoes: Record<string, StatusEnvelope> = {};
        await Promise.all(
          pendentes.map(async e => {
            const status = await buscarStatusEnvelope(config.token, e.envelopeIdClicksign);
            if (status && status !== e.status) atualizacoes[e.id] = status;
            if (status === 'assinado') recemAssinados.push(e);
          })
        );
        if (Object.keys(atualizacoes).length > 0) {
          setEnvelopes(prev => prev.map(e =>
            atualizacoes[e.id] ? { ...e, status: atualizacoes[e.id] } : e
          ));
        }
      }

      // Passo 2: popular documentIdClicksign nos que ainda não têm
      const semDocId = pendentes.filter(e => !e.documentIdClicksign);
      if (semDocId.length > 0 && config.token) {
        const novoDocIds: Record<string, string> = {};
        await Promise.all(
          semDocId.map(async e => {
            const docId = await buscarDocumentId(config.token, e.envelopeIdClicksign);
            if (docId) novoDocIds[e.id] = docId;
          })
        );
        if (Object.keys(novoDocIds).length > 0) {
          setEnvelopes(prev => prev.map(e =>
            novoDocIds[e.id] ? { ...e, documentIdClicksign: novoDocIds[e.id] } : e
          ));
        }
      }

      // Passo 3: fallback Supabase
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
        const recemAssinadosSup: EnvelopeAssinatura[] = [];
        setEnvelopes(prev => prev.map(e => {
          if (e.status === 'assinado' || e.status === 'cancelado' || e.status === 'expirado') return e;
          const novoStatus =
            maiorStatus[e.envelopeIdClicksign] ??
            (e.documentIdClicksign ? maiorStatus[e.documentIdClicksign] : undefined);
          if (novoStatus === 'assinado') recemAssinadosSup.push(e);
          return novoStatus && novoStatus !== e.status ? { ...e, status: novoStatus } : e;
        }));
        await arquivarSeNecessario(recemAssinadosSup);
      }

      // Passo 4: arquivar assinados sem URL
      const assinadosSemUrl = envelopes.filter(
        e => e.status === 'assinado' && !e.documentoStorageUrl
      );
      await arquivarSeNecessario(assinadosSemUrl);
      await arquivarSeNecessario(recemAssinados);

      setUltimaSync(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setSincronizando(false);
    }
  }

  useEffect(() => { sincronizarStatus(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Download ──────────────────────────────────────────────────────────────
  async function abrirDocumentoAssinado(env: EnvelopeAssinatura) {
    if (env.documentoStorageUrl) {
      window.open(env.documentoStorageUrl, '_blank');
      return;
    }
    setBaixando(env.id);
    setErroDownload(null);
    const resultado = await baixarDocumentoAssinado(
      config.token, env.envelopeIdClicksign, env.documentIdClicksign
    );
    setBaixando(null);
    if (!resultado.ok) {
      setErroDownload({ id: env.id, msg: resultado.erro ?? 'Erro ao baixar documento.' });
      return;
    }
    window.open(resultado.blobUrl!, '_blank');
    arquivarDocumento(config.token, env.envelopeIdClicksign, env.documentIdClicksign, env.nomeDocumento)
      .then(r => {
        if (r.ok && r.url) {
          setEnvelopes(prev => prev.map(e =>
            e.id === env.id ? { ...e, documentoStorageUrl: r.url } : e
          ));
        }
      });
  }

  // ── Cancelar envelope ────────────────────────────────────────────────────
  async function confirmarCancelamento(env: EnvelopeAssinatura) {
    setCancelandoId(env.id);
    setConfirmCancelId(null);
    setErroCancel(null);

    // API v1 exige documentKey — busca se ainda não estiver salvo
    let documentKey = env.documentIdClicksign;
    if (!documentKey) {
      const fetched = await buscarDocumentId(config.token, env.envelopeIdClicksign);
      if (fetched) {
        documentKey = fetched;
        setEnvelopes(prev => prev.map(e =>
          e.id === env.id ? { ...e, documentIdClicksign: fetched } : e
        ));
      }
    }

    if (!documentKey) {
      setCancelandoId(null);
      setErroCancel({ id: env.id, msg: 'Não foi possível obter o ID do documento no ClickSign.' });
      return;
    }

    const resultado = await cancelarEnvelope(config.token, documentKey);
    setCancelandoId(null);

    if (resultado.ok) {
      setEnvelopes(prev => prev.map(e =>
        e.id === env.id ? { ...e, status: 'cancelado' } : e
      ));
    } else {
      setErroCancel({ id: env.id, msg: resultado.erro ?? 'Erro ao cancelar no ClickSign.' });
    }
  }

  // ── Enviar documento ──────────────────────────────────────────────────────
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
      origemId:             form.origemId || undefined,
      origemTipo:           'manual',
      nomeDocumento:        arquivo.nome,
      nomeSignatario:       form.nomeSignatario.trim(),
      emailSignatario:      form.emailSignatario.trim(),
      modeloId:             form.modeloId || undefined,
      status:               'enviado',
      linkAssinatura:       resultado.linkAssinatura,
      avisoEnvio:           resultado.erro,
      clienteId:            clienteSelecionado?.id,
      responsavelId:        usuario?.id ?? '',
      criadoEm:             new Date().toISOString(),
    };

    setEnvelopes(prev => [novoEnvelope, ...prev]);
    setModalAberto(false);
  }

  // ── Filtros ───────────────────────────────────────────────────────────────
  const envelopesFiltrados = envelopes.filter(e => {
    const cliente = clientes.find(c => c.id === e.clienteId);
    const matchBusca =
      e.nomeSignatario.toLowerCase().includes(busca.toLowerCase()) ||
      e.emailSignatario.toLowerCase().includes(busca.toLowerCase()) ||
      (cliente?.nome ?? '').toLowerCase().includes(busca.toLowerCase());
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

  const origensAtivas = origens.filter(o => o.ativo);

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
            title={ultimaSync ? `Última sync: ${ultimaSync}` : 'Sincronizar status'}
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
            Token do ClickSign não configurado.{' '}
            <a href="/configuracoes" className="underline font-medium">Configure em Configurações → Assinaturas</a>.
          </span>
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">

        {/* Barra de busca + filtros */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-48">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por cliente, e-mail…"
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Negócio</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Cliente</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">E-mail enviado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Origem</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Enviado em</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Usuário</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">Documento</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {envelopesFiltrados.map(env => {
                  const cliente = clientes.find(c => c.id === env.clienteId);
                  const origem  = origensAtivas.find(o => o.id === env.origemId);

                  const negocioId = (() => {
                    if (env.origemTipo === 'renovacoes')
                      return renovacoes.find(r => r.id === env.origemRegistroId)?.negocioId;
                    if (env.origemTipo === 'seguros_novos')
                      return segurosNovos.find(s => s.id === env.origemRegistroId)?.negocioId;
                    return undefined;
                  })();

                  return (
                    <tr key={env.id} className="hover:bg-gray-50">

                      {/* Negócio */}
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {negocioId
                          ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">#{negocioId}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* Cliente */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 font-medium text-gray-800">
                          {cliente
                            ? <><User size={13} className="text-blue-400 shrink-0" />{cliente.nome}</>
                            : <span className="text-gray-400 italic text-xs">—</span>
                          }
                        </div>
                      </td>

                      {/* E-mail enviado */}
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {env.emailSignatario}
                      </td>

                      {/* Origem — somente leitura */}
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {origem
                          ? <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full">{origem.nome}</span>
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* Enviado em */}
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        <div>{formatDate(env.criadoEm)}</div>
                        <div className="text-gray-400 mt-0.5">{diasDesdeEnvio(env.criadoEm)}</div>
                      </td>

                      {/* Usuário solicitante */}
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {usuarios.find(u => u.id === env.responsavelId)?.nome ?? <span className="text-gray-300">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[env.status]}`}>
                          {STATUS_ICON[env.status]}
                          {STATUS_LABEL[env.status]}
                        </span>
                      </td>

                      {/* Documento */}
                      <td className="px-4 py-3">
                        {env.status === 'assinado' && (
                          <>
                            <button
                              onClick={() => abrirDocumentoAssinado(env)}
                              disabled={baixando === env.id}
                              title={env.documentoStorageUrl ? 'Abrir documento salvo' : 'Baixar do ClickSign'}
                              className="flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium disabled:opacity-50"
                            >
                              {baixando === env.id
                                ? <><Loader2 size={12} className="animate-spin" /> Baixando…</>
                                : <><FileDown size={12} /> {env.documentoStorageUrl ? 'Abrir' : 'Baixar'}</>
                              }
                            </button>
                            {erroDownload?.id === env.id && (
                              <p className="text-[10px] text-red-600 mt-1">{erroDownload.msg}</p>
                            )}
                          </>
                        )}
                      </td>

                      {/* Ação cancelar */}
                      <td className="px-3 py-3 text-right">
                        {env.status === 'enviado' && (
                          cancelandoId === env.id ? (
                            <Loader2 size={14} className="animate-spin text-gray-400 mx-auto" />
                          ) : (
                            <button
                              onClick={() => { setConfirmCancelId(env.id); setErroCancel(null); }}
                              title="Cancelar assinatura"
                              className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <X size={15} />
                            </button>
                          )
                        )}
                        {erroCancel?.id === env.id && (
                          <p className="text-[10px] text-red-600 mt-1 text-left">{erroCancel.msg}</p>
                        )}
                      </td>

                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
                  Cliente <span className="text-gray-400 font-normal">(opcional)</span>
                </label>
                <div className="relative" ref={dropdownRef}>
                  {clienteSelecionado ? (
                    <div className="flex items-center gap-2 px-3 py-2 border border-blue-300 bg-blue-50 rounded-lg">
                      <User size={15} className="text-blue-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-blue-800 truncate">{clienteSelecionado.nome}</div>
                        <div className="text-xs text-blue-500 truncate">{clienteSelecionado.email}</div>
                      </div>
                      <button onClick={limparCliente} className="text-blue-400 hover:text-blue-600 shrink-0">
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
                                <span>·</span>
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

              {/* Origem */}
              {origensAtivas.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
                  <select
                    value={form.origemId}
                    onChange={e => setForm(f => ({ ...f, origemId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Selecionar origem —</option>
                    {origensAtivas.map(o => (
                      <option key={o.id} value={o.id}>{o.nome}</option>
                    ))}
                  </select>
                </div>
              )}

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
                    {arquivo
                      ? <span className="text-green-600 font-medium">✓ {arquivo.nome}</span>
                      : 'Clique para selecionar o PDF'
                    }
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
                {modelos.length > 0 && (
                  <select
                    value={form.modeloId}
                    onChange={e => setForm(f => ({ ...f, modeloId: e.target.value, mensagemCustom: '' }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
                  >
                    <option value="">— Digitar mensagem manualmente —</option>
                    {modelos.map(m => (
                      <option key={m.id} value={m.id}>{m.nome}</option>
                    ))}
                  </select>
                )}
                {form.modeloId && modeloSelecionado ? (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 whitespace-pre-wrap">
                    {mensagemFinal}
                  </div>
                ) : (
                  <textarea
                    value={form.mensagemCustom}
                    onChange={e => setForm(f => ({ ...f, mensagemCustom: e.target.value }))}
                    rows={3}
                    placeholder="Mensagem que será enviada ao signatário..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                )}
                <p className="text-xs text-gray-400 mt-1">Variáveis: {`{{nome}}`}, {`{{email}}`}</p>
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
                {enviando
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Enviando…</>
                  : <><FileSignature size={15} /> Enviar para Assinatura</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmCancelId}
        title="Cancelar assinatura"
        message="Deseja cancelar este envelope de assinatura? O documento será cancelado no ClickSign e o cliente não poderá mais assinar."
        confirmLabel="Cancelar assinatura"
        onConfirm={() => {
          const env = envelopes.find(e => e.id === confirmCancelId);
          if (env) confirmarCancelamento(env);
        }}
        onCancel={() => { setConfirmCancelId(null); setErroCancel(null); }}
      />
    </div>
  );
}
