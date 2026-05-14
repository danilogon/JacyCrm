import { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, X, Save, CheckSquare, Square, Check, Lock, CheckCircle2, XCircle, Eye, EyeOff, Copy, Webhook } from 'lucide-react';
import type { Seguradora, Ramo, FormaPagamento, ConfiguracoesMetas, MotivoPerda, CampoCustomizavel, ConfiguracaoEmpresa, FaixaMeta, TipoCampoCustom, PlanoMetaRenovacao, PlanoMetaSeguroNovo, TipoUsuario, Role, OrigemProspeccao, ImportacaoLote, LinhaImportValida, LinhaImportInvalida, Renovacao, SeguroNovo, Prospeccao, Cliente, Usuario, RegraParcelaNegocio, ImportacaoParcelas, AutomacaoParcela, Parcela, ConfigClickSign, ModeloAssinatura, ParcelasApiToken } from '../types';
import { AutomacoesParcelasConfig } from '../components/AutomacoesParcelasConfig';
import { FORMAS_PAGAMENTO_PADRAO } from '../pages/Parcelas';
import { formatCurrency, formatPercent, generateId } from '../utils/formatters';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { testarConexao } from '../lib/clicksign';

interface Props {
  seguradoras: Seguradora[];
  setSeguradoras: (s: Seguradora[]) => void;
  ramos: Ramo[];
  setRamos: (r: Ramo[]) => void;
  formasPagamento: FormaPagamento[];
  setFormasPagamento: (f: FormaPagamento[]) => void;
  metas: ConfiguracoesMetas;
  setMetas: (m: ConfiguracoesMetas) => void;
  motivos: MotivoPerda[];
  setMotivos: (m: MotivoPerda[]) => void;
  campos: CampoCustomizavel[];
  setCampos: (c: CampoCustomizavel[]) => void;
  empresa: ConfiguracaoEmpresa;
  setEmpresa: (e: ConfiguracaoEmpresa) => Promise<void>;
  tiposUsuario: TipoUsuario[];
  setTiposUsuario: (t: TipoUsuario[]) => void;
  origensProspeccao: OrigemProspeccao[];
  setOrigensProspeccao: (o: OrigemProspeccao[]) => void;
  importacoes: ImportacaoLote[];
  setImportacoes: (i: ImportacaoLote[]) => void;
  renovacoes: Renovacao[];
  setRenovacoes: (r: Renovacao[]) => void;
  segurosNovos: SeguroNovo[];
  setSegurosNovos: (s: SeguroNovo[]) => void;
  prospeccoes: Prospeccao[];
  setProspeccoes: (p: Prospeccao[]) => void;
  clientes: Cliente[];
  setClientes: (c: Cliente[]) => void;
  usuarios: Usuario[];
  regrasParcelas: RegraParcelaNegocio[];
  setRegrasParcelas: (r: RegraParcelaNegocio[]) => void;
  importacoesParcelas: ImportacaoParcelas[];
  setImportacoesParcelas: (i: ImportacaoParcelas[]) => void;
  automacoesParcelas: AutomacaoParcela[];
  setAutomacoesParcelas: (a: AutomacaoParcela[]) => void;
  parcelas: Parcela[];
  setParcelas: (p: Parcela[]) => void;
  clicksignConfig: ConfigClickSign;
  setClicksignConfig: (c: ConfigClickSign) => void;
  clicksignModelos: ModeloAssinatura[];
  setClicksignModelos: (items: ModeloAssinatura[]) => void;
  parcelasApiTokens: ParcelasApiToken[];
  setParcelasApiTokens: (t: ParcelasApiToken[]) => void;
}

type Tab = 'empresa' | 'seguradoras' | 'ramos' | 'formas_pagamento' | 'metas' | 'motivos' | 'campos' | 'tipos_usuario' | 'origens_prospeccao' | 'regras_parcelas' | 'importacoes' | 'assinaturas';

function Ck({ v, label, onChange }: { v: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!v)} className="flex items-center gap-1.5 text-sm text-gray-700">
      {v ? <CheckSquare size={15} className="text-blue-600 shrink-0" /> : <Square size={15} className="text-gray-400 shrink-0" />}
      {label}
    </button>
  );
}

// --- Faixas Editor ---
function FaixasEditor({ faixas, onChange, tipo }: { faixas: FaixaMeta[]; onChange: (f: FaixaMeta[]) => void; tipo: 'percent' | 'currency' }) {
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<FaixaMeta>>({});
  const [confirmDel, setConfirmDel] = useState<number | null>(null);

  function abrirNova() {
    setForm({ minimo: 0, maximo: null, tipo: 'percentual', valor: 0 });
    setEditIdx(-1);
  }

  function abrirEd(idx: number) {
    setForm({ ...faixas[idx] });
    setEditIdx(idx);
  }

  function salvar() {
    if (form.minimo === undefined || form.valor === undefined) return;
    const f: FaixaMeta = {
      id: editIdx === -1 ? generateId() : (faixas[editIdx!]?.id ?? generateId()),
      minimo: parseFloat(String(form.minimo)) || 0,
      maximo: form.maximo !== null && form.maximo !== undefined ? parseFloat(String(form.maximo)) : null,
      tipo: form.tipo ?? 'percentual',
      valor: parseFloat(String(form.valor)) || 0,
    };
    if (editIdx === -1) {
      onChange([...faixas, f]);
    } else {
      onChange(faixas.map((x, i) => i === editIdx ? f : x));
    }
    setEditIdx(null);
  }

  function excluir(idx: number) {
    onChange(faixas.filter((_, i) => i !== idx));
    setConfirmDel(null);
  }

  return (
    <div>
      <div className="space-y-1.5 mb-3">
        {faixas.map((f, i) => (
          <div key={f.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg text-sm border border-gray-100">
            <div className="text-gray-700">
              {tipo === 'percent' ? formatPercent(f.minimo, 0) : formatCurrency(f.minimo)}
              {' – '}
              {f.maximo !== null ? (tipo === 'percent' ? formatPercent(f.maximo, 0) : formatCurrency(f.maximo)) : 'Sem limite'}
              <span className="ml-2 text-gray-400">
                {f.tipo === 'percentual' ? `${f.valor}% da comissão` : formatCurrency(f.valor)}
              </span>
            </div>
            <div className="flex gap-1">
              <button onClick={() => abrirEd(i)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={13} /></button>
              <button onClick={() => setConfirmDel(i)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
      <button onClick={abrirNova} className="flex items-center gap-1.5 text-sm text-blue-700 hover:text-blue-800">
        <Plus size={14} /> Adicionar faixa
      </button>

      {editIdx !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Faixa de Meta</h3>
              <button onClick={() => setEditIdx(null)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mínimo</label>
                  <input type="number" step="0.01" value={form.minimo ?? ''} onChange={e => setForm(f => ({...f, minimo: parseFloat(e.target.value)}))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Máximo (vazio = sem limite)</label>
                  <input type="number" step="0.01" value={form.maximo ?? ''} onChange={e => setForm(f => ({...f, maximo: e.target.value ? parseFloat(e.target.value) : null}))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Remuneração</label>
                <select value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value as 'percentual' | 'valor_fixo'}))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="percentual">Percentual da comissão (%)</option>
                  <option value="valor_fixo">Valor fixo (R$)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {form.tipo === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}
                </label>
                <input type="number" step="0.01" min="0" value={form.valor ?? ''} onChange={e => setForm(f => ({...f, valor: parseFloat(e.target.value)}))}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setEditIdx(null)} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={salvar} className="px-3 py-1.5 bg-blue-700 text-white rounded text-sm hover:bg-blue-800">Salvar</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDel !== null}
        title="Excluir faixa"
        message="Deseja excluir esta faixa de meta?"
        onConfirm={() => confirmDel !== null && excluir(confirmDel)}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

// ─── Config Assinaturas Eletrônicas ─────────────────────────────────────────

interface ConfigAssinaturasProps {
  config: ConfigClickSign;
  setConfig: (config: ConfigClickSign) => void;
  modelos: ModeloAssinatura[];
  setModelos: (items: ModeloAssinatura[]) => void;
}
function ConfigAssinaturas({ config, setConfig, modelos, setModelos }: ConfigAssinaturasProps) {

  const [tokenVisivel, setTokenVisivel]   = useState(false);
  const [secretVisivel, setSecretVisivel] = useState(false);
  const [formToken, setFormToken]         = useState(config.token);
  const [formEmail, setFormEmail]         = useState(config.emailPadrao ?? '');
  const [formNome, setFormNome]           = useState(config.nomePadrao ?? '');
  const [formSecret, setFormSecret]       = useState(config.webhookSecret ?? '');
  const [salvando, setSalvando]           = useState(false);
  const [testeStatus, setTesteStatus]     = useState<'idle' | 'ok' | 'erro'>('idle');
  const [testeErro, setTesteErro]         = useState<string | null>(null);
  const [copiado, setCopiado]             = useState(false);

  // Sincroniza campos do form somente quando o config muda por fonte externa
  // (ex: outra aba). Usamos ref para evitar resetar o que o usuário está digitando.
  const prevConfig = useRef(config);
  useEffect(() => {
    const prev = prevConfig.current;
    prevConfig.current = config;
    if (config.token        !== prev.token)        setFormToken(config.token ?? '');
    if (config.emailPadrao  !== prev.emailPadrao)  setFormEmail(config.emailPadrao ?? '');
    if (config.nomePadrao   !== prev.nomePadrao)   setFormNome(config.nomePadrao ?? '');
    if (config.webhookSecret !== prev.webhookSecret) setFormSecret(config.webhookSecret ?? '');
  }, [config]);

  const webhookUrl = `${window.location.origin}/api/clicksign-webhook`;

  function copiarWebhook() {
    navigator.clipboard.writeText(webhookUrl);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  const [modalModelo, setModalModelo] = useState<ModeloAssinatura | 'novo' | null>(null);
  const [formModelo, setFormModelo] = useState({ nome: '', descricao: '', mensagem: '' });
  const [confirmDelModelo, setConfirmDelModelo] = useState<string | null>(null);

  async function salvarConfig() {
    // Captura todos os valores antes de qualquer operação async para evitar stale closure
    const token   = formToken.trim();
    const email   = formEmail.trim();
    const nome    = formNome.trim();
    const secret  = formSecret.trim();

    // Salva ANTES do teste para garantir que o dado nunca se perde
    setConfig({ ...config, token, emailPadrao: email, nomePadrao: nome, webhookSecret: secret });

    setSalvando(true);
    setTesteStatus('idle');
    setTesteErro(null);

    const resultado = await testarConexao(token);

    setSalvando(false);

    if (resultado.ok) {
      setTesteStatus('ok');
    } else {
      setTesteStatus('erro');
      setTesteErro(resultado.erro ?? 'Erro desconhecido.');
    }
  }

  function abrirNovoModelo() {
    setFormModelo({ nome: '', descricao: '', mensagem: '' });
    setModalModelo('novo');
  }

  function abrirEditModelo(m: ModeloAssinatura) {
    setFormModelo({ nome: m.nome, descricao: m.descricao, mensagem: m.mensagem });
    setModalModelo(m);
  }

  function salvarModelo() {
    if (!formModelo.nome.trim() || !formModelo.mensagem.trim()) return;
    const now = new Date().toISOString();
    if (modalModelo === 'novo') {
      setModelos([...modelos, { id: generateId(), ...formModelo, criadoEm: now }]);
    } else if (modalModelo && typeof modalModelo === 'object') {
      setModelos(modelos.map(m => m.id === modalModelo.id ? { ...m, ...formModelo } : m));
    }
    setModalModelo(null);
  }

  return (
    <div className="space-y-6">
      {/* Credenciais ClickSign */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl space-y-4">
        <div>
          <h2 className="font-semibold text-gray-800 mb-0.5">Integração ClickSign</h2>
          <p className="text-sm text-gray-500">Configure o Access Token e as informações do remetente padrão (usadas nos envios).</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
          <div className="relative">
            <input
              type={tokenVisivel ? 'text' : 'password'}
              value={formToken}
              onChange={e => setFormToken(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setTokenVisivel(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {tokenVisivel ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome padrão do remetente</label>
            <input
              value={formNome}
              onChange={e => setFormNome(e.target.value)}
              placeholder="Ex: Segura Mais Corretora"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-mail padrão do remetente</label>
            <input
              type="email"
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              placeholder="assinaturas@empresa.com.br"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">Integração ativa</span>
            <button
              onClick={() => setConfig({ ...config, token: formToken.trim(), emailPadrao: formEmail.trim(), nomePadrao: formNome.trim(), webhookSecret: formSecret.trim(), ativo: !config.ativo })}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.ativo ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${config.ativo ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
            <span className={`text-xs font-medium ${config.ativo ? 'text-green-600' : 'text-gray-400'}`}>
              {config.ativo ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          <button
            onClick={salvarConfig}
            disabled={salvando || !formToken.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {salvando ? (
              <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Verificando…</>
            ) : (
              <><Save size={14} /> Salvar configurações</>
            )}
          </button>
        </div>

        {testeStatus === 'ok' && (
          <p className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <CheckCircle2 size={13} /> Conexão confirmada — token válido. Configurações salvas.
          </p>
        )}
        {testeStatus === 'erro' && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
            <XCircle size={13} className="shrink-0 mt-0.5" />
            <span><strong>Falha na verificação:</strong> {testeErro} As configurações foram salvas, mas verifique o token antes de usar.</span>
          </div>
        )}
      </div>

      {/* Webhook */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-xl space-y-4">
        <div className="flex items-start gap-3">
          <Webhook size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h2 className="font-semibold text-gray-800 mb-0.5">Webhook de Retorno</h2>
            <p className="text-sm text-gray-500">
              Configure esta URL no painel do ClickSign em <strong>Configurações → Integrações → Webhooks</strong>.
              O sistema receberá automaticamente os eventos de assinatura e atualizará os status.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL do Webhook</label>
          <div className="flex gap-2">
            <input
              readOnly
              value={webhookUrl}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono bg-gray-50 text-gray-700 select-all"
              onClick={e => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={copiarWebhook}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                copiado
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {copiado ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">HMAC SHA256 Secret</label>
          <div className="relative">
            <input
              type={secretVisivel ? 'text' : 'password'}
              value={formSecret}
              onChange={e => setFormSecret(e.target.value)}
              placeholder="Cole aqui o secret gerado pelo ClickSign"
              className="w-full px-3 py-2 pr-9 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setSecretVisivel(v => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {secretVisivel ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          <p className="text-xs text-amber-600 mt-1.5 flex items-start gap-1">
            <span className="shrink-0">⚠️</span>
            Após salvar aqui, adicione também este secret como variável de ambiente <strong>CLICKSIGN_WEBHOOK_SECRET</strong> no painel do Vercel para que a verificação de autenticidade funcione.
          </p>
        </div>

        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Mapeamento de status ClickSign → SmartCor</p>
          <div className="rounded-lg border border-gray-100 overflow-hidden text-xs">
            {[
              { cs: 'completed', label: 'Assinado',             cor: 'bg-green-100 text-green-700' },
              { cs: 'canceled',  label: 'Cancelado',            cor: 'bg-red-100 text-red-700'   },
              { cs: 'expired',   label: 'Expirado',             cor: 'bg-gray-100 text-gray-500' },
              { cs: 'running',   label: 'Aguardando Assinatura', cor: 'bg-yellow-100 text-yellow-700' },
            ].map(({ cs, label, cor }) => (
              <div key={cs} className="flex items-center justify-between px-3 py-2 border-b border-gray-50 last:border-0">
                <span className="font-mono text-gray-500">{cs}</span>
                <span className={`px-2 py-0.5 rounded-full font-medium ${cor}`}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vinculação de modelos por ação */}
      {modelos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-xl">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Modelo por Ação</h2>
            <p className="text-xs text-gray-400 mt-0.5">Escolha qual modelo de mensagem é usado automaticamente ao disparar a assinatura.</p>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ao fechar uma Renovação</label>
              <select
                value={config.modeloIdRenovacoes ?? ''}
                onChange={e => setConfig({ ...config, modeloIdRenovacoes: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Nenhum (mensagem genérica) —</option>
                {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ao fechar um Seguro Novo</label>
              <select
                value={config.modeloIdSegurosNovos ?? ''}
                onChange={e => setConfig({ ...config, modeloIdSegurosNovos: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Nenhum (mensagem genérica) —</option>
                {modelos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Modelos de mensagem */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-w-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">Modelos de Mensagem</h2>
            <p className="text-xs text-gray-400 mt-0.5">Mensagens enviadas aos signatários. Use {`{{nome}}`} e {`{{email}}`} como variáveis.</p>
          </div>
          <button
            onClick={abrirNovoModelo}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800"
          >
            <Plus size={14} /> Novo Modelo
          </button>
        </div>

        {modelos.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-400">Nenhum modelo cadastrado.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {modelos.map(m => (
              <div key={m.id} className="px-5 py-3 flex items-start justify-between gap-3 hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800">{m.nome}</div>
                  {m.descricao && <div className="text-xs text-gray-400 mt-0.5">{m.descricao}</div>}
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{m.mensagem}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => abrirEditModelo(m)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <Edit2 size={13} />
                  </button>
                  <button onClick={() => setConfirmDelModelo(m.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal modelo */}
      {modalModelo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold">{modalModelo === 'novo' ? 'Novo Modelo' : 'Editar Modelo'}</h3>
              <button onClick={() => setModalModelo(null)}><X size={16} className="text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do modelo</label>
                <input
                  value={formModelo.nome}
                  onChange={e => setFormModelo(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex: Renovação de Seguro"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
                <input
                  value={formModelo.descricao}
                  onChange={e => setFormModelo(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Utilizado para renovações de apólice"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem</label>
                <textarea
                  value={formModelo.mensagem}
                  onChange={e => setFormModelo(f => ({ ...f, mensagem: e.target.value }))}
                  rows={4}
                  placeholder={'Olá {{nome}}, por favor assine o documento de renovação do seu seguro.'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-gray-400 mt-1">Variáveis: {`{{nome}}`}, {`{{email}}`}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setModalModelo(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm">Cancelar</button>
              <button
                onClick={salvarModelo}
                disabled={!formModelo.nome.trim() || !formModelo.mensagem.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-50"
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelModelo}
        title="Excluir modelo"
        message="Deseja excluir este modelo de mensagem?"
        onConfirm={() => { setModelos(modelos.filter(m => m.id !== confirmDelModelo)); setConfirmDelModelo(null); }}
        onCancel={() => setConfirmDelModelo(null)}
      />
    </div>
  );
}

// ─── Configuracoes principal ─────────────────────────────────────────────────

export function Configuracoes({ seguradoras, setSeguradoras, ramos, setRamos, formasPagamento, setFormasPagamento, metas, setMetas, motivos, setMotivos, campos, setCampos, empresa, setEmpresa, tiposUsuario, setTiposUsuario, origensProspeccao, setOrigensProspeccao, importacoes, setImportacoes, renovacoes, setRenovacoes, segurosNovos, setSegurosNovos, prospeccoes, setProspeccoes, clientes, setClientes, usuarios, regrasParcelas, setRegrasParcelas, importacoesParcelas, setImportacoesParcelas, automacoesParcelas, setAutomacoesParcelas, parcelas, setParcelas, clicksignConfig, setClicksignConfig, clicksignModelos, setClicksignModelos, parcelasApiTokens, setParcelasApiTokens }: Props) {
  const [tab, setTab] = useState<Tab>('empresa');

  // Seguradoras state
  const [editSeg, setEditSeg] = useState<Seguradora | null>(null);
  const [criandoSeg, setCriandoSeg] = useState(false);
  const [formSegNome, setFormSegNome] = useState('');
  const [confirmDelSeg, setConfirmDelSeg] = useState<string | null>(null);

  // Ramos state
  const [editRamo, setEditRamo] = useState<Ramo | null>(null);
  const [criandoRamo, setCriandoRamo] = useState(false);
  const [formRamo, setFormRamo] = useState<Omit<Ramo, 'id'>>({ nome: '', ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 0, valorFixo: 0, considerarParaTaxaSegurosNovos: true, considerarParaTaxaConversao: true, remuneracaoIndividual: false, participaMetaProducao: false, apenasControleRemuneracao: false });
  const [confirmDelRamo, setConfirmDelRamo] = useState<string | null>(null);

  // Metas state
  const [subTabMetas, setSubTabMetas] = useState<'renovacao' | 'seguro_novo'>('renovacao');
  const [planoRenSel, setPlanoRenSel] = useState<PlanoMetaRenovacao | null>(null);
  const [planoSnSel, setPlanoSnSel] = useState<PlanoMetaSeguroNovo | null>(null);
  const [nomePlanoRen, setNomePlanoRen] = useState('');
  const [nomePlanoSn, setNomePlanoSn] = useState('');
  const [modalNovoPlanoRen, setModalNovoPlanoRen] = useState(false);
  const [modalNovoPlanoSn, setModalNovoPlanoSn] = useState(false);
  const [confirmDelPlanoRen, setConfirmDelPlanoRen] = useState<string | null>(null);
  const [confirmDelPlanoSn, setConfirmDelPlanoSn] = useState<string | null>(null);

  // Motivos state
  const [subTabMotivos, setSubTabMotivos] = useState<'negocio' | 'prospeccao'>('negocio');
  const [editMotivo, setEditMotivo] = useState<MotivoPerda | null>(null);
  const [criandoMotivo, setCriandoMotivo] = useState(false);
  const [formMotivo, setFormMotivo] = useState<Omit<MotivoPerda, 'id'>>({ nome: '', tipo: 'negocio', aplicaRenovacoes: true, aplicaSegurosNovos: true, ativo: true, ordem: 1, considerarTaxaConversaoRenovacoes: true, considerarTaxaConversaoSegurosNovos: true, considerarCalculoMetas: true, geraProspeccao: true });
  const [confirmDelMotivo, setConfirmDelMotivo] = useState<string | null>(null);

  // Campos state
  const [editCampo, setEditCampo] = useState<CampoCustomizavel | null>(null);
  const [criandoCampo, setCriandoCampo] = useState(false);
  const [formCampo, setFormCampo] = useState<Omit<CampoCustomizavel, 'id'>>({ nome: '', tipo: 'texto', obrigatorio: false, ativo: true, aplicavelA: 'todos', opcoes: [], ramosAplicaveis: [] });
  const [confirmDelCampo, setConfirmDelCampo] = useState<string | null>(null);
  const [opcoesInput, setOpcoesInput] = useState('');

  // Tipos de Usuário state
  const tipoVazio: Omit<TipoUsuario, 'id'> = {
    nome: '', descricao: '', role: 'usuario', ativo: true,
    acessoRenovacoes: true, acessoSegurosNovos: true, acessoProspeccao: true, podeDescartarProspeccao: false, acessoConsultaRenovacoes: false,
    visualizarDashboard: true, visualizarProducao: false, visualizarMetas: true, visualizarComissoes: false, visualizarLookalike: false,
    camposRestritos: { renovacoes: [], segurosNovos: [], prospeccoes: [] },
  };
  const [editTipo, setEditTipo] = useState<TipoUsuario | null>(null);

  // Origens state
  const [editOrigem, setEditOrigem] = useState<OrigemProspeccao | null>(null);
  const [criandoOrigem, setCriandoOrigem] = useState(false);
  const [formOrigemNome, setFormOrigemNome] = useState('');
  const [formOrigemAplicavel, setFormOrigemAplicavel] = useState<'prospeccoes' | 'seguros_novos' | 'ambos'>('ambos');
  const [confirmDelOrigem, setConfirmDelOrigem] = useState<string | null>(null);

  // Empresa local form state
  const [formEmpresa, setFormEmpresa] = useState<ConfiguracaoEmpresa>(empresa);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [empresaSalva, setEmpresaSalva] = useState(false);

  // ── API Tokens ──────────────────────────────────────────────────────────────
  const [showTokenNovo, setShowTokenNovo] = useState(false);
  const [formTokenApi, setFormTokenApi] = useState({ nome: '', seguradora: '', webhookSecret: '' });
  const [tokenVisivel, setTokenVisivel] = useState<string | null>(null);
  const [copiadoApi, setCopiadoApi] = useState(false);
  /** Id do token cujos detalhes completos estão sendo exibidos (modal de detalhes) */
  const [tokenDetalhesId, setTokenDetalhesId] = useState<string | null>(null);

  function gerarTokenApi(): string {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function salvarTokenApi() {
    if (!formTokenApi.nome.trim()) { alert('Nome obrigatório.'); return; }
    if (!formTokenApi.seguradora.trim()) { alert('Seguradora obrigatória.'); return; }
    const now = new Date().toISOString();
    const novoToken: ParcelasApiToken = {
      id: generateId(),
      nome: formTokenApi.nome.trim(),
      seguradora: formTokenApi.seguradora.trim(),
      token: gerarTokenApi(),
      webhookSecret: formTokenApi.webhookSecret.trim() || undefined,
      ativo: true,
      criadoEm: now,
      atualizadoEm: now,
    };
    setParcelasApiTokens([...parcelasApiTokens, novoToken]);
    setTokenVisivel(novoToken.token);
    setFormTokenApi({ nome: '', seguradora: '', webhookSecret: '' });
    setShowTokenNovo(false);
  }

  function copiarApi(text: string) {
    navigator.clipboard.writeText(text).then(() => { setCopiadoApi(true); setTimeout(() => setCopiadoApi(false), 2000); });
  }

  async function salvarEmpresa() {
    setSalvandoEmpresa(true);
    setEmpresaSalva(false);
    try {
      await setEmpresa(formEmpresa);
      setEmpresaSalva(true);
      setTimeout(() => setEmpresaSalva(false), 3000);
    } catch (err: unknown) {
      alert('Erro ao salvar: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSalvandoEmpresa(false);
    }
  }
  const [criandoTipo, setCriandoTipo] = useState(false);
  const [formTipo, setFormTipo] = useState<Omit<TipoUsuario, 'id'>>(tipoVazio);
  const [confirmDelTipo, setConfirmDelTipo] = useState<string | null>(null);

  const segsOrd    = useMemo(() => [...seguradoras].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [seguradoras]);
  const ramosOrd   = useMemo(() => [...ramos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [ramos]);

  // ── Nomes órfãos (existem em registros mas não no cadastro) ─────────────
  const [mapeamentoSegOrfas, setMapeamentoSegOrfas] = useState<Record<string, string>>({});
  const [mapeamentoRamoOrfas, setMapeamentoRamoOrfas] = useState<Record<string, string>>({});

  const segNomesAtuais = useMemo(() => new Set(seguradoras.map(s => s.nome)), [seguradoras]);
  const segOrfas = useMemo(() => {
    const all = new Set<string>();
    parcelas.forEach(p => p.seguradora && all.add(p.seguradora));
    renovacoes.forEach(r => {
      r.seguradoraAnterior && all.add(r.seguradoraAnterior);
      r.seguradoraNova && all.add(r.seguradoraNova);
    });
    segurosNovos.forEach(s => s.seguradora && all.add(s.seguradora));
    prospeccoes.forEach(p => p.seguradora && all.add(p.seguradora));
    return [...all].filter(n => !segNomesAtuais.has(n)).sort();
  }, [parcelas, renovacoes, segurosNovos, prospeccoes, segNomesAtuais]);

  const ramoNomesAtuais = useMemo(() => new Set(ramos.map(r => r.nome)), [ramos]);
  const ramoOrfas = useMemo(() => {
    const all = new Set<string>();
    parcelas.forEach(p => p.ramo && all.add(p.ramo));
    renovacoes.forEach(r => r.ramo && all.add(r.ramo));
    segurosNovos.forEach(s => s.ramo && all.add(s.ramo));
    prospeccoes.forEach(p => p.ramo && all.add(p.ramo));
    return [...all].filter(n => !ramoNomesAtuais.has(n)).sort();
  }, [parcelas, renovacoes, segurosNovos, prospeccoes, ramoNomesAtuais]);
  const camposOrd  = useMemo(() => [...campos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [campos]);
  const origensOrd = useMemo(() => {
    const sistema = origensProspeccao.filter(o => o.isSystem).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const custom  = origensProspeccao.filter(o => !o.isSystem).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return [...sistema, ...custom];
  }, [origensProspeccao]);

  const [confirmUndo, setConfirmUndo] = useState<ImportacaoLote | null>(null);
  const [auditoriaLote, setAuditoriaLote] = useState<ImportacaoLote | null>(null);
  const [confirmDelP, setConfirmDelP] = useState<ImportacaoParcelas | null>(null);
  const [auditoriaP, setAuditoriaP] = useState<ImportacaoParcelas | null>(null);

  // Regras de Parcelas state
  const regraVazia: Omit<RegraParcelaNegocio, 'id' | 'criadoEm' | 'atualizadoEm'> = {
    nome: '', isDefault: false, seguradora: '', ramo: '', formaPagamento: '', apolicePrefix: '', ativo: true,
  };
  const [modalRegra, setModalRegra] = useState<RegraParcelaNegocio | 'nova' | null>(null);
  const [formRegra, setFormRegra] = useState<Omit<RegraParcelaNegocio, 'id' | 'criadoEm' | 'atualizadoEm'>>(regraVazia);
  const [confirmDelRegra, setConfirmDelRegra] = useState<string | null>(null);

  function salvarRegra() {
    if (!formRegra.apolicePrefix?.trim()) { alert('O prefixo da apólice é obrigatório.'); return; }
    if (!formRegra.ramo.trim()) { alert('O ramo a identificar é obrigatório.'); return; }
    const prefixo = formRegra.apolicePrefix.trim().toUpperCase();
    const nome = `${prefixo} → ${formRegra.ramo}`;
    const now = new Date().toISOString();
    if (typeof modalRegra === 'string') {
      setRegrasParcelas([...regrasParcelas, { id: generateId(), ...formRegra, nome, apolicePrefix: prefixo, criadoEm: now, atualizadoEm: now }]);
    } else if (modalRegra) {
      setRegrasParcelas(regrasParcelas.map(r => r.id === modalRegra.id
        ? { ...r, ...formRegra, nome, apolicePrefix: prefixo, atualizadoEm: now }
        : r
      ));
    }
    setModalRegra(null);
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'empresa', label: 'Empresa' },
    { key: 'tipos_usuario', label: 'Tipos de Usuário' },
    { key: 'seguradoras', label: 'Seguradoras' },
    { key: 'ramos', label: 'Ramos' },
    { key: 'formas_pagamento', label: 'Formas de Pagamento' },
    { key: 'metas', label: 'Metas' },
    { key: 'motivos', label: 'Motivos de Perda' },
    { key: 'campos', label: 'Campos Customizáveis' },
    { key: 'origens_prospeccao', label: 'Origem do Negócio' },
    { key: 'regras_parcelas', label: 'Regras de Parcelas' },
    { key: 'importacoes', label: 'Importações' },
    { key: 'assinaturas', label: 'Assinaturas Eletrônicas' },
  ];

  function desfazerImportacao(lote: ImportacaoLote) {
    const ids = new Set(lote.idsSalvos);
    const idsClientes = new Set(lote.idsClientesCriados);

    if (lote.tipo === 'renovacoes') setRenovacoes(renovacoes.filter(r => !ids.has(r.id)));
    else if (lote.tipo === 'seguros_novos') setSegurosNovos(segurosNovos.filter(s => !ids.has(s.id)));
    else if (lote.tipo === 'prospeccoes') setProspeccoes(prospeccoes.filter(p => !ids.has(p.id)));
    else if (lote.tipo === 'clientes') setClientes(clientes.filter(c => !ids.has(c.id)));

    if (idsClientes.size > 0) setClientes(clientes.filter(c => !idsClientes.has(c.id)));

    setImportacoes(importacoes.filter(i => i.id !== lote.id));
    setConfirmUndo(null);
  }

  // ── Cascade rename helpers ────────────────────────────────────────────────
  function aplicarMigracoesSeg(migrations: { nomeAntigo: string; nomeNovo: string }[]) {
    if (!migrations.length) return;
    const agora = new Date().toISOString();
    setParcelas(parcelas.map(p => {
      const m = migrations.find(x => x.nomeAntigo === p.seguradora);
      return m ? { ...p, seguradora: m.nomeNovo, atualizadoEm: agora } : p;
    }));
    setRenovacoes(renovacoes.map(r => {
      const mAnt = migrations.find(x => x.nomeAntigo === r.seguradoraAnterior);
      const mNov = migrations.find(x => x.nomeAntigo === r.seguradoraNova);
      if (!mAnt && !mNov) return r;
      return {
        ...r,
        seguradoraAnterior: mAnt ? mAnt.nomeNovo : r.seguradoraAnterior,
        seguradoraNova: mNov ? mNov.nomeNovo : r.seguradoraNova,
        atualizadoEm: agora,
      };
    }));
    setSegurosNovos(segurosNovos.map(s => {
      const m = migrations.find(x => x.nomeAntigo === s.seguradora);
      return m ? { ...s, seguradora: m.nomeNovo, atualizadoEm: agora } : s;
    }));
    setProspeccoes(prospeccoes.map(p => {
      const m = migrations.find(x => x.nomeAntigo === p.seguradora);
      return m ? { ...p, seguradora: m.nomeNovo, atualizadoEm: agora } : p;
    }));
    setRegrasParcelas(regrasParcelas.map(r => {
      const m = migrations.find(x => x.nomeAntigo === r.seguradora);
      return m ? { ...r, seguradora: m.nomeNovo, atualizadoEm: agora } : r;
    }));
    setAutomacoesParcelas(automacoesParcelas.map(a => {
      const m = migrations.find(x => x.nomeAntigo === a.filtroSeguradora);
      return m ? { ...a, filtroSeguradora: m.nomeNovo, atualizadoEm: agora } : a;
    }));
  }

  function aplicarMigracoesRamo(migrations: { nomeAntigo: string; nomeNovo: string }[]) {
    if (!migrations.length) return;
    const agora = new Date().toISOString();
    setParcelas(parcelas.map(p => {
      const m = migrations.find(x => x.nomeAntigo === p.ramo);
      return m ? { ...p, ramo: m.nomeNovo, atualizadoEm: agora } : p;
    }));
    setRenovacoes(renovacoes.map(r => {
      const m = migrations.find(x => x.nomeAntigo === r.ramo);
      return m ? { ...r, ramo: m.nomeNovo, atualizadoEm: agora } : r;
    }));
    setSegurosNovos(segurosNovos.map(s => {
      const m = migrations.find(x => x.nomeAntigo === s.ramo);
      return m ? { ...s, ramo: m.nomeNovo, atualizadoEm: agora } : s;
    }));
    setProspeccoes(prospeccoes.map(p => {
      const m = migrations.find(x => x.nomeAntigo === p.ramo);
      return m ? { ...p, ramo: m.nomeNovo, atualizadoEm: agora } : p;
    }));
    setRegrasParcelas(regrasParcelas.map(r => {
      const m = migrations.find(x => x.nomeAntigo === r.ramo);
      return m ? { ...r, ramo: m.nomeNovo, atualizadoEm: agora } : r;
    }));
    setAutomacoesParcelas(automacoesParcelas.map(a => {
      const m = migrations.find(x => x.nomeAntigo === a.filtroRamo);
      return m ? { ...a, filtroRamo: m.nomeNovo, atualizadoEm: agora } : a;
    }));
  }

  // --- Seguradoras ---
  function salvarSeg() {
    if (!formSegNome.trim()) return;
    const nomeNovo = formSegNome.trim().toUpperCase();
    if (criandoSeg) {
      setSeguradoras([...seguradoras, { id: generateId(), nome: nomeNovo, ativo: true }]);
    } else if (editSeg) {
      const nomeAntigo = editSeg.nome;
      setSeguradoras(seguradoras.map(s => s.id === editSeg.id ? { ...s, nome: nomeNovo } : s));
      if (nomeNovo !== nomeAntigo) {
        aplicarMigracoesSeg([{ nomeAntigo, nomeNovo }]);
      }
    }
    setEditSeg(null); setCriandoSeg(false);
  }

  // --- Ramos ---
  function salvarRamo() {
    if (!formRamo.nome.trim()) return;
    const ramoComNome = { ...formRamo, nome: formRamo.nome.trim().toUpperCase() };
    if (criandoRamo) {
      setRamos([...ramos, { id: generateId(), ...ramoComNome }]);
    } else if (editRamo) {
      const nomeNovo = ramoComNome.nome;
      const nomeAntigo = editRamo.nome;
      setRamos(ramos.map(r => r.id === editRamo.id ? { ...editRamo, ...ramoComNome } : r));
      if (nomeNovo !== nomeAntigo) {
        aplicarMigracoesRamo([{ nomeAntigo, nomeNovo }]);
      }
    }
    setEditRamo(null); setCriandoRamo(false);
  }

  // --- Motivos ---
  function abrirNovMotivo() {
    const isNegocio = subTabMotivos === 'negocio';
    setFormMotivo({
      nome: '', tipo: subTabMotivos,
      aplicaRenovacoes: isNegocio,
      aplicaSegurosNovos: isNegocio,
      ativo: true,
      ordem: motivos.filter(m => m.tipo === subTabMotivos).length + 1,
      considerarTaxaConversaoRenovacoes: isNegocio,
      considerarTaxaConversaoSegurosNovos: isNegocio,
      considerarCalculoMetas: isNegocio,
      geraProspeccao: isNegocio,
    });
    setCriandoMotivo(true); setEditMotivo(null);
  }
  function salvarMotivo() {
    if (!formMotivo.nome.trim()) return;
    if (criandoMotivo) {
      setMotivos([...motivos, { id: generateId(), ...formMotivo }]);
    } else if (editMotivo) {
      setMotivos(motivos.map(m => m.id === editMotivo.id ? { ...editMotivo, ...formMotivo } : m));
    }
    setEditMotivo(null); setCriandoMotivo(false);
  }

  // --- Campos ---
  function salvarCampo() {
    if (!formCampo.nome.trim()) return;
    const opcoes = formCampo.tipo === 'lista' ? opcoesInput.split('\n').map(o => o.trim()).filter(Boolean) : undefined;
    if (criandoCampo) {
      setCampos([...campos, { id: generateId(), ...formCampo, opcoes }]);
    } else if (editCampo) {
      setCampos(campos.map(c => c.id === editCampo.id ? { ...editCampo, ...formCampo, opcoes } : c));
    }
    setEditCampo(null); setCriandoCampo(false);
  }

  // --- Tipos de Usuário ---
  function abrirNovTipo() {
    setFormTipo(tipoVazio);
    setCriandoTipo(true); setEditTipo(null);
  }
  function abrirEdTipo(t: TipoUsuario) {
    setFormTipo({ nome: t.nome, descricao: t.descricao, role: t.role, ativo: t.ativo,
      acessoRenovacoes: t.acessoRenovacoes, acessoSegurosNovos: t.acessoSegurosNovos, acessoProspeccao: t.acessoProspeccao ?? true,
      acessoConsultaRenovacoes: t.acessoConsultaRenovacoes ?? false,
      podeDescartarProspeccao: t.podeDescartarProspeccao ?? false,
      visualizarDashboard: t.visualizarDashboard ?? true,
      visualizarProducao: t.visualizarProducao ?? false,
      visualizarMetas: t.visualizarMetas ?? true,
      visualizarComissoes: t.visualizarComissoes ?? false,
      visualizarLookalike: t.visualizarLookalike ?? false,
      camposRestritos: t.camposRestritos ?? { renovacoes: [], segurosNovos: [], prospeccoes: [] },
    });
    setEditTipo(t); setCriandoTipo(false);
  }
  function salvarTipo() {
    if (!formTipo.nome.trim()) return;
    if (criandoTipo) {
      setTiposUsuario([...tiposUsuario, { id: generateId(), ...formTipo }]);
    } else if (editTipo) {
      setTiposUsuario(tiposUsuario.map(t => t.id === editTipo.id ? { ...editTipo, ...formTipo } : t));
    }
    setEditTipo(null); setCriandoTipo(false);
  }
  function excluirTipo(id: string) {
    setTiposUsuario(tiposUsuario.filter(t => t.id !== id));
    setConfirmDelTipo(null);
  }

  // --- Origens de Prospecção ---
  function salvarOrigem() {
    if (!formOrigemNome.trim()) return;
    if (criandoOrigem) {
      setOrigensProspeccao([...origensProspeccao, {
        id: generateId(),
        nome: formOrigemNome.trim(),
        isSystem: false,
        ativo: true,
        aplicavelA: formOrigemAplicavel,
      }]);
    } else if (editOrigem) {
      setOrigensProspeccao(origensProspeccao.map(o =>
        o.id === editOrigem.id ? { ...o, nome: formOrigemNome.trim(), aplicavelA: formOrigemAplicavel } : o
      ));
    }
    setEditOrigem(null);
    setCriandoOrigem(false);
    setFormOrigemNome('');
    setFormOrigemAplicavel('ambos');
  }

  const ROLE_LABELS_CFG: Record<Role, string> = { admin: 'Administrador', gestor: 'Gestor', usuario: 'Usuário' };
  const ROLE_COLORS_CFG: Record<Role, string> = {
    admin: 'bg-red-100 text-red-700',
    gestor: 'bg-blue-100 text-blue-700',
    usuario: 'bg-gray-100 text-gray-700',
  };

  const motivosTab = motivos.filter(m => m.tipo === subTabMotivos).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));


  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Configurações</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Empresa */}
      {tab === 'empresa' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md space-y-4">
          <h2 className="font-semibold text-gray-800">Dados da Empresa</h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Empresa</label>
            <input value={formEmpresa.nome} onChange={e => setFormEmpresa({ ...formEmpresa, nome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor Primária</label>
            <div className="flex items-center gap-3">
              <input type="color" value={formEmpresa.corPrimaria} onChange={e => setFormEmpresa({ ...formEmpresa, corPrimaria: e.target.value })}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={formEmpresa.corPrimaria} onChange={e => setFormEmpresa({ ...formEmpresa, corPrimaria: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cor Secundária</label>
            <div className="flex items-center gap-3">
              <input type="color" value={formEmpresa.corSecundaria} onChange={e => setFormEmpresa({ ...formEmpresa, corSecundaria: e.target.value })}
                className="w-10 h-10 rounded border border-gray-300 cursor-pointer" />
              <input value={formEmpresa.corSecundaria} onChange={e => setFormEmpresa({ ...formEmpresa, corSecundaria: e.target.value })}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button onClick={salvarEmpresa} disabled={salvandoEmpresa}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60">
              {salvandoEmpresa ? 'Salvando…' : 'Salvar'}
            </button>
            {empresaSalva && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check size={14} /> Salvo com sucesso
              </span>
            )}
          </div>
        </div>
      )}

      {/* Seguradoras */}
      {tab === 'seguradoras' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { setFormSegNome(''); setCriandoSeg(true); setEditSeg(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              <Plus size={14} /> Nova Seguradora
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {segsOrd.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">{s.nome}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => setSeguradoras(seguradoras.map(x => x.id === s.id ? {...x, ativo: !x.ativo} : x))}
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s.ativo ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button onClick={() => { setFormSegNome(s.nome); setEditSeg(s); setCriandoSeg(false); }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={13} /></button>
                        <button onClick={() => setConfirmDelSeg(s.id)}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(criandoSeg || editSeg) && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{criandoSeg ? 'Nova Seguradora' : 'Editar Seguradora'}</h3>
                  <button onClick={() => { setEditSeg(null); setCriandoSeg(false); }}><X size={16} /></button>
                </div>
                <input value={formSegNome} onChange={e => setFormSegNome(e.target.value)} placeholder="Nome da seguradora"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setEditSeg(null); setCriandoSeg(false); }} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm">Cancelar</button>
                  <button onClick={salvarSeg} className="px-3 py-1.5 bg-blue-700 text-white rounded text-sm">Salvar</button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog open={!!confirmDelSeg} title="Excluir seguradora" message="Deseja excluir esta seguradora?"
            onConfirm={() => { setSeguradoras(seguradoras.filter(s => s.id !== confirmDelSeg)); setConfirmDelSeg(null); }}
            onCancel={() => setConfirmDelSeg(null)} />

          {/* Painel de nomes inconsistentes */}
          {segOrfas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-700 font-semibold text-sm">⚠️ Nomes inconsistentes em registros</span>
                <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">{segOrfas.length}</span>
              </div>
              <p className="text-xs text-amber-600">Os nomes abaixo existem em parcelas/renovações mas não correspondem a nenhuma seguradora cadastrada. Selecione para qual seguradora migrar e clique em Aplicar:</p>
              <div className="space-y-2">
                {segOrfas.map(nome => (
                  <div key={nome} className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 min-w-[160px] shrink-0">{nome}</span>
                    <span className="text-gray-400 text-sm">→</span>
                    <select
                      value={mapeamentoSegOrfas[nome] ?? ''}
                      onChange={e => setMapeamentoSegOrfas(prev => ({ ...prev, [nome]: e.target.value }))}
                      className="flex-1 px-2 py-1.5 border border-amber-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                      <option value="">— Selecionar destino —</option>
                      {segsOrd.map(s => <option key={s.id} value={s.nome}>{s.nome}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button
                disabled={segOrfas.every(n => !mapeamentoSegOrfas[n])}
                onClick={() => {
                  const migrations = segOrfas
                    .filter(n => mapeamentoSegOrfas[n])
                    .map(n => ({ nomeAntigo: n, nomeNovo: mapeamentoSegOrfas[n] }));
                  aplicarMigracoesSeg(migrations);
                  setMapeamentoSegOrfas({});
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed">
                Aplicar Migrações
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ramos */}
      {tab === 'ramos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { setFormRamo({ nome: '', ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 0, valorFixo: 0, considerarParaTaxaSegurosNovos: true, considerarParaTaxaConversao: true, remuneracaoIndividual: false, participaMetaProducao: false, apenasControleRemuneracao: false }); setCriandoRamo(true); setEditRamo(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              <Plus size={14} /> Novo Ramo
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Nome','Para Taxa SN','Novos p/ Taxa Ren.','Remuneração','Status','Ações'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ramosOrd.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{r.nome}</td>
                      <td className="px-3 py-2.5 text-center">{r.considerarParaTaxaSegurosNovos ? <Check size={14} className="text-green-600 mx-auto" /> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-center">{r.considerarParaTaxaConversao ? <Check size={14} className="text-green-600 mx-auto" /> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-center">
                        {r.remuneracaoIndividual
                          ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              Individual · {r.tipoComissaoSegurosNovos === 'percentual' ? `${r.percentualComissao}%` : formatCurrency(r.valorFixo)}
                            </span>
                          : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Via meta</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setRamos(ramos.map(x => x.id === r.id ? {...x, ativo: !x.ativo} : x))}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => { setFormRamo({nome: r.nome, ativo: r.ativo, tipoComissaoSegurosNovos: r.tipoComissaoSegurosNovos, percentualComissao: r.percentualComissao, valorFixo: r.valorFixo, considerarParaTaxaSegurosNovos: r.considerarParaTaxaSegurosNovos, considerarParaTaxaConversao: r.considerarParaTaxaConversao, remuneracaoIndividual: r.remuneracaoIndividual ?? false, participaMetaProducao: r.participaMetaProducao ?? false, apenasControleRemuneracao: r.apenasControleRemuneracao ?? false}); setEditRamo(r); setCriandoRamo(false); }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={13} /></button>
                          <button onClick={() => setConfirmDelRamo(r.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(criandoRamo || editRamo) && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{criandoRamo ? 'Novo Ramo' : 'Editar Ramo'}</h3>
                  <button onClick={() => { setEditRamo(null); setCriandoRamo(false); }}><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                    <input value={formRamo.nome} onChange={e => setFormRamo(f => ({...f, nome: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-2 pt-2">
                    {/* Opção especial: apenas controle de remuneração */}
                    <div className={`rounded-lg border px-3 py-2.5 ${formRamo.apenasControleRemuneracao ? 'bg-amber-50 border-amber-300' : 'border-gray-200'}`}>
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input type="checkbox" checked={!!formRamo.apenasControleRemuneracao}
                          onChange={e => {
                            const v = e.target.checked;
                            setFormRamo(f => ({
                              ...f,
                              apenasControleRemuneracao: v,
                              // Quando ativado: força remuneração individual e desativa taxas
                              ...(v ? { remuneracaoIndividual: true, considerarParaTaxaSegurosNovos: false, considerarParaTaxaConversao: false } : {}),
                            }));
                          }}
                          className="mt-0.5 w-4 h-4 text-amber-600 rounded border-gray-300 cursor-pointer" />
                        <div>
                          <p className="text-sm font-medium text-amber-800">Apenas controle de remuneração</p>
                          <p className="text-xs text-amber-600 mt-0.5">
                            Os valores de prêmio e comissão <strong>não entram</strong> nos totais, rankings,
                            médias nem contagem de negócios fechados do dashboard.
                            Use para produtos auxiliares (ex: cartão de crédito) que geram
                            remuneração individual mas não são seguros.
                          </p>
                        </div>
                      </label>
                    </div>

                    <Ck v={formRamo.considerarParaTaxaSegurosNovos} label="Considerar para taxa de seguros novos"
                      onChange={v => setFormRamo(f => ({...f, considerarParaTaxaSegurosNovos: v}))}  />
                    <Ck v={formRamo.considerarParaTaxaConversao} label="Considerar Novos para taxa de Renovações (metas)"
                      onChange={v => setFormRamo(f => ({...f, considerarParaTaxaConversao: v}))} />
                    <Ck v={formRamo.remuneracaoIndividual} label="Remuneração individual por venda (fora da meta de produção)"
                      onChange={v => setFormRamo(f => ({...f, remuneracaoIndividual: v}))} />
                    <Ck v={formRamo.ativo} label="Ramo ativo" onChange={v => setFormRamo(f => ({...f, ativo: v}))} />
                  </div>

                  {/* Campos de comissão — só visíveis quando remuneração individual ativada */}
                  {formRamo.remuneracaoIndividual && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 space-y-3">
                      <p className="text-xs font-medium text-purple-700">
                        Comissão paga <strong>por venda</strong> — não entra na meta de produção mensal.
                      </p>
                      <Ck v={!!formRamo.participaMetaProducao} label="Também contribui para a meta de produção mensal"
                        onChange={v => setFormRamo(f => ({...f, participaMetaProducao: v}))} />
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Comissão</label>
                        <select value={formRamo.tipoComissaoSegurosNovos} onChange={e => setFormRamo(f => ({...f, tipoComissaoSegurosNovos: e.target.value as 'percentual' | 'valor_fixo'}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                          <option value="percentual">Percentual sobre comissão (%)</option>
                          <option value="valor_fixo">Valor fixo por seguro (R$)</option>
                        </select>
                      </div>
                      {formRamo.tipoComissaoSegurosNovos === 'percentual' ? (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Percentual (%)</label>
                          <input type="number" step="0.01" min="0" max="100" value={formRamo.percentualComissao}
                            onChange={e => setFormRamo(f => ({...f, percentualComissao: parseFloat(e.target.value) || 0}))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Valor Fixo (R$)</label>
                          <input type="number" step="0.01" min="0" value={formRamo.valorFixo}
                            onChange={e => setFormRamo(f => ({...f, valorFixo: parseFloat(e.target.value) || 0}))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => { setEditRamo(null); setCriandoRamo(false); }} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm">Cancelar</button>
                  <button onClick={salvarRamo} className="px-3 py-1.5 bg-blue-700 text-white rounded text-sm">Salvar</button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog open={!!confirmDelRamo} title="Excluir ramo" message="Deseja excluir este ramo?"
            onConfirm={() => { setRamos(ramos.filter(r => r.id !== confirmDelRamo)); setConfirmDelRamo(null); }}
            onCancel={() => setConfirmDelRamo(null)} />

          {/* Painel de ramos inconsistentes */}
          {ramoOrfas.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-amber-700 font-semibold text-sm">⚠️ Ramos inconsistentes em registros</span>
                <span className="text-xs text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">{ramoOrfas.length}</span>
              </div>
              <p className="text-xs text-amber-600">Os ramos abaixo existem em parcelas/renovações mas não correspondem a nenhum ramo cadastrado. Selecione para qual ramo migrar e clique em Aplicar:</p>
              <div className="space-y-2">
                {ramoOrfas.map(nome => (
                  <div key={nome} className="flex items-center gap-3">
                    <span className="text-sm font-mono text-gray-700 bg-white px-2 py-1 rounded border border-gray-200 min-w-[160px] shrink-0">{nome}</span>
                    <span className="text-gray-400 text-sm">→</span>
                    <select
                      value={mapeamentoRamoOrfas[nome] ?? ''}
                      onChange={e => setMapeamentoRamoOrfas(prev => ({ ...prev, [nome]: e.target.value }))}
                      className="flex-1 px-2 py-1.5 border border-amber-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white">
                      <option value="">— Selecionar destino —</option>
                      {ramosOrd.map(r => <option key={r.id} value={r.nome}>{r.nome}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <button
                disabled={ramoOrfas.every(n => !mapeamentoRamoOrfas[n])}
                onClick={() => {
                  const migrations = ramoOrfas
                    .filter(n => mapeamentoRamoOrfas[n])
                    .map(n => ({ nomeAntigo: n, nomeNovo: mapeamentoRamoOrfas[n] }));
                  aplicarMigracoesRamo(migrations);
                  setMapeamentoRamoOrfas({});
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed">
                Aplicar Migrações
              </button>
            </div>
          )}
        </div>
      )}

      {/* Formas de Pagamento */}
      {tab === 'formas_pagamento' && (() => {
        const [formFp, setFormFp] = useState({ nome: '', ativo: true });
        const [editFp, setEditFp] = useState<FormaPagamento | null>(null);
        const [criandoFp, setCriandoFp] = useState(false);
        const [confirmDelFp, setConfirmDelFp] = useState<string | null>(null);
        function salvarFp() {
          if (!formFp.nome.trim()) return;
          if (editFp) {
            setFormasPagamento(formasPagamento.map(f => f.id === editFp.id ? { ...f, nome: formFp.nome.trim(), ativo: formFp.ativo } : f));
          } else {
            setFormasPagamento([...formasPagamento, { id: generateId(), nome: formFp.nome.trim(), ativo: formFp.ativo }]);
          }
          setEditFp(null); setCriandoFp(false);
        }
        return (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button onClick={() => { setFormFp({ nome: '', ativo: true }); setCriandoFp(true); setEditFp(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                <Plus size={14} /> Nova Forma de Pagamento
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Nome', 'Status', 'Ações'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {formasPagamento.length === 0 && (
                    <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">Nenhuma forma de pagamento cadastrada.</td></tr>
                  )}
                  {formasPagamento.map(f => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{f.nome}</td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => setFormasPagamento(formasPagamento.map(x => x.id === f.id ? {...x, ativo: !x.ativo} : x))}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {f.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => { setFormFp({ nome: f.nome, ativo: f.ativo }); setEditFp(f); setCriandoFp(false); }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar"><Edit2 size={14} /></button>
                          <button onClick={() => setConfirmDelFp(f.id)}
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(criandoFp || editFp) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                  <div className="flex items-center justify-between p-5 border-b border-gray-200">
                    <h2 className="font-bold text-gray-900">{editFp ? 'Editar Forma de Pagamento' : 'Nova Forma de Pagamento'}</h2>
                    <button onClick={() => { setEditFp(null); setCriandoFp(false); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                      <input value={formFp.nome} onChange={e => setFormFp(f => ({...f, nome: e.target.value}))}
                        placeholder="Ex.: Débito em Conta, Boleto, Cartão..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <Ck v={formFp.ativo} label="Ativa" onChange={v => setFormFp(f => ({...f, ativo: v}))} />
                  </div>
                  <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
                    <button onClick={() => { setEditFp(null); setCriandoFp(false); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                    <button onClick={salvarFp} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800"><Save size={14} /> Salvar</button>
                  </div>
                </div>
              </div>
            )}
            <ConfirmDialog open={!!confirmDelFp} title="Excluir forma de pagamento" message="Deseja excluir esta forma de pagamento?"
              onConfirm={() => { if (confirmDelFp) setFormasPagamento(formasPagamento.filter(f => f.id !== confirmDelFp)); setConfirmDelFp(null); }}
              onCancel={() => setConfirmDelFp(null)} />
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
              <strong>Pré-requisito Supabase:</strong> execute no SQL Editor:<br />
              <code className="bg-white px-2 py-0.5 rounded border border-amber-200 mt-1 inline-block">CREATE TABLE IF NOT EXISTS formas_pagamento (id text PRIMARY KEY, nome text NOT NULL, ativo boolean DEFAULT true); ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY; CREATE POLICY "allow_all" ON formas_pagamento FOR ALL USING (true) WITH CHECK (true);</code>
            </div>
          </div>
        );
      })()}

      {/* Metas */}
      {tab === 'metas' && (
        <div className="space-y-4">
          {/* Sub-tabs Renovação / Seguro Novo */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
            {([{ k: 'renovacao', l: 'Renovações' }, { k: 'seguro_novo', l: 'Seguros Novos' }] as const).map(t => (
              <button key={t.k} onClick={() => setSubTabMetas(t.k)}
                className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${subTabMetas === t.k ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}>
                {t.l}
              </button>
            ))}
          </div>

          {/* ── Planos de Renovação ── */}
          {subTabMetas === 'renovacao' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Cada plano define as faixas de bônus por taxa de conversão e aumento de comissão.</p>
                <button onClick={() => { setNomePlanoRen(''); setModalNovoPlanoRen(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                  <Plus size={14} /> Novo Plano
                </button>
              </div>

              {metas.planosRenovacao.length === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
                  Nenhum plano de renovação cadastrado.
                </div>
              )}

              {metas.planosRenovacao.map(plano => (
                <div key={plano.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                    {planoRenSel?.id === plano.id ? (
                      <input
                        autoFocus
                        value={planoRenSel.nome}
                        onChange={e => setPlanoRenSel({ ...planoRenSel, nome: e.target.value })}
                        onBlur={() => {
                          setMetas({ ...metas, planosRenovacao: metas.planosRenovacao.map(p => p.id === planoRenSel.id ? planoRenSel : p) });
                          setPlanoRenSel(null);
                        }}
                        className="font-semibold text-gray-800 bg-transparent border-b border-blue-400 focus:outline-none"
                      />
                    ) : (
                      <h3 className="font-semibold text-gray-800">{plano.nome}</h3>
                    )}
                    <div className="flex gap-1">
                      <button onClick={() => setPlanoRenSel(plano)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Renomear"><Edit2 size={13} /></button>
                      <button onClick={() => setConfirmDelPlanoRen(plano.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Taxa de Conversão de Renovações</h4>
                      </div>
                      {/* Toggle: considerar SN na taxa */}
                      <button
                        type="button"
                        onClick={() => setMetas({ ...metas, planosRenovacao: metas.planosRenovacao.map(p => p.id === plano.id ? { ...p, considerarSnNaTaxa: !plano.considerarSnNaTaxa } : p) })}
                        className="flex items-center gap-2 text-sm text-gray-700 mb-4"
                      >
                        {(plano.considerarSnNaTaxa ?? true)
                          ? <CheckSquare size={16} className="text-blue-600 shrink-0" />
                          : <Square size={16} className="text-gray-400 shrink-0" />}
                        <span>Incluir Seguros Novos fechados (ramos elegíveis) no cálculo</span>
                      </button>
                      <FaixasEditor
                        faixas={plano.taxaConversaoRenovacoes}
                        tipo="percent"
                        onChange={f => setMetas({ ...metas, planosRenovacao: metas.planosRenovacao.map(p => p.id === plano.id ? { ...p, taxaConversaoRenovacoes: f } : p) })}
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aumento de Comissão</h4>
                      <FaixasEditor
                        faixas={plano.aumentoComissao}
                        tipo="percent"
                        onChange={f => setMetas({ ...metas, planosRenovacao: metas.planosRenovacao.map(p => p.id === plano.id ? { ...p, aumentoComissao: f } : p) })}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Modal novo plano renovação */}
              {modalNovoPlanoRen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Novo Plano — Renovações</h3>
                      <button onClick={() => setModalNovoPlanoRen(false)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
                    </div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do plano</label>
                    <input autoFocus value={nomePlanoRen} onChange={e => setNomePlanoRen(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setModalNovoPlanoRen(false)} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm">Cancelar</button>
                      <button onClick={() => {
                        if (!nomePlanoRen.trim()) return;
                        const novo: PlanoMetaRenovacao = { id: generateId(), nome: nomePlanoRen.trim(), considerarSnNaTaxa: true, taxaConversaoRenovacoes: [], aumentoComissao: [] };
                        setMetas({ ...metas, planosRenovacao: [...metas.planosRenovacao, novo] });
                        setModalNovoPlanoRen(false);
                      }} className="px-3 py-1.5 bg-blue-700 text-white rounded text-sm hover:bg-blue-800">Criar</button>
                    </div>
                  </div>
                </div>
              )}

              <ConfirmDialog
                open={!!confirmDelPlanoRen}
                title="Excluir plano"
                message="Deseja excluir este plano de metas? Usuários vinculados a ele perderão a referência."
                onConfirm={() => { setMetas({ ...metas, planosRenovacao: metas.planosRenovacao.filter(p => p.id !== confirmDelPlanoRen) }); setConfirmDelPlanoRen(null); }}
                onCancel={() => setConfirmDelPlanoRen(null)}
              />
            </div>
          )}

          {/* ── Planos de Seguros Novos ── */}
          {subTabMetas === 'seguro_novo' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">Cada plano define as faixas de bônus por comissão gerada e taxa de conversão.</p>
                <button onClick={() => { setNomePlanoSn(''); setModalNovoPlanoSn(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                  <Plus size={14} /> Novo Plano
                </button>
              </div>

              {metas.planosSeguroNovo.length === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
                  Nenhum plano de seguros novos cadastrado.
                </div>
              )}

              {metas.planosSeguroNovo.map(plano => (
                <div key={plano.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                    {planoSnSel?.id === plano.id ? (
                      <input
                        autoFocus
                        value={planoSnSel.nome}
                        onChange={e => setPlanoSnSel({ ...planoSnSel, nome: e.target.value })}
                        onBlur={() => {
                          setMetas({ ...metas, planosSeguroNovo: metas.planosSeguroNovo.map(p => p.id === planoSnSel.id ? planoSnSel : p) });
                          setPlanoSnSel(null);
                        }}
                        className="font-semibold text-gray-800 bg-transparent border-b border-blue-400 focus:outline-none"
                      />
                    ) : (
                      <h3 className="font-semibold text-gray-800">{plano.nome}</h3>
                    )}
                    <div className="flex gap-1">
                      <button onClick={() => setPlanoSnSel(plano)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Renomear"><Edit2 size={13} /></button>
                      <button onClick={() => setConfirmDelPlanoSn(plano.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 p-5">
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Comissão Gerada</h4>
                      <FaixasEditor
                        faixas={plano.segurosNovosPorComissao}
                        tipo="currency"
                        onChange={f => setMetas({ ...metas, planosSeguroNovo: metas.planosSeguroNovo.map(p => p.id === plano.id ? { ...p, segurosNovosPorComissao: f } : p) })}
                      />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Taxa de Conversão</h4>
                      <FaixasEditor
                        faixas={plano.segurosNovosPorTaxa}
                        tipo="percent"
                        onChange={f => setMetas({ ...metas, planosSeguroNovo: metas.planosSeguroNovo.map(p => p.id === plano.id ? { ...p, segurosNovosPorTaxa: f } : p) })}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Modal novo plano seguros novos */}
              {modalNovoPlanoSn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                  <div className="bg-white rounded-xl shadow-2xl p-5 w-full max-w-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Novo Plano — Seguros Novos</h3>
                      <button onClick={() => setModalNovoPlanoSn(false)} className="p-1 hover:bg-gray-100 rounded"><X size={16} /></button>
                    </div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do plano</label>
                    <input autoFocus value={nomePlanoSn} onChange={e => setNomePlanoSn(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setModalNovoPlanoSn(false)} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm">Cancelar</button>
                      <button onClick={() => {
                        if (!nomePlanoSn.trim()) return;
                        const novo: PlanoMetaSeguroNovo = { id: generateId(), nome: nomePlanoSn.trim(), segurosNovosPorComissao: [], segurosNovosPorTaxa: [] };
                        setMetas({ ...metas, planosSeguroNovo: [...metas.planosSeguroNovo, novo] });
                        setModalNovoPlanoSn(false);
                      }} className="px-3 py-1.5 bg-blue-700 text-white rounded text-sm hover:bg-blue-800">Criar</button>
                    </div>
                  </div>
                </div>
              )}

              <ConfirmDialog
                open={!!confirmDelPlanoSn}
                title="Excluir plano"
                message="Deseja excluir este plano de metas? Usuários vinculados a ele perderão a referência."
                onConfirm={() => { setMetas({ ...metas, planosSeguroNovo: metas.planosSeguroNovo.filter(p => p.id !== confirmDelPlanoSn) }); setConfirmDelPlanoSn(null); }}
                onCancel={() => setConfirmDelPlanoSn(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* Motivos */}
      {tab === 'motivos' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {([{ k: 'negocio' as const, l: 'Negócios (Ren. / Seg. Novos)' }, { k: 'prospeccao' as const, l: 'Prospecção' }] as const).map(t => (
                <button key={t.k} onClick={() => setSubTabMotivos(t.k)}
                  className={`px-3 py-1 rounded text-sm font-medium ${subTabMotivos === t.k ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600'}`}>
                  {t.l}
                </button>
              ))}
            </div>
            <button onClick={abrirNovMotivo} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              <Plus size={14} /> Novo Motivo
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Ordem','Nome',
                      subTabMotivos === 'negocio' ? 'Aplicável a' : null,
                      subTabMotivos === 'negocio' ? 'Considerar Conv.' : null,
                      subTabMotivos === 'negocio' ? 'Considerar Metas' : null,
                      subTabMotivos === 'negocio' ? 'Gera Prospecção' : null,
                      'Status','Ações',
                    ].filter(Boolean).map(h => (
                      <th key={h as string} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {motivosTab.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 text-gray-500 text-center">{m.ordem}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{m.nome}</td>
                      {subTabMotivos === 'negocio' && (
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col gap-0.5 text-xs">
                            {m.aplicaRenovacoes   && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Renovação</span>}
                            {m.aplicaSegurosNovos && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-medium">Seg. Novo</span>}
                            {!m.aplicaRenovacoes && !m.aplicaSegurosNovos && <span className="text-gray-300">—</span>}
                          </div>
                        </td>
                      )}
                      {subTabMotivos === 'negocio' && (
                        <td className="px-3 py-2.5 text-center">
                          {(m.considerarTaxaConversaoRenovacoes || m.considerarTaxaConversaoSegurosNovos)
                            ? <Check size={14} className="text-green-600 mx-auto" />
                            : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      {subTabMotivos === 'negocio' && (
                        <td className="px-3 py-2.5 text-center">
                          {m.considerarCalculoMetas ? <Check size={14} className="text-green-600 mx-auto" /> : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      {subTabMotivos === 'negocio' && (
                        <td className="px-3 py-2.5 text-center">
                          {m.geraProspeccao ? <Check size={14} className="text-blue-600 mx-auto" /> : <span className="text-gray-300">—</span>}
                        </td>
                      )}
                      <td className="px-3 py-2.5">
                        <button onClick={() => setMotivos(motivos.map(x => x.id === m.id ? {...x, ativo: !x.ativo} : x))}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {m.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => { setFormMotivo({ nome: m.nome, tipo: m.tipo, aplicaRenovacoes: m.aplicaRenovacoes, aplicaSegurosNovos: m.aplicaSegurosNovos, ativo: m.ativo, ordem: m.ordem, considerarTaxaConversaoRenovacoes: m.considerarTaxaConversaoRenovacoes, considerarTaxaConversaoSegurosNovos: m.considerarTaxaConversaoSegurosNovos, considerarCalculoMetas: m.considerarCalculoMetas, geraProspeccao: m.geraProspeccao ?? false }); setEditMotivo(m); setCriandoMotivo(false); }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={13} /></button>
                          <button onClick={() => setConfirmDelMotivo(m.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(criandoMotivo || editMotivo) && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{criandoMotivo ? 'Novo Motivo' : 'Editar Motivo'}</h3>
                  <button onClick={() => { setEditMotivo(null); setCriandoMotivo(false); }}><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                    <input value={formMotivo.nome} onChange={e => setFormMotivo(f => ({...f, nome: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Ordem</label>
                    <input type="number" min="1" value={formMotivo.ordem} onChange={e => setFormMotivo(f => ({...f, ordem: parseInt(e.target.value) || 1}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="space-y-2 pt-1">
                    {formMotivo.tipo === 'negocio' && (
                      <>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Aplica a</p>
                        <Ck v={formMotivo.aplicaRenovacoes} label="Renovações"
                          onChange={v => setFormMotivo(f => ({...f, aplicaRenovacoes: v}))} />
                        <Ck v={formMotivo.aplicaSegurosNovos} label="Seguros Novos"
                          onChange={v => setFormMotivo(f => ({...f, aplicaSegurosNovos: v}))} />
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-1">Cálculos</p>
                        <Ck v={formMotivo.considerarTaxaConversaoRenovacoes} label="Considerar na taxa de conversão de renovações"
                          onChange={v => setFormMotivo(f => ({...f, considerarTaxaConversaoRenovacoes: v}))} />
                        <Ck v={formMotivo.considerarTaxaConversaoSegurosNovos} label="Considerar na taxa de conversão de seguros novos"
                          onChange={v => setFormMotivo(f => ({...f, considerarTaxaConversaoSegurosNovos: v}))} />
                        <Ck v={formMotivo.considerarCalculoMetas} label="Considerar no cálculo de metas"
                          onChange={v => setFormMotivo(f => ({...f, considerarCalculoMetas: v}))} />
                        <Ck v={formMotivo.geraProspeccao} label="Gerar prospecção ao marcar como perdido"
                          onChange={v => setFormMotivo(f => ({...f, geraProspeccao: v}))} />
                      </>
                    )}
                    <Ck v={formMotivo.ativo} label="Motivo ativo" onChange={v => setFormMotivo(f => ({...f, ativo: v}))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => { setEditMotivo(null); setCriandoMotivo(false); }} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm">Cancelar</button>
                  <button onClick={salvarMotivo} className="px-3 py-1.5 bg-blue-700 text-white rounded text-sm">Salvar</button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog open={!!confirmDelMotivo} title="Excluir motivo" message="Deseja excluir este motivo de perda?"
            onConfirm={() => { setMotivos(motivos.filter(m => m.id !== confirmDelMotivo)); setConfirmDelMotivo(null); }}
            onCancel={() => setConfirmDelMotivo(null)} />
        </div>
      )}

      {/* Campos Customizáveis */}
      {tab === 'campos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { setFormCampo({ nome: '', tipo: 'texto', obrigatorio: false, ativo: true, aplicavelA: 'todos', opcoes: [], ramosAplicaveis: [] }); setOpcoesInput(''); setCriandoCampo(true); setEditCampo(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              <Plus size={14} /> Novo Campo
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Nome','Tipo','Obrigatório','Aplicável a','Status','Ações'].map(h => (
                      <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {camposOrd.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 font-medium text-gray-800">{c.nome}</td>
                      <td className="px-3 py-2.5 text-gray-600 capitalize">{c.tipo}</td>
                      <td className="px-3 py-2.5 text-center">{c.obrigatorio ? <Check size={14} className="text-green-600 mx-auto" /> : <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-gray-600">
                        <div>{{ ambos: 'Ren. + Seg. Novos', renovacoes: 'Renovações', seguros_novos: 'Seguros Novos', prospeccoes: 'Prospecções', todos: 'Todos', seguros_novos_prospeccoes: 'SN + Prospecções', clientes: 'Clientes' }[c.aplicavelA]}</div>
                        {c.aplicavelA !== 'clientes' && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {(c.ramosAplicaveis ?? []).length === 0 ? 'Todos os ramos' : c.ramosAplicaveis!.join(', ')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setCampos(campos.map(x => x.id === c.id ? {...x, ativo: !x.ativo} : x))}
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {c.ativo ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1">
                          <button onClick={() => { setFormCampo({nome: c.nome, tipo: c.tipo, obrigatorio: c.obrigatorio, ativo: c.ativo, aplicavelA: c.aplicavelA, opcoes: c.opcoes, ramosAplicaveis: c.ramosAplicaveis ?? [], multiplosArquivos: c.multiplosArquivos, tiposPermitidos: c.tiposPermitidos, tamanhoMaximoMb: c.tamanhoMaximoMb}); setOpcoesInput((c.opcoes ?? []).join('\n')); setEditCampo(c); setCriandoCampo(false); }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={13} /></button>
                          <button onClick={() => setConfirmDelCampo(c.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(criandoCampo || editCampo) && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{criandoCampo ? 'Novo Campo' : 'Editar Campo'}</h3>
                  <button onClick={() => { setEditCampo(null); setCriandoCampo(false); }}><X size={16} /></button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                    <input value={formCampo.nome} onChange={e => setFormCampo(f => ({...f, nome: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                    <select value={formCampo.tipo} onChange={e => setFormCampo(f => ({...f, tipo: e.target.value as TipoCampoCustom}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="texto">Texto</option>
                      <option value="data">Data</option>
                      <option value="lista">Lista (seleção)</option>
                      <option value="arquivo">Arquivo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Aplicável a</label>
                    <select value={formCampo.aplicavelA} onChange={e => setFormCampo(f => ({...f, aplicavelA: e.target.value as CampoCustomizavel['aplicavelA']}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="todos">Todos (Ren. + Seg. Novos + Prospecções)</option>
                      <option value="ambos">Ren. + Seg. Novos</option>
                      <option value="seguros_novos_prospeccoes">Seg. Novos + Prospecções</option>
                      <option value="renovacoes">Renovações</option>
                      <option value="seguros_novos">Seguros Novos</option>
                      <option value="prospeccoes">Prospecções</option>
                      <option value="clientes">Clientes</option>
                    </select>
                  </div>
                  {formCampo.aplicavelA !== 'clientes' && ramosOrd.length > 0 && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Ramos aplicáveis
                        <span className="ml-1 text-gray-400 font-normal">(vazio = todos)</span>
                      </label>
                      <div className="border border-gray-200 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1">
                        {ramosOrd.filter(r => r.ativo).map(r => {
                          const checked = (formCampo.ramosAplicaveis ?? []).includes(r.nome);
                          return (
                            <button key={r.id} type="button"
                              onClick={() => setFormCampo(f => {
                                const lista = f.ramosAplicaveis ?? [];
                                return { ...f, ramosAplicaveis: checked ? lista.filter(x => x !== r.nome) : [...lista, r.nome] };
                              })}
                              className="flex items-center gap-1.5 text-sm text-gray-700 w-full text-left hover:text-blue-700">
                              {checked
                                ? <CheckSquare size={14} className="text-blue-600 shrink-0" />
                                : <Square size={14} className="text-gray-400 shrink-0" />}
                              {r.nome}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {formCampo.tipo === 'lista' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Opções (uma por linha)</label>
                      <textarea value={opcoesInput} onChange={e => setOpcoesInput(e.target.value)} rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                  )}
                  {formCampo.tipo === 'arquivo' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tipos permitidos (ex: .pdf .jpg .png)</label>
                        <input value={(formCampo.tiposPermitidos ?? []).join(' ')} onChange={e => setFormCampo(f => ({...f, tiposPermitidos: e.target.value.split(' ').filter(Boolean)}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Tamanho máximo (MB)</label>
                        <input type="number" min="1" value={formCampo.tamanhoMaximoMb ?? ''} onChange={e => setFormCampo(f => ({...f, tamanhoMaximoMb: parseFloat(e.target.value) || undefined}))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <Ck v={formCampo.multiplosArquivos ?? false} label="Permitir múltiplos arquivos"
                        onChange={v => setFormCampo(f => ({...f, multiplosArquivos: v}))} />
                    </div>
                  )}
                  <div className="space-y-2 pt-1">
                    <Ck v={formCampo.obrigatorio} label="Campo obrigatório" onChange={v => setFormCampo(f => ({...f, obrigatorio: v}))} />
                    <Ck v={formCampo.ativo} label="Campo ativo" onChange={v => setFormCampo(f => ({...f, ativo: v}))} />
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => { setEditCampo(null); setCriandoCampo(false); }} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded text-sm">Cancelar</button>
                  <button onClick={salvarCampo} className="px-3 py-1.5 bg-blue-700 text-white rounded text-sm">Salvar</button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog open={!!confirmDelCampo} title="Excluir campo" message="Deseja excluir este campo customizável?"
            onConfirm={() => { setCampos(campos.filter(c => c.id !== confirmDelCampo)); setConfirmDelCampo(null); }}
            onCancel={() => setConfirmDelCampo(null)} />
        </div>
      )}

      {/* ── Tipos de Usuário ── */}
      {tab === 'tipos_usuario' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-800">Tipos de Usuário</h2>
              <p className="text-sm text-gray-500 mt-0.5">Defina perfis com permissões padrão. Ao criar um usuário, selecione o tipo para pré-preencher as permissões automaticamente.</p>
            </div>
            <button onClick={abrirNovTipo}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              <Plus size={14} /> Novo Tipo
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {tiposUsuario.map(t => (
              <div key={t.id} className={`bg-white rounded-xl border p-5 space-y-3 ${t.ativo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                {/* Header do card */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{t.nome}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS_CFG[t.role]}`}>{ROLE_LABELS_CFG[t.role]}</span>
                      {!t.ativo && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-400">Inativo</span>}
                    </div>
                    {t.descricao && <p className="text-xs text-gray-500 mt-1">{t.descricao}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => abrirEdTipo(t)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                    <button onClick={() => setConfirmDelTipo(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                </div>

                {/* Grade de permissões */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide col-span-2 mb-1">Acesso</div>
                  {[
                    { label: 'Renovações', v: t.acessoRenovacoes },
                    { label: 'Consulta Ren.', v: t.acessoConsultaRenovacoes ?? false },
                    { label: 'Seguros Novos', v: t.acessoSegurosNovos },
                  ].map(({ label, v }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
                      {v
                        ? <Check size={12} className="text-green-500 shrink-0" />
                        : <span className="w-3 h-3 rounded-full border border-gray-200 inline-block shrink-0" />}
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Modal criar/editar tipo */}
          {(criandoTipo || editTipo) && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                  <h3 className="font-bold text-gray-900">{criandoTipo ? 'Novo Tipo de Usuário' : 'Editar Tipo de Usuário'}</h3>
                  <button onClick={() => { setEditTipo(null); setCriandoTipo(false); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                    <input value={formTipo.nome} onChange={e => setFormTipo(f => ({...f, nome: e.target.value}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                    <textarea value={formTipo.descricao} onChange={e => setFormTipo(f => ({...f, descricao: e.target.value}))} rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nível de acesso ao sistema</label>
                    <select value={formTipo.role} onChange={e => setFormTipo(f => ({...f, role: e.target.value as Role}))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="usuario">Usuário — acesso à própria produção</option>
                      <option value="gestor">Gestor — visualiza toda a equipe</option>
                      <option value="admin">Administrador — acesso total + configurações</option>
                    </select>
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissões de Acesso padrão</p>
                    <Ck v={formTipo.acessoRenovacoes} label="Acesso a Renovações" onChange={v => setFormTipo(f => ({...f, acessoRenovacoes: v}))} />
                    <Ck v={formTipo.acessoSegurosNovos} label="Acesso a Seguros Novos" onChange={v => setFormTipo(f => ({...f, acessoSegurosNovos: v}))} />
                    <Ck v={formTipo.acessoProspeccao ?? true} label="Acesso a Prospecção" onChange={v => setFormTipo(f => ({...f, acessoProspeccao: v}))} />
                    <Ck v={formTipo.acessoConsultaRenovacoes ?? false} label="Consulta de Renovações" onChange={v => setFormTipo(f => ({...f, acessoConsultaRenovacoes: v}))} />
                    <Ck v={formTipo.podeDescartarProspeccao ?? false} label="Pode descartar prospecções" onChange={v => setFormTipo(f => ({...f, podeDescartarProspeccao: v}))} />
                  </div>

                  <div className="border-t border-gray-100 pt-4 space-y-3">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Páginas do Dashboard</div>
                    <Ck v={formTipo.visualizarDashboard}  label="Dashboard Principal"    onChange={v => setFormTipo(f => ({...f, visualizarDashboard: v}))} />
                    <Ck v={formTipo.visualizarProducao}   label="Produção (Administrativo)" onChange={v => setFormTipo(f => ({...f, visualizarProducao: v}))} />
                    <Ck v={formTipo.visualizarMetas}      label="Metas"                  onChange={v => setFormTipo(f => ({...f, visualizarMetas: v}))} />
                    <Ck v={formTipo.visualizarComissoes}  label="Comissões a Pagar"      onChange={v => setFormTipo(f => ({...f, visualizarComissoes: v}))} />
                  </div>


                  <div className="border-t border-gray-100 pt-3">
                    <Ck v={formTipo.ativo} label="Tipo ativo" onChange={v => setFormTipo(f => ({...f, ativo: v}))} />
                  </div>
                </div>
                <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
                  <button onClick={() => { setEditTipo(null); setCriandoTipo(false); }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                  <button onClick={salvarTipo}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                    <Check size={14} /> {criandoTipo ? 'Criar' : 'Salvar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog open={!!confirmDelTipo} title="Excluir tipo de usuário"
            message="Deseja excluir este tipo? Os usuários vinculados não serão afetados."
            onConfirm={() => excluirTipo(confirmDelTipo!)}
            onCancel={() => setConfirmDelTipo(null)} danger />
        </div>
      )}

      {/* Origens de Prospecção */}
      {tab === 'origens_prospeccao' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { setFormOrigemNome(''); setFormOrigemAplicavel('ambos'); setCriandoOrigem(true); setEditOrigem(null); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              <Plus size={14} /> Nova Origem
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Aplicável a</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {origensProspeccao.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Nenhuma origem cadastrada</td></tr>
                ) : origensOrd.map(o => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        {o.isSystem && <span title="Origem do sistema — não pode ser excluída"><Lock size={13} className="text-gray-400 shrink-0" /></span>}
                        {o.nome}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {o.isSystem
                        ? <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">Sistema</span>
                        : <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Personalizada</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {o.isSystem
                        ? 'Prospecções'
                        : { prospeccoes: 'Prospecções', seguros_novos: 'Seguros Novos', ambos: 'Seg. Novos + Prosp.' }[o.aplicavelA ?? 'ambos']}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => setOrigensProspeccao(origensProspeccao.map(x => x.id === o.id ? { ...x, ativo: !x.ativo } : x))}
                        className={`px-2 py-0.5 rounded text-xs font-medium ${o.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {o.ativo ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {!o.isSystem && (
                          <button onClick={() => { setFormOrigemNome(o.nome); setFormOrigemAplicavel(o.aplicavelA ?? 'ambos'); setEditOrigem(o); setCriandoOrigem(false); }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 size={13} />
                          </button>
                        )}
                        {!o.isSystem && (
                          <button onClick={() => setConfirmDelOrigem(o.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 size={13} />
                          </button>
                        )}
                        {o.isSystem && <span className="px-2 py-1.5 text-xs text-gray-300">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Modal criar/editar */}
          {(criandoOrigem || editOrigem) && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-800">{criandoOrigem ? 'Nova Origem' : 'Editar Origem'}</h2>
                  <button onClick={() => { setEditOrigem(null); setCriandoOrigem(false); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                  <input value={formOrigemNome} onChange={e => setFormOrigemNome(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && salvarOrigem()}
                    autoFocus
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aplicável a</label>
                  <select value={formOrigemAplicavel} onChange={e => setFormOrigemAplicavel(e.target.value as 'prospeccoes' | 'seguros_novos' | 'ambos')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="ambos">Seg. Novos + Prospecções</option>
                    <option value="seguros_novos">Apenas Seguros Novos</option>
                    <option value="prospeccoes">Apenas Prospecções</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setEditOrigem(null); setCriandoOrigem(false); }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                  <button onClick={salvarOrigem}
                    className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">Salvar</button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={confirmDelOrigem !== null}
            title="Excluir origem"
            message="Deseja excluir esta origem do negócio? Esta ação não pode ser desfeita."
            onConfirm={() => {
              if (confirmDelOrigem) setOrigensProspeccao(origensProspeccao.filter(o => o.id !== confirmDelOrigem));
              setConfirmDelOrigem(null);
            }}
            onCancel={() => setConfirmDelOrigem(null)}
          />
        </div>
      )}

      {/* Regras de Parcelas */}
      {tab === 'regras_parcelas' && (
        <div className="space-y-6">

          {/* Configuração de Importação */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="font-semibold text-gray-900 mb-1">Regras de Baixada no Import</h2>
            <p className="text-sm text-gray-500 mb-4">
              Define como o sistema trata parcelas que não aparecem em um novo import de planilha.
            </p>
            <div className="flex flex-col gap-3">

              {/* 1. Proteção de seguradora ausente */}
              <div className="flex items-start justify-between gap-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    Proteger parcelas de seguradora não importada?
                  </p>
                  <p className="text-xs text-gray-500">
                    <strong>Sim (recomendado):</strong> Se nenhuma parcela de uma seguradora aparecer no import, o sistema trata como
                    erro de importação e não altera essas parcelas.<br />
                    <strong>Não:</strong> Aplica a regra de baixada mesmo que a seguradora inteira tenha desaparecido do import.
                  </p>
                </div>
                <div className="flex rounded border border-gray-300 overflow-hidden text-sm shrink-0">
                  <button
                    onClick={() => setEmpresa({ ...empresa, protegerSeguradoraSemImport: true })}
                    className={`px-4 py-2 transition-colors font-medium ${empresa.protegerSeguradoraSemImport !== false ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Sim
                  </button>
                  <button
                    onClick={() => setEmpresa({ ...empresa, protegerSeguradoraSemImport: false })}
                    className={`px-4 py-2 border-l border-gray-300 transition-colors font-medium ${empresa.protegerSeguradoraSemImport === false ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Não
                  </button>
                </div>
              </div>

              {/* 2. Status a aplicar nas parcelas ausentes */}
              <div className="flex items-start justify-between gap-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    O que fazer com parcelas ausentes do import?
                  </p>
                  <p className="text-xs text-gray-500 mb-3">
                    Quando a seguradora aparece na planilha mas uma parcela específica não é encontrada no arquivo importado.
                  </p>
                  <div className="flex flex-col gap-2">
                    {([
                      {
                        value: 'baixada_sistema',
                        label: 'Baixa Automática (padrão)',
                        desc: (
                          <div className="space-y-2">
                            <p>A cada import, o sistema identifica quais seguradoras vieram na planilha e verifica cada parcela:</p>
                            <p>• Parcela <strong>apareceu</strong> no arquivo → dados atualizados, status permanece inalterado (ainda em aberto na carteira de cobrança).</p>
                            <p>• Parcela <strong>não apareceu</strong> no arquivo → o sistema avalia a Data Limite de pagamento cadastrada:</p>
                            <div className="mt-1 ml-3 space-y-1 border-l-2 border-gray-200 pl-3">
                              <p>• <strong>Sem Data Limite cadastrada</strong> → não altera (não é possível confirmar se a baixa é válida).</p>
                              <p>• <strong>Data do import anterior à Data Limite</strong> → <span className="font-medium text-purple-700">Baixa Automática</span> (seguradora confirmou o recebimento dentro do prazo).</p>
                              <p>• <strong>Data do import igual ou posterior à Data Limite</strong> → <span className="font-medium text-orange-700">Análise Crítica</span> (prazo ultrapassado sem confirmação de pagamento).</p>
                            </div>
                            <p className="text-gray-400">Parcelas já pagas, canceladas, em análise crítica ou com baixa automática nunca são sobrescritas.</p>
                          </div>
                        ),
                      },
                      {
                        value: 'nao_alterar',
                        label: 'Não alterar',
                        desc: (
                          <>
                            Nenhum status é modificado — o import apenas atualiza os dados das parcelas que apareceram na planilha, sem tocar no status das que não vieram.
                          </>
                        ),
                      },
                    ] as const).map(opt => {
                      const sel = (empresa.statusAusenteImport ?? 'baixada_sistema') === opt.value;
                      return (
                        <label key={opt.value} className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${sel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                          <input
                            type="radio"
                            name="statusAusenteImport"
                            value={opt.value}
                            checked={sel}
                            onChange={() => setEmpresa({ ...empresa, statusAusenteImport: opt.value })}
                            className="mt-0.5 accent-blue-700"
                          />
                          <div>
                            <span className={`text-sm font-medium ${sel ? 'text-blue-800' : 'text-gray-800'}`}>{opt.label}</span>
                            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{opt.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 3. Proteger desconsideradas */}
              <div className="flex items-start justify-between gap-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    Proteger parcelas com status "Desconsiderada"?
                  </p>
                  <p className="text-xs text-gray-500">
                    <strong>Sim:</strong> Parcelas desconsideradas manualmente não são sobrescritas pela regra de baixada no import.<br />
                    <strong>Não (padrão):</strong> A regra de baixada pode alterar parcelas desconsideradas normalmente.
                  </p>
                </div>
                <div className="flex rounded border border-gray-300 overflow-hidden text-sm shrink-0">
                  <button
                    onClick={() => setEmpresa({ ...empresa, protegerDesconsideradaImport: true })}
                    className={`px-4 py-2 transition-colors font-medium ${empresa.protegerDesconsideradaImport === true ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Sim
                  </button>
                  <button
                    onClick={() => setEmpresa({ ...empresa, protegerDesconsideradaImport: false })}
                    className={`px-4 py-2 border-l border-gray-300 transition-colors font-medium ${empresa.protegerDesconsideradaImport !== true ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Não
                  </button>
                </div>
              </div>

              {/* 4. Proteger primeira parcela */}
              <div className="flex items-start justify-between gap-6 bg-gray-50 rounded-lg p-4 border border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800 mb-1">
                    Desconsiderar a regra de baixada para a 1ª parcela?
                  </p>
                  <p className="text-xs text-gray-500">
                    <strong>Sim:</strong> A primeira parcela de cada apólice não recebe baixa automática — ela permanece com o status atual mesmo que não apareça no import. Útil quando a 1ª parcela costuma ser paga diretamente e não aparece na carteira de cobrança da seguradora.<br />
                    <strong>Não (padrão):</strong> A regra de baixada se aplica normalmente à primeira parcela também.
                  </p>
                </div>
                <div className="flex rounded border border-gray-300 overflow-hidden text-sm shrink-0">
                  <button
                    onClick={() => setEmpresa({ ...empresa, protegerPrimeiraParcelaImport: true })}
                    className={`px-4 py-2 transition-colors font-medium ${empresa.protegerPrimeiraParcelaImport === true ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Sim
                  </button>
                  <button
                    onClick={() => setEmpresa({ ...empresa, protegerPrimeiraParcelaImport: false })}
                    className={`px-4 py-2 border-l border-gray-300 transition-colors font-medium ${empresa.protegerPrimeiraParcelaImport !== true ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                    Não
                  </button>
                </div>
              </div>


            </div>
          </div>

          {/* Regras de Identificação de Ramo */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="font-semibold text-gray-900">Regras de Identificação de Ramo</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Identifica automaticamente o ramo de uma parcela pelo prefixo do número da apólice ao importar planilhas ou receber dados via API.
                </p>
              </div>
              <button
                onClick={() => { setFormRegra({ ...regraVazia, isDefault: false }); setModalRegra('nova'); }}
                className="flex items-center gap-2 px-3 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 shrink-0"
              >
                <Plus size={14} /> Nova Regra
              </button>
            </div>

            {regrasParcelas.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                Nenhuma regra de ramo cadastrada.<br />
                <span className="text-xs">Clique em "Nova Regra" e informe o prefixo de apólice e o ramo correspondente.</span>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Apólice começa com</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Ramo atribuído</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Seguradora</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {regrasParcelas.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onDoubleClick={() => { setFormRegra({ nome: r.nome, isDefault: false, seguradora: r.seguradora, ramo: r.ramo, formaPagamento: '', apolicePrefix: r.apolicePrefix ?? '', ativo: r.ativo }); setModalRegra(r); }}>
                        <td className="px-4 py-2.5">
                          <span className="font-mono bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-xs font-semibold">
                            {r.apolicePrefix || '—'}…
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-medium text-blue-700">{r.ramo || <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-2.5 text-gray-500 text-xs">{r.seguradora || <span className="text-gray-300">Qualquer</span>}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {r.ativo ? 'Ativa' : 'Inativa'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { setFormRegra({ nome: r.nome, isDefault: false, seguradora: r.seguradora, ramo: r.ramo, formaPagamento: '', apolicePrefix: r.apolicePrefix ?? '', ativo: r.ativo }); setModalRegra(r); }}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmDelRegra(r.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modal criar/editar regra de ramo */}
          {modalRegra !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="flex items-center justify-between p-5 border-b border-gray-200">
                  <h2 className="font-bold text-gray-900">
                    {modalRegra === 'nova' ? 'Nova Regra de Ramo' : 'Editar Regra de Ramo'}
                  </h2>
                  <button onClick={() => setModalRegra(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                </div>
                <div className="p-5 space-y-4">

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Apólice começa com <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={formRegra.apolicePrefix ?? ''}
                      onChange={e => setFormRegra(f => ({ ...f, apolicePrefix: e.target.value }))}
                      placeholder="Ex.: AUTO, VID-, 72, P-..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                      Prefixo do número da apólice (não diferencia maiúsculas/minúsculas). Ex.: apólices "AUTO-123" e "auto-456" batem com prefixo "AUTO".
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Ramo a atribuir <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formRegra.ramo}
                      onChange={e => setFormRegra(f => ({ ...f, ramo: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Selecione o ramo —</option>
                      {[...ramos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(r => (
                        <option key={r.id} value={r.nome}>{r.nome}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Ramo que será atribuído à parcela ao identificar o prefixo acima.</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Seguradora <span className="text-gray-400 font-normal">(opcional)</span></label>
                    <select
                      value={formRegra.seguradora}
                      onChange={e => setFormRegra(f => ({ ...f, seguradora: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Qualquer seguradora —</option>
                      {[...seguradoras].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(s => (
                        <option key={s.id} value={s.nome}>{s.nome}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Restrinja a regra a uma seguradora específica se o mesmo prefixo existir em seguradoras diferentes.</p>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Ck v={formRegra.ativo} label="Regra ativa" onChange={v => setFormRegra(f => ({ ...f, ativo: v }))} />
                  </div>

                  {(formRegra.apolicePrefix || formRegra.ramo) && (
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                      Apólices que começam com{' '}
                      <span className="font-mono font-semibold">"{(formRegra.apolicePrefix ?? '').toUpperCase()}"</span>
                      {formRegra.seguradora && <> da seguradora <span className="font-semibold">"{formRegra.seguradora}"</span></>}
                      {' '}→ Ramo: <span className="font-semibold">"{formRegra.ramo || '?'}"</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
                  <button onClick={() => setModalRegra(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                  <button onClick={salvarRegra} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                    <Save size={14} /> Salvar
                  </button>
                </div>
              </div>
            </div>
          )}

          <ConfirmDialog
            open={!!confirmDelRegra}
            title="Excluir regra"
            message="Tem certeza que deseja excluir esta regra de parcelas?"
            danger
            onConfirm={() => { if (confirmDelRegra) setRegrasParcelas(regrasParcelas.filter(r => r.id !== confirmDelRegra)); setConfirmDelRegra(null); }}
            onCancel={() => setConfirmDelRegra(null)}
          />

          {/* Integração via API (tokens por seguradora) */}
          {(() => {
            const API_URL = 'https://jacy-crm.vercel.app/api/parcelas-import';
            return (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <Webhook size={16} className="text-blue-600" />
                      <h2 className="font-semibold text-gray-900">Integração via API</h2>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Seguradoras que enviam parcelas por endpoint (ao invés de planilha). Cada uma recebe um token secreto único.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTokenNovo(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 shrink-0"
                  >
                    <Plus size={14} /> Novo Token
                  </button>
                </div>

                {/* Endpoint URL */}
                <div className="mt-4 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                  <span className="text-xs text-gray-400 shrink-0">URL do endpoint:</span>
                  <code className="flex-1 text-xs text-gray-700 font-mono truncate">{API_URL}</code>
                  <button onClick={() => copiarApi(API_URL)} className="p-1 text-gray-400 hover:text-blue-600 shrink-0" title="Copiar URL">
                    <Copy size={13} />
                  </button>
                </div>

                {/* Aviso token recém-criado */}
                {tokenVisivel && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-800 mb-1">⚠ Copie o token agora — ele não será exibido novamente.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono text-amber-900 break-all">{tokenVisivel}</code>
                      <button onClick={() => copiarApi(tokenVisivel)} className="p-1.5 text-amber-600 hover:bg-amber-100 rounded shrink-0" title="Copiar token">
                        {copiadoApi ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                    <button onClick={() => setTokenVisivel(null)} className="mt-2 text-xs text-amber-600 hover:underline">Fechar aviso</button>
                  </div>
                )}

                {/* Lista de tokens */}
                {parcelasApiTokens.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Nome', 'Seguradora', 'Token', 'Chave Webhook', 'Último uso', 'Status', ''].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {parcelasApiTokens.map(t => (
                          <tr key={t.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-medium text-gray-800">{t.nome}</td>
                            <td className="px-4 py-2.5 text-gray-600">{t.seguradora}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs text-gray-400">{t.token.slice(0, 8)}••••••••</span>
                                <button
                                  onClick={() => { setFormTokenApi(f => ({ ...f, webhookSecret: '' })); setTokenDetalhesId(t.id); }}
                                  className="p-1 text-gray-300 hover:text-blue-500 rounded"
                                  title="Ver / editar credenciais (admin)"
                                >
                                  <Eye size={12} />
                                </button>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {t.webhookSecret
                                ? <span className="font-mono text-xs text-gray-400">••••••••</span>
                                : <span className="text-gray-300 text-xs">—</span>
                              }
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-400">
                              {t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleDateString('pt-BR') : '—'}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${t.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {t.ativo ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setParcelasApiTokens(parcelasApiTokens.map(x => x.id === t.id ? { ...x, ativo: !x.ativo, atualizadoEm: new Date().toISOString() } : x))}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs"
                                  title={t.ativo ? 'Desativar' : 'Ativar'}
                                >
                                  {t.ativo ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                                <button
                                  onClick={() => setParcelasApiTokens(parcelasApiTokens.filter(x => x.id !== t.id))}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                  title="Excluir token"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {parcelasApiTokens.length === 0 && !showTokenNovo && (
                  <div className="mt-4 rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                    Nenhuma seguradora integrada via API ainda.<br />
                    <span className="text-xs">Clique em "Novo Token" para gerar as credenciais de acesso.</span>
                  </div>
                )}

                {/* Modal novo token */}
                {showTokenNovo && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
                      <div className="flex items-center justify-between p-5 border-b border-gray-200">
                        <h2 className="font-bold text-gray-900">Novo Token de API</h2>
                        <button onClick={() => setShowTokenNovo(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                      </div>
                      <div className="p-5 space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Nome descritivo <span className="text-red-500">*</span></label>
                          <input
                            value={formTokenApi.nome}
                            onChange={e => setFormTokenApi(f => ({ ...f, nome: e.target.value }))}
                            placeholder="Ex.: Porto Seguro — Produção"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Seguradora <span className="text-red-500">*</span></label>
                          <select
                            value={formTokenApi.seguradora}
                            onChange={e => setFormTokenApi(f => ({ ...f, seguradora: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— Selecione —</option>
                            {[...seguradoras].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(s => (
                              <option key={s.id} value={s.nome}>{s.nome}</option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-400 mt-1">As parcelas recebidas por este token serão cadastradas com esta seguradora.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Chave Secreta do Webhook <span className="text-gray-400 font-normal">(opcional)</span>
                          </label>
                          <input
                            value={formTokenApi.webhookSecret}
                            onChange={e => setFormTokenApi(f => ({ ...f, webhookSecret: e.target.value }))}
                            placeholder="Chave gerada pela seguradora no webhook dela"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                          />
                          <p className="text-xs text-gray-400 mt-1">
                            Chave fornecida pela seguradora para verificar a autenticidade das requisições recebidas (assinatura HMAC).
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
                        <button onClick={() => setShowTokenNovo(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
                        <button onClick={salvarTokenApi} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                          <Save size={14} /> Gerar Token
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Modal de detalhes completos (admin) */}
                {tokenDetalhesId && (() => {
                  const tk = parcelasApiTokens.find(x => x.id === tokenDetalhesId);
                  if (!tk) return null;
                  // Estado local para edição da chave (sem hook — variável reatribuível via IIFE não funciona,
                  // então usamos o formTokenApi.webhookSecret como buffer de edição inicializado ao abrir)
                  const editandoChave = formTokenApi.webhookSecret;
                  function salvarChave() {
                    setParcelasApiTokens(parcelasApiTokens.map(x =>
                      x.id === tk!.id
                        ? { ...x, webhookSecret: editandoChave.trim() || undefined, atualizadoEm: new Date().toISOString() }
                        : x
                    ));
                    setTokenDetalhesId(null);
                    setFormTokenApi(f => ({ ...f, webhookSecret: '' }));
                  }
                  return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b border-gray-200">
                          <div>
                            <h2 className="font-bold text-gray-900">Credenciais — {tk.nome}</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{tk.seguradora}</p>
                          </div>
                          <button onClick={() => { setTokenDetalhesId(null); setFormTokenApi(f => ({ ...f, webhookSecret: '' })); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                        </div>
                        <div className="p-5 space-y-4">
                          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                            ⚠ Informações sigilosas — visíveis apenas para administradores. Não compartilhe.
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Bearer Token</label>
                            <p className="text-xs text-gray-400 mb-1">Enviado pela seguradora no header <code className="bg-gray-100 px-1 rounded">Authorization: Bearer …</code></p>
                            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                              <code className="flex-1 text-xs font-mono text-gray-800 break-all">{tk.token}</code>
                              <button
                                onClick={() => copiarApi(tk.token)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded shrink-0"
                                title="Copiar token"
                              >
                                {copiadoApi ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Chave Secreta do Webhook</label>
                            <p className="text-xs text-gray-400 mb-1">Gerada pela seguradora — cole aqui quando ela fornecer.</p>
                            <div className="flex items-center gap-2">
                              <input
                                value={editandoChave}
                                onChange={e => setFormTokenApi(f => ({ ...f, webhookSecret: e.target.value }))}
                                placeholder={tk.webhookSecret ? tk.webhookSecret : 'Cole a chave fornecida pela seguradora…'}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              {tk.webhookSecret && !editandoChave && (
                                <button
                                  onClick={() => copiarApi(tk.webhookSecret!)}
                                  className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg shrink-0"
                                  title="Copiar chave atual"
                                >
                                  {copiadoApi ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                              )}
                            </div>
                            {tk.webhookSecret && !editandoChave && (
                              <p className="text-xs text-gray-400 mt-1">Chave já cadastrada. Digite uma nova para substituir.</p>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
                          <button
                            onClick={() => { setTokenDetalhesId(null); setFormTokenApi(f => ({ ...f, webhookSecret: '' })); }}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={salvarChave}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800"
                          >
                            <Save size={14} /> Salvar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })()}

          {/* Automações de Parcelas — dentro de Regras de Parcelas */}
          <AutomacoesParcelasConfig
            automacoes={automacoesParcelas}
            setAutomacoes={setAutomacoesParcelas}
            seguradoras={seguradoras.filter(s => s.ativo).map(s => s.nome).sort()}
            ramos={ramos.filter(r => r.ativo).map(r => r.nome).sort()}
            formasPagamento={[...new Set([...FORMAS_PAGAMENTO_PADRAO, ...formasPagamento.filter(f => f.ativo).map(f => f.nome)])].sort()}
          />
        </div>
      )}

      {/* Importações */}
      {tab === 'importacoes' && (() => {
        const TIPO_LABELS: Record<string, string> = {
          renovacoes: 'Renovações',
          seguros_novos: 'Seguros Novos',
          prospeccoes: 'Prospecções',
          clientes: 'Clientes',
        };
        const TIPO_COLORS: Record<string, string> = {
          renovacoes: 'bg-blue-100 text-blue-700',
          seguros_novos: 'bg-indigo-100 text-indigo-700',
          prospeccoes: 'bg-amber-100 text-amber-700',
          clientes: 'bg-green-100 text-green-700',
        };
        const sorted = [...importacoes].sort(
          (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
        );

        return (
          <div className="space-y-3">
            {sorted.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-gray-400 text-sm">
                Nenhuma importação registrada.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <p className="text-xs text-gray-400 mt-2 px-4 pb-1">Clique duas vezes em uma importação para ver o relatório detalhado.</p>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Data/Hora</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Arquivo</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Importados</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Rejeitados</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Importado por</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {sorted.map(lote => {
                      const autor = usuarios.find(u => u.id === lote.criadoPor);
                      const dataHora = new Date(lote.criadoEm).toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      });
                      return (
                        <tr key={lote.id} className="hover:bg-gray-50 cursor-pointer select-none" onDoubleClick={() => setAuditoriaLote(lote)}>
                          <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dataHora}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORS[lote.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                              {TIPO_LABELS[lote.tipo] ?? lote.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate" title={lote.nomeArquivo}>{lote.nomeArquivo}</td>
                          <td className="px-4 py-3 text-right font-medium text-green-700">{lote.totalImportados}</td>
                          <td className="px-4 py-3 text-right font-medium text-red-600">{lote.totalRejeitados}</td>
                          <td className="px-4 py-3 text-gray-600">{autor?.nome ?? lote.criadoPor}</td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => setConfirmUndo(lote)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                              title="Desfazer importação"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {auditoriaLote && (() => {
              const audAutor = usuarios.find(u => u.id === auditoriaLote.criadoPor);
              const audDataHora = new Date(auditoriaLote.criadoEm).toLocaleString('pt-BR', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              });
              const validas: LinhaImportValida[] = auditoriaLote.linhasValidas ?? [];
              const invalidas: LinhaImportInvalida[] = auditoriaLote.linhasInvalidas ?? [];
              return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAuditoriaLote(null)}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
                      <div className="flex-1 min-w-0">
                        <h2 className="text-base font-semibold text-gray-900 truncate">{auditoriaLote.nomeArquivo}</h2>
                        <div className="flex flex-wrap items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">{audDataHora}</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${TIPO_COLORS[auditoriaLote.tipo] ?? 'bg-gray-100 text-gray-600'}`}>
                            {TIPO_LABELS[auditoriaLote.tipo] ?? auditoriaLote.tipo}
                          </span>
                          <span className="text-xs text-gray-500">por {audAutor?.nome ?? auditoriaLote.criadoPor}</span>
                        </div>
                      </div>
                      <button onClick={() => setAuditoriaLote(null)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg shrink-0">
                        <X size={18} />
                      </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {/* Válidas */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 size={16} className="text-green-600" />
                          <h3 className="text-sm font-semibold text-green-700">Importados com sucesso ({validas.length})</h3>
                        </div>
                        {validas.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Sem dados de auditoria</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-green-100">
                            <table className="w-full text-xs">
                              <thead className="bg-green-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold text-green-800">Linha</th>
                                  <th className="px-3 py-2 text-left font-semibold text-green-800">Nome</th>
                                  <th className="px-3 py-2 text-left font-semibold text-green-800">Detalhes</th>
                                  <th className="px-3 py-2 text-left font-semibold text-green-800">Cliente Novo?</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-green-50">
                                {validas.map((v, i) => (
                                  <tr key={i} className="hover:bg-green-50/50">
                                    <td className="px-3 py-2 text-gray-500">{v.linha}</td>
                                    <td className="px-3 py-2 text-gray-800">{v.nome}</td>
                                    <td className="px-3 py-2 text-gray-600">{v.detalhe ?? '—'}</td>
                                    <td className="px-3 py-2 text-gray-600">{v.clienteNovo ? 'Sim' : 'Não'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Inválidas */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <XCircle size={16} className="text-red-500" />
                          <h3 className="text-sm font-semibold text-red-700">Rejeitados / Erros ({invalidas.length})</h3>
                        </div>
                        {invalidas.length === 0 ? (
                          <p className="text-xs text-gray-400 italic">Nenhum erro</p>
                        ) : (
                          <div className="overflow-x-auto rounded-lg border border-red-100">
                            <table className="w-full text-xs">
                              <thead className="bg-red-50">
                                <tr>
                                  <th className="px-3 py-2 text-left font-semibold text-red-800">Linha</th>
                                  <th className="px-3 py-2 text-left font-semibold text-red-800">Nome</th>
                                  <th className="px-3 py-2 text-left font-semibold text-red-800">Motivo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-red-50">
                                {invalidas.map((inv, i) => (
                                  <tr key={i} className="hover:bg-red-50/50">
                                    <td className="px-3 py-2 text-gray-500">{inv.linha}</td>
                                    <td className="px-3 py-2 text-gray-800">{inv.nome}</td>
                                    <td className="px-3 py-2 text-red-700">{inv.motivo}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Importações de Parcelas */}
            {(() => {
              const sortedP = [...importacoesParcelas].sort(
                (a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()
              );
              return (
                <>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="flex items-center justify-between px-4 pt-4 pb-2">
                      <h2 className="font-semibold text-gray-800 text-sm">Importações de Parcelas</h2>
                      <span className="text-xs text-gray-400">{sortedP.length} importação(ões)</span>
                    </div>
                    {sortedP.length === 0 ? (
                      <div className="px-4 pb-6 text-center text-gray-400 text-sm">Nenhuma importação de parcelas registrada.</div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-400 px-4 pb-1">Duplo clique para ver detalhes da importação.</p>
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              {['Data/Hora', 'Arquivo', 'Novas', 'Atualizadas', 'Baixadas Sistema', 'Ignoradas', 'Ações'].map(h => (
                                <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-600 whitespace-nowrap ${['Novas','Atualizadas','Baixadas Sistema','Ignoradas','Ações'].includes(h) ? 'text-center' : 'text-left'}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {sortedP.map(lote => {
                              const dataHora = new Date(lote.criadoEm).toLocaleString('pt-BR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              });
                              return (
                                <tr key={lote.id} className="hover:bg-gray-50 cursor-pointer select-none" onDoubleClick={() => setAuditoriaP(lote)}>
                                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{dataHora}</td>
                                  <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate" title={lote.nomeArquivo}>{lote.nomeArquivo}</td>
                                  <td className="px-4 py-3 text-center font-medium text-blue-700">{lote.totalNovas}</td>
                                  <td className="px-4 py-3 text-center font-medium text-gray-700">{lote.totalAtualizadas}</td>
                                  <td className="px-4 py-3 text-center font-medium text-green-700">{lote.totalBaixadas}</td>
                                  <td className="px-4 py-3 text-center font-medium text-red-600">{lote.totalIgnoradas}</td>
                                  <td className="px-4 py-3 text-center">
                                    <button onClick={() => setConfirmDelP(lote)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Excluir registro">
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>

                  {/* Auditoria de import de parcelas — modal */}
                  {auditoriaP && (() => {
                    const audDataHora = new Date(auditoriaP.criadoEm).toLocaleString('pt-BR', {
                      day: '2-digit', month: '2-digit', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    });
                    return (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAuditoriaP(null)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                          {/* Header */}
                          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-200">
                            <div className="flex-1 min-w-0">
                              <h2 className="text-base font-semibold text-gray-900 truncate">{auditoriaP.nomeArquivo}</h2>
                              <div className="flex flex-wrap items-center gap-3 mt-1">
                                <span className="text-xs text-gray-500">{audDataHora}</span>
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">Parcelas</span>
                                {auditoriaP.seguradorasConsideradas.length > 0 && (
                                  <span className="text-xs text-gray-500">Seguradoras: {auditoriaP.seguradorasConsideradas.join(', ')}</span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => setAuditoriaP(null)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg shrink-0">
                              <X size={18} />
                            </button>
                          </div>

                          {/* Body */}
                          <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Resumo */}
                            <div className="grid grid-cols-4 gap-3">
                              {[
                                { label: 'Novas', value: auditoriaP.totalNovas, cls: 'bg-blue-50 text-blue-700 border-blue-100' },
                                { label: 'Atualizadas', value: auditoriaP.totalAtualizadas, cls: 'bg-gray-50 text-gray-700 border-gray-200' },
                                { label: 'Baixadas Sistema', value: auditoriaP.totalBaixadas, cls: 'bg-green-50 text-green-700 border-green-100' },
                                { label: 'Ignoradas', value: auditoriaP.totalIgnoradas, cls: 'bg-red-50 text-red-700 border-red-100' },
                              ].map(({ label, value, cls }) => (
                                <div key={label} className={`rounded-xl border px-4 py-3 text-center ${cls}`}>
                                  <div className="text-2xl font-bold">{value}</div>
                                  <div className="text-xs mt-0.5">{label}</div>
                                </div>
                              ))}
                            </div>

                            {/* Importadas com sucesso */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle2 size={16} className="text-green-600" />
                                <h3 className="text-sm font-semibold text-green-700">
                                  Processadas com sucesso ({auditoriaP.totalNovas + auditoriaP.totalAtualizadas + auditoriaP.totalBaixadas})
                                </h3>
                              </div>
                              <div className="rounded-lg border border-green-100 bg-green-50/40 px-4 py-3 text-xs text-green-800 space-y-1">
                                <div><span className="font-medium">{auditoriaP.totalNovas}</span> parcelas novas inseridas</div>
                                <div><span className="font-medium">{auditoriaP.totalAtualizadas}</span> parcelas atualizadas</div>
                                <div><span className="font-medium">{auditoriaP.totalBaixadas}</span> parcelas baixadas automaticamente pelo sistema</div>
                              </div>
                            </div>

                            {/* Ignoradas */}
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <XCircle size={16} className="text-red-500" />
                                <h3 className="text-sm font-semibold text-red-700">Ignoradas / Erros ({auditoriaP.linhasIgnoradas.length})</h3>
                              </div>
                              {auditoriaP.linhasIgnoradas.length === 0 ? (
                                <p className="text-xs text-gray-400 italic">Nenhuma linha ignorada</p>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-red-100">
                                  <table className="w-full text-xs">
                                    <thead className="bg-red-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-red-800">Linha</th>
                                        <th className="px-3 py-2 text-left font-semibold text-red-800">Motivo</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-red-50">
                                      {auditoriaP.linhasIgnoradas.map((l, i) => (
                                        <tr key={i} className="hover:bg-red-50/50">
                                          <td className="px-3 py-2 text-gray-500">{l.linha}</td>
                                          <td className="px-3 py-2 text-red-700">{l.motivo}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {confirmDelP && (() => {
                    // Para lotes novos usa idsSalvos; para lotes antigos usa primeiraAtualizacao
                    const idsParaRemover: Set<string> = confirmDelP.idsSalvos?.length
                      ? new Set(confirmDelP.idsSalvos)
                      : new Set(parcelas.filter(p => p.primeiraAtualizacao === confirmDelP.dataImport).map(p => p.id));
                    const qtd = idsParaRemover.size;
                    return (
                      <ConfirmDialog
                        open
                        title="Excluir importação de parcelas"
                        message={`Excluir a importação "${confirmDelP.nomeArquivo}"? ${qtd > 0 ? `As ${qtd} parcelas criadas por este import também serão removidas.` : 'Nenhuma parcela vinculada encontrada.'}`}
                        confirmLabel="Excluir"
                        danger
                        onConfirm={() => {
                          if (idsParaRemover.size > 0) {
                            setParcelas(parcelas.filter(p => !idsParaRemover.has(p.id)));
                          }
                          setImportacoesParcelas(importacoesParcelas.filter(i => i.id !== confirmDelP.id));
                          setConfirmDelP(null);
                        }}
                        onCancel={() => setConfirmDelP(null)}
                      />
                    );
                  })()}
                </>
              );
            })()}

            <ConfirmDialog
              open={confirmUndo !== null}
              title="Desfazer importação"
              message={confirmUndo
                ? `Tem certeza que deseja desfazer a importação de "${confirmUndo.nomeArquivo}"? Isso removerá ${confirmUndo.totalImportados} registro(s) e não pode ser desfeito.`
                : ''}
              confirmLabel="Desfazer"
              danger
              onConfirm={() => confirmUndo && desfazerImportacao(confirmUndo)}
              onCancel={() => setConfirmUndo(null)}
            />
          </div>
        );
      })()}

      {/* ── Assinaturas Eletrônicas ────────────────────────────── */}
      {tab === 'assinaturas' && <ConfigAssinaturas config={clicksignConfig} setConfig={setClicksignConfig} modelos={clicksignModelos} setModelos={setClicksignModelos} />}
    </div>
  );
}
