import { useState, useMemo, useRef } from 'react';
import {
  Mail, Send, Clock, CheckCircle2, XCircle, AlertCircle,
  Settings, Bell, Users, Plus, Edit2, Trash2, X, Zap, Image,
} from 'lucide-react';
import type { ModeloEmail, EmailDisparo, GatilhoEmail, Cliente, SeguroNovo, Renovacao, Usuario, ConfigGatilho } from '../types';
import { generateId } from '../utils/formatters';

interface Props {
  modelosEmail: ModeloEmail[];
  setModelosEmail: (items: ModeloEmail[]) => void;
  emailsDisparo: EmailDisparo[];
  setEmailsDisparo: (items: EmailDisparo[]) => void;
  configGatilhos: ConfigGatilho[];
  setConfigGatilhos: (items: ConfigGatilho[]) => void;
  clientes: Cliente[];
  segurosNovos: SeguroNovo[];
  renovacoes: Renovacao[];
  usuarios: Usuario[];
}

type Tab = 'modelos' | 'gatilhos' | 'disparos' | 'configuracoes';

const GATILHO_LABELS: Record<GatilhoEmail, string> = {
  aniversario:         '🎂 Aniversário',
  seguro_novo_fechado: '✅ SN Fechado',
  seguro_renovado:     '🔄 Renovado',
  seguro_a_renovar:    '⏰ A Renovar',
  seguro_nao_renovado: '❌ Não Renovado',
  massa:               '📢 E-mail em Massa',
  manual:              '✉️ Manual',
};

const GATILHO_OPTIONS: GatilhoEmail[] = [
  'aniversario', 'seguro_novo_fechado', 'seguro_renovado',
  'seguro_a_renovar', 'seguro_nao_renovado', 'massa', 'manual',
];

const GATILHOS_AUTOMATICOS: { gatilho: GatilhoEmail; titulo: string; descricao: string; icone: string }[] = [
  {
    gatilho: 'aniversario',
    titulo: 'Aniversário do Cliente',
    descricao: 'Disparado no dia do aniversário do cliente. Requer campo "Data de Nascimento" preenchido no cadastro do cliente.',
    icone: '🎂',
  },
  {
    gatilho: 'seguro_novo_fechado',
    titulo: 'Seguro Novo Fechado',
    descricao: 'Disparado automaticamente quando um Seguro Novo tem o status alterado para "Fechado".',
    icone: '✅',
  },
  {
    gatilho: 'seguro_renovado',
    titulo: 'Seguro Renovado',
    descricao: 'Disparado automaticamente quando uma Renovação tem o status alterado para "Renovado".',
    icone: '🔄',
  },
  {
    gatilho: 'seguro_a_renovar',
    titulo: 'Seguro Próximo do Vencimento',
    descricao: 'Disparado quando uma renovação está dentro dos dias de antecedência configurados no modelo. Configure os dias no modelo associado.',
    icone: '⏰',
  },
  {
    gatilho: 'seguro_nao_renovado',
    titulo: 'Seguro Não Renovado',
    descricao: 'Disparado automaticamente quando uma Renovação tem o status alterado para "Não Renovada".',
    icone: '❌',
  },
];

const VARIAVEIS_HELP = [
  { var: '{{nome}}',        label: 'Nome' },
  { var: '{{email}}',       label: 'E-mail' },
  { var: '{{produto}}',     label: 'Produto/Ramo' },
  { var: '{{seguradora}}',  label: 'Seguradora' },
  { var: '{{vencimento}}',  label: 'Vencimento' },
];

function substituirVariaveis(texto: string, vars: Record<string, string>): string {
  return texto
    .replace(/\{\{nome\}\}/g, vars.nome || '')
    .replace(/\{\{email\}\}/g, vars.email || '')
    .replace(/\{\{produto\}\}/g, vars.produto || '')
    .replace(/\{\{seguradora\}\}/g, vars.seguradora || '')
    .replace(/\{\{vencimento\}\}/g, vars.vencimento || '');
}

const modeloVazio = (): Omit<ModeloEmail, 'id' | 'criadoEm'> => ({
  nome: '',
  assunto: '',
  corpo: '',
  gatilho: 'manual',
  ativo: true,
  diasAntecedencia: undefined,
});

// ─── Body Editor with image support ──────────────────────────────────────────

function BodyEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function insertAtCursor(text: string) {
    const ta = textareaRef.current;
    if (!ta) { onChange(value + text); return; }
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;
    const next  = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    // restore cursor after React re-renders
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('A imagem deve ter menos de 5 MB.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const base64 = ev.target?.result as string;
      const tag = `\n<img src="${base64}" alt="${file.name}" style="max-width:100%;height:auto;" />\n`;
      insertAtCursor(tag);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-1.5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-t-lg px-2 py-1.5">
        <span className="text-xs text-gray-400 font-medium mr-1">Variáveis:</span>
        {VARIAVEIS_HELP.map(v => (
          <button
            key={v.var}
            type="button"
            onClick={() => insertAtCursor(v.var)}
            className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded font-mono transition-colors"
            title={`Inserir ${v.label}`}
          >
            {v.var}
          </button>
        ))}
        <div className="w-px h-4 bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1 text-xs px-2 py-0.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded transition-colors"
          title="Inserir imagem (máx. 5 MB)"
        >
          <Image size={12} />
          Imagem
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={14}
        className="w-full border border-gray-300 border-t-0 rounded-b-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y font-mono"
        placeholder={"Olá {{nome}},\n\nSeu seguro de {{produto}} está próximo do vencimento...\n\n<!-- Você pode usar HTML e inserir imagens pelo botão acima -->"}
      />
      <p className="text-xs text-gray-400">
        Suporta HTML. Use as variáveis acima para personalizar o conteúdo.
      </p>
    </div>
  );
}

// ─── Modelos Tab ─────────────────────────────────────────────────────────────

function TabModelos({
  modelosEmail,
  setModelosEmail,
  onIrParaGatilho,
}: {
  modelosEmail: ModeloEmail[];
  setModelosEmail: (items: ModeloEmail[]) => void;
  onIrParaGatilho?: (g: GatilhoEmail) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [form, setForm]         = useState(modeloVazio());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function abrirNovo(gatilhoInicial?: GatilhoEmail) {
    setForm({ ...modeloVazio(), gatilho: gatilhoInicial ?? 'manual' });
    setEditId(null);
    setShowForm(true);
  }

  function abrirEdicao(m: ModeloEmail) {
    setForm({
      nome: m.nome,
      assunto: m.assunto,
      corpo: m.corpo,
      gatilho: m.gatilho,
      ativo: m.ativo,
      diasAntecedencia: m.diasAntecedencia,
    });
    setEditId(m.id);
    setShowForm(true);
  }

  function salvar() {
    if (!form.nome.trim()) { alert('Informe o nome do modelo.'); return; }
    if (!form.assunto.trim()) { alert('Informe o assunto.'); return; }
    if (!form.corpo.trim()) { alert('Informe o corpo do e-mail.'); return; }

    if (editId) {
      setModelosEmail(modelosEmail.map(m => m.id === editId
        ? { ...m, ...form, diasAntecedencia: form.gatilho === 'seguro_a_renovar' ? form.diasAntecedencia : undefined }
        : m));
    } else {
      const novo: ModeloEmail = {
        id: generateId(),
        ...form,
        diasAntecedencia: form.gatilho === 'seguro_a_renovar' ? form.diasAntecedencia : undefined,
        criadoEm: new Date().toISOString(),
      };
      setModelosEmail([...modelosEmail, novo]);
    }
    setShowForm(false);
  }

  function deletar() {
    if (!confirmDelete) return;
    setModelosEmail(modelosEmail.filter(m => m.id !== confirmDelete));
    setConfirmDelete(null);
  }

  function toggleAtivo(id: string) {
    setModelosEmail(modelosEmail.map(m => m.id === id ? { ...m, ativo: !m.ativo } : m));
  }

  // expose abrirNovo so TabGatilhos can call it via ref — simpler: pass it up via prop
  // Instead, we'll pass a callback from parent

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{modelosEmail.length} modelo(s) cadastrado(s)</p>
        <button
          onClick={() => abrirNovo()}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />
          Novo Modelo
        </button>
      </div>

      {modelosEmail.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Mail size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum modelo cadastrado. Crie o primeiro modelo de e-mail.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Gatilho</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Assunto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {modelosEmail.map(m => (
                <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">{m.nome}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {GATILHO_LABELS[m.gatilho]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell max-w-xs truncate">{m.assunto}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAtivo(m.id)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                        m.ativo
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {m.ativo ? 'Ativo' : 'Inativo'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => abrirEdicao(m)}
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(m.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Form Panel */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end">
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-base font-semibold text-gray-800">
                {editId ? 'Editar Modelo' : 'Novo Modelo de E-mail'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Ex: Boas-vindas ao cliente"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Gatilho <span className="text-red-500">*</span></label>
                <select
                  value={form.gatilho}
                  onChange={e => setForm(f => ({ ...f, gatilho: e.target.value as GatilhoEmail }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  {GATILHO_OPTIONS.map(g => (
                    <option key={g} value={g}>{GATILHO_LABELS[g]}</option>
                  ))}
                </select>
              </div>

              {form.gatilho === 'seguro_a_renovar' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dias de antecedência</label>
                  <input
                    type="number"
                    min={1}
                    value={form.diasAntecedencia ?? ''}
                    onChange={e => setForm(f => ({ ...f, diasAntecedencia: parseInt(e.target.value) || undefined }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Ex: 30"
                  />
                  <p className="text-xs text-gray-400 mt-1">Quantos dias antes do vencimento disparar este e-mail.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assunto <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.assunto}
                  onChange={e => setForm(f => ({ ...f, assunto: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Ex: Olá {{nome}}, seu seguro está próximo do vencimento"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Corpo do E-mail <span className="text-red-500">*</span></label>
                <BodyEditor
                  value={form.corpo}
                  onChange={v => setForm(f => ({ ...f, corpo: v }))}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="modelo-ativo"
                  checked={form.ativo}
                  onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="modelo-ativo" className="text-sm text-gray-700">Modelo ativo</label>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
              >
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-gray-800 mb-2">Excluir modelo?</h3>
            <p className="text-sm text-gray-500 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={deletar}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suppress unused prop warning */}
      {onIrParaGatilho && null}
    </div>
  );
}

// ─── Gatilhos Tab ─────────────────────────────────────────────────────────────

const gatilhoVazio = (): Omit<ConfigGatilho, 'id' | 'criadoEm'> => ({
  nome: '',
  descricao: '',
  evento: 'seguro_novo_fechado',
  modeloId: undefined,
  ativo: true,
  diasAntecedencia: undefined,
});

function TabGatilhos({
  configGatilhos,
  setConfigGatilhos,
  modelosEmail,
}: {
  configGatilhos: ConfigGatilho[];
  setConfigGatilhos: (items: ConfigGatilho[]) => void;
  modelosEmail: ModeloEmail[];
}) {
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<string | null>(null);
  const [form, setForm]           = useState(gatilhoVazio());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Modelos filtrados pelo evento selecionado no form
  const modelosDoEvento = modelosEmail.filter(m => m.gatilho === form.evento);

  function abrirNovo(eventoInicial?: GatilhoEmail) {
    setForm({ ...gatilhoVazio(), evento: eventoInicial ?? 'seguro_novo_fechado' });
    setEditId(null);
    setShowForm(true);
  }

  function abrirEdicao(g: ConfigGatilho) {
    setForm({
      nome: g.nome,
      descricao: g.descricao ?? '',
      evento: g.evento,
      modeloId: g.modeloId,
      ativo: g.ativo,
      diasAntecedencia: g.diasAntecedencia,
    });
    setEditId(g.id);
    setShowForm(true);
  }

  function salvar() {
    if (!form.nome.trim()) { alert('Informe o nome do gatilho.'); return; }

    const payload: ConfigGatilho = {
      id: editId ?? generateId(),
      nome: form.nome.trim(),
      descricao: form.descricao?.trim() || undefined,
      evento: form.evento,
      modeloId: form.modeloId || undefined,
      ativo: form.ativo,
      diasAntecedencia: form.evento === 'seguro_a_renovar' ? form.diasAntecedencia : undefined,
      criadoEm: editId
        ? (configGatilhos.find(g => g.id === editId)?.criadoEm ?? new Date().toISOString())
        : new Date().toISOString(),
    };

    if (editId) {
      setConfigGatilhos(configGatilhos.map(g => g.id === editId ? payload : g));
    } else {
      setConfigGatilhos([...configGatilhos, payload]);
    }
    setShowForm(false);
  }

  function deletar() {
    if (!confirmDelete) return;
    setConfigGatilhos(configGatilhos.filter(g => g.id !== confirmDelete));
    setConfirmDelete(null);
  }

  function toggleAtivo(id: string) {
    setConfigGatilhos(configGatilhos.map(g => g.id === id ? { ...g, ativo: !g.ativo } : g));
  }

  // Descobrir quais eventos automáticos ainda não têm gatilho configurado
  const eventosConfigurados = new Set(configGatilhos.map(g => g.evento));
  const eventosSemGatilho = GATILHOS_AUTOMATICOS.filter(ga => !eventosConfigurados.has(ga.gatilho));

  return (
    <div className="space-y-4">

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <Zap size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-semibold mb-0.5">Gerenciamento de Gatilhos</p>
          <p className="text-xs leading-relaxed">
            Crie gatilhos para associar eventos do sistema (seguro fechado, renovação, aniversário…)
            a modelos de e-mail específicos. Cada gatilho pode ser ativado ou desativado sem ser excluído.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-500">{configGatilhos.length} gatilho(s) configurado(s)</p>
        <button
          onClick={() => abrirNovo()}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} />
          Novo Gatilho
        </button>
      </div>

      {/* Sugestão de eventos sem gatilho */}
      {eventosSemGatilho.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 mb-2">
            ⚡ Eventos sem gatilho configurado:
          </p>
          <div className="flex flex-wrap gap-2">
            {eventosSemGatilho.map(({ gatilho, titulo, icone }) => (
              <button
                key={gatilho}
                onClick={() => abrirNovo(gatilho)}
                className="flex items-center gap-1.5 text-xs bg-white border border-amber-300 hover:border-amber-400 text-amber-800 hover:text-amber-900 px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              >
                <span>{icone}</span>
                <span>{titulo}</span>
                <Plus size={11} className="text-amber-500" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lista de gatilhos */}
      {configGatilhos.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Zap size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum gatilho configurado ainda.</p>
          <p className="text-xs mt-1">Clique em "Novo Gatilho" ou use as sugestões acima para começar.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Evento</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Modelo vinculado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Configuração</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {configGatilhos.map(g => {
                const modelo = modelosEmail.find(m => m.id === g.modeloId);
                const infoGatilho = GATILHOS_AUTOMATICOS.find(ga => ga.gatilho === g.evento);
                return (
                  <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{g.nome}</div>
                      {g.descricao && (
                        <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">{g.descricao}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {infoGatilho?.icone ?? ''} {GATILHO_LABELS[g.evento]}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {modelo ? (
                        <span className="text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">{modelo.nome}</span>
                      ) : (
                        <span className="text-xs text-amber-600 italic">Sem modelo</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                      {g.evento === 'seguro_a_renovar' && g.diasAntecedencia
                        ? <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-medium">{g.diasAntecedencia} dias antes</span>
                        : <span className="text-gray-400">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAtivo(g.id)}
                        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors ${
                          g.ativo
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {g.ativo ? 'Ativo' : 'Inativo'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => abrirEdicao(g)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(g.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Referência dos eventos disponíveis */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
        <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Referência de Eventos</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {GATILHOS_AUTOMATICOS.map(({ gatilho, titulo, descricao, icone }) => {
            const qtd = configGatilhos.filter(g => g.evento === gatilho && g.ativo).length;
            return (
              <div key={gatilho} className="flex items-start gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2.5">
                <span className="text-base leading-none mt-0.5">{icone}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">{titulo}</span>
                    {qtd > 0
                      ? <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">{qtd} ativo</span>
                      : <span className="text-[10px] bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">sem gatilho</span>
                    }
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{descricao}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Form Panel */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-end">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
              <h3 className="text-base font-semibold text-gray-800">
                {editId ? 'Editar Gatilho' : 'Novo Gatilho'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 px-5 py-4 space-y-4">

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Ex: E-mail de boas-vindas ao novo seguro"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={form.descricao ?? ''}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  placeholder="Descreva quando e como este gatilho será usado..."
                />
              </div>

              {/* Evento */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Evento <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.evento}
                  onChange={e => setForm(f => ({ ...f, evento: e.target.value as GatilhoEmail, modeloId: undefined }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                >
                  {GATILHO_OPTIONS.map(g => (
                    <option key={g} value={g}>{GATILHO_LABELS[g]}</option>
                  ))}
                </select>
                {(() => {
                  const info = GATILHOS_AUTOMATICOS.find(ga => ga.gatilho === form.evento);
                  return info ? (
                    <p className="text-xs text-gray-400 mt-1 leading-relaxed">{info.descricao}</p>
                  ) : null;
                })()}
              </div>

              {/* Dias de antecedência (apenas seguro_a_renovar) */}
              {form.evento === 'seguro_a_renovar' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dias de antecedência</label>
                  <input
                    type="number"
                    min={1}
                    value={form.diasAntecedencia ?? ''}
                    onChange={e => setForm(f => ({ ...f, diasAntecedencia: parseInt(e.target.value) || undefined }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Ex: 30"
                  />
                  <p className="text-xs text-gray-400 mt-1">Quantos dias antes do vencimento disparar este gatilho.</p>
                </div>
              )}

              {/* Modelo vinculado */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo de e-mail</label>
                {modelosDoEvento.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-amber-700">
                      Nenhum modelo com o gatilho <strong>{GATILHO_LABELS[form.evento]}</strong> encontrado.
                      Crie um modelo na aba <em>Modelos</em> primeiro e depois volte para vincular.
                    </p>
                  </div>
                ) : (
                  <select
                    value={form.modeloId ?? ''}
                    onChange={e => setForm(f => ({ ...f, modeloId: e.target.value || undefined }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                  >
                    <option value="">Selecione um modelo (opcional)...</option>
                    {modelosDoEvento.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nome}{!m.ativo ? ' (inativo)' : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  O modelo define o conteúdo do e-mail disparado neste evento.
                </p>
              </div>

              {/* Ativo */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="gatilho-ativo"
                  checked={form.ativo}
                  onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                />
                <label htmlFor="gatilho-ativo" className="text-sm text-gray-700">Gatilho ativo</label>
              </div>
            </div>

            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvar}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition-colors"
              >
                Salvar Gatilho
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-gray-800 mb-2">Excluir gatilho?</h3>
            <p className="text-sm text-gray-500 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={deletar}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Disparos Tab ─────────────────────────────────────────────────────────────

function TabDisparos({
  emailsDisparo,
  setEmailsDisparo,
  modelosEmail,
  clientes,
  renovacoes,
}: {
  emailsDisparo: EmailDisparo[];
  setEmailsDisparo: (items: EmailDisparo[]) => void;
  modelosEmail: ModeloEmail[];
  clientes: Cliente[];
  renovacoes: Renovacao[];
}) {
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'enviado' | 'erro'>('todos');
  const [filtroGatilho, setFiltroGatilho] = useState<GatilhoEmail | 'todos'>('todos');
  const [showCampanha, setShowCampanha] = useState(false);
  const [modeloCampanhaId, setModeloCampanhaId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const hoje = new Date().toISOString().split('T')[0];

  // Birthday detection
  const aniversariantesHoje = useMemo(() => {
    const todayMD = hoje.slice(5); // MM-DD
    return clientes.filter(c => c.dataNascimento && c.dataNascimento.slice(5) === todayMD);
  }, [clientes, hoje]);

  // Upcoming renewals detection
  const modeloRenovar = useMemo(() =>
    modelosEmail.find(m => m.ativo && m.gatilho === 'seguro_a_renovar'),
    [modelosEmail]
  );

  const renovacoesProximas = useMemo(() => {
    if (!modeloRenovar?.diasAntecedencia) return [];
    const diasMs = modeloRenovar.diasAntecedencia * 24 * 60 * 60 * 1000;
    const limite = new Date(Date.now() + diasMs).toISOString().split('T')[0];
    return renovacoes.filter(r =>
      r.fimVigencia >= hoje &&
      r.fimVigencia <= limite &&
      r.status !== 'renovado' &&
      r.status !== 'nao_renovada'
    );
  }, [renovacoes, modeloRenovar, hoje]);

  const modelosMassaManual = modelosEmail.filter(m => m.gatilho === 'massa' || m.gatilho === 'manual');
  const clientesComEmail = clientes.filter(c => c.email?.trim());

  const filtrados = useMemo(() => {
    return emailsDisparo.filter(e => {
      if (filtroStatus !== 'todos' && e.status !== filtroStatus) return false;
      if (filtroGatilho !== 'todos' && e.gatilho !== filtroGatilho) return false;
      return true;
    });
  }, [emailsDisparo, filtroStatus, filtroGatilho]);

  const totalPendente = emailsDisparo.filter(e => e.status === 'pendente').length;
  const totalEnviado  = emailsDisparo.filter(e => e.status === 'enviado').length;
  const totalErro     = emailsDisparo.filter(e => e.status === 'erro').length;

  function dispararAniversario() {
    const modeloAniv = modelosEmail.find(m => m.ativo && m.gatilho === 'aniversario');
    if (!modeloAniv) {
      alert('Nenhum modelo de aniversário ativo encontrado. Crie um na aba Modelos.');
      return;
    }
    const novos: EmailDisparo[] = [];
    for (const cliente of aniversariantesHoje) {
      if (!cliente.email?.trim()) continue;
      const jaEnviado = emailsDisparo.some(e =>
        e.referenciaId === cliente.id &&
        e.gatilho === 'aniversario' &&
        e.criadoEm.startsWith(hoje)
      );
      if (jaEnviado) continue;

      novos.push({
        id: generateId(),
        modeloId: modeloAniv.id,
        modeloNome: modeloAniv.nome,
        destinatarioEmail: cliente.email,
        destinatarioNome: cliente.nome,
        assunto: substituirVariaveis(modeloAniv.assunto, { nome: cliente.nome, email: cliente.email, produto: '', seguradora: '', vencimento: '' }),
        corpo: substituirVariaveis(modeloAniv.corpo, { nome: cliente.nome, email: cliente.email, produto: '', seguradora: '', vencimento: '' }),
        status: 'pendente',
        gatilho: 'aniversario',
        referenciaId: cliente.id,
        criadoEm: new Date().toISOString(),
      });
    }
    if (novos.length === 0) {
      alert('Todos os aniversariantes de hoje já receberam o e-mail hoje, ou não possuem e-mail cadastrado.');
      return;
    }
    setEmailsDisparo([...emailsDisparo, ...novos]);
    alert(`${novos.length} e-mail(s) de aniversário adicionado(s) à fila.`);
  }

  function dispararRenovacoes() {
    if (!modeloRenovar) return;
    const novos: EmailDisparo[] = [];
    for (const ren of renovacoesProximas) {
      if (!ren.emailCliente?.trim()) continue;
      novos.push({
        id: generateId(),
        modeloId: modeloRenovar.id,
        modeloNome: modeloRenovar.nome,
        destinatarioEmail: ren.emailCliente,
        destinatarioNome: ren.nomeCliente,
        assunto: substituirVariaveis(modeloRenovar.assunto, {
          nome: ren.nomeCliente,
          email: ren.emailCliente,
          produto: ren.ramo,
          seguradora: ren.seguradoraAnterior,
          vencimento: ren.fimVigencia,
        }),
        corpo: substituirVariaveis(modeloRenovar.corpo, {
          nome: ren.nomeCliente,
          email: ren.emailCliente,
          produto: ren.ramo,
          seguradora: ren.seguradoraAnterior,
          vencimento: ren.fimVigencia,
        }),
        status: 'pendente',
        gatilho: 'seguro_a_renovar',
        referenciaId: ren.id,
        criadoEm: new Date().toISOString(),
      });
    }
    if (novos.length === 0) {
      alert('Nenhuma renovação com e-mail cadastrado encontrada para disparar.');
      return;
    }
    setEmailsDisparo([...emailsDisparo, ...novos]);
    alert(`${novos.length} e-mail(s) de renovação adicionado(s) à fila.`);
  }

  function agendarCampanha() {
    if (!modeloCampanhaId) { alert('Selecione um modelo.'); return; }
    const modelo = modelosEmail.find(m => m.id === modeloCampanhaId);
    if (!modelo) return;
    const novos: EmailDisparo[] = clientesComEmail.map(cliente => ({
      id: generateId(),
      modeloId: modelo.id,
      modeloNome: modelo.nome,
      destinatarioEmail: cliente.email,
      destinatarioNome: cliente.nome,
      assunto: substituirVariaveis(modelo.assunto, { nome: cliente.nome, email: cliente.email, produto: '', seguradora: '', vencimento: '' }),
      corpo: substituirVariaveis(modelo.corpo, { nome: cliente.nome, email: cliente.email, produto: '', seguradora: '', vencimento: '' }),
      status: 'pendente',
      gatilho: modelo.gatilho,
      referenciaId: cliente.id,
      criadoEm: new Date().toISOString(),
    }));
    setEmailsDisparo([...emailsDisparo, ...novos]);
    setShowCampanha(false);
    setModeloCampanhaId('');
    alert(`${novos.length} e-mail(s) adicionado(s) à fila de envio.`);
  }

  function deletarDisparo() {
    if (!confirmDeleteId) return;
    setEmailsDisparo(emailsDisparo.filter(e => e.id !== confirmDeleteId));
    setConfirmDeleteId(null);
  }

  const formatDataHora = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Clock size={20} className="text-yellow-600 shrink-0" />
          <div>
            <p className="text-xs text-yellow-700 font-medium">Pendentes</p>
            <p className="text-xl font-bold text-yellow-800">{totalPendente}</p>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <CheckCircle2 size={20} className="text-green-600 shrink-0" />
          <div>
            <p className="text-xs text-green-700 font-medium">Enviados</p>
            <p className="text-xl font-bold text-green-800">{totalEnviado}</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <XCircle size={20} className="text-red-600 shrink-0" />
          <div>
            <p className="text-xs text-red-700 font-medium">Com Erro</p>
            <p className="text-xl font-bold text-red-800">{totalErro}</p>
          </div>
        </div>
      </div>

      {/* Birthday Alert */}
      {aniversariantesHoje.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <Bell size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">🎂 Aniversariantes hoje</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {aniversariantesHoje.map(c => c.nome).join(', ')}
                </p>
              </div>
            </div>
            <button
              onClick={dispararAniversario}
              className="flex items-center gap-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              <Send size={13} />
              Disparar e-mail de aniversário
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Renewals Alert */}
      {renovacoesProximas.length > 0 && modeloRenovar && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">
                  {renovacoesProximas.length} renovação(ões) vencendo nos próximos {modeloRenovar.diasAntecedencia} dias
                </p>
                <p className="text-xs text-blue-600 mt-0.5">
                  {renovacoesProximas.slice(0, 5).map(r => r.nomeCliente).join(', ')}
                  {renovacoesProximas.length > 5 ? ` e mais ${renovacoesProximas.length - 5}...` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={dispararRenovacoes}
              className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              <Send size={13} />
              Disparar e-mails
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as typeof filtroStatus)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="todos">Todos os status</option>
            <option value="pendente">Pendente</option>
            <option value="enviado">Enviado</option>
            <option value="erro">Erro</option>
          </select>
          <select
            value={filtroGatilho}
            onChange={e => setFiltroGatilho(e.target.value as typeof filtroGatilho)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="todos">Todos os gatilhos</option>
            {GATILHO_OPTIONS.map(g => (
              <option key={g} value={g}>{GATILHO_LABELS[g]}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowCampanha(true)}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Users size={15} />
          Nova Campanha em Massa
        </button>
      </div>

      {/* Disparos Table */}
      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Send size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum disparo encontrado com os filtros selecionados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Data</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Destinatário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Assunto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Gatilho</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtrados.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formatDataHora(e.criadoEm)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-800 text-sm">{e.destinatarioNome}</div>
                    <div className="text-xs text-gray-400">{e.destinatarioEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell max-w-xs truncate">{e.assunto}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {GATILHO_LABELS[e.gatilho]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {e.status === 'pendente' && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Pendente</span>
                    )}
                    {e.status === 'enviado' && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Enviado</span>
                    )}
                    {e.status === 'erro' && (
                      <span
                        className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium cursor-help"
                        title={e.erroMsg || 'Erro desconhecido'}
                      >
                        Erro
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {e.status === 'pendente' && (
                        <button
                          disabled
                          title="Configuração de e-mail pendente"
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed"
                        >
                          <Send size={12} />
                          Enviar
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteId(e.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Campanha Modal */}
      {showCampanha && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">Nova Campanha em Massa</h3>
              <button onClick={() => setShowCampanha(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modelo</label>
                {modelosMassaManual.length === 0 ? (
                  <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Nenhum modelo do tipo "E-mail em Massa" ou "Manual" encontrado.
                    Crie um modelo com esse gatilho primeiro.
                  </p>
                ) : (
                  <select
                    value={modeloCampanhaId}
                    onChange={e => setModeloCampanhaId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Selecione um modelo...</option>
                    {modelosMassaManual.map(m => (
                      <option key={m.id} value={m.id}>{m.nome} — {GATILHO_LABELS[m.gatilho]}</option>
                    ))}
                  </select>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center gap-2">
                <Users size={16} className="text-blue-600 shrink-0" />
                <p className="text-sm text-blue-700">
                  <strong>{clientesComEmail.length}</strong> cliente(s) com e-mail cadastrado receberão esta campanha.
                </p>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCampanha(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={agendarCampanha}
                disabled={!modeloCampanhaId || modelosMassaManual.length === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={14} />
                Agendar Disparo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-semibold text-gray-800 mb-2">Excluir disparo?</h3>
            <p className="text-sm text-gray-500 mb-5">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={deletarDisparo}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Configurações Tab ────────────────────────────────────────────────────────

function TabConfiguracoes() {
  return (
    <div className="max-w-lg">
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Settings size={20} className="text-blue-700" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800">Configuração de Envio de E-mail</h3>
            <p className="text-sm text-gray-500">Configure sua conta do Google (Gmail) ou outro provedor SMTP para habilitar o envio de e-mails.</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-2">
          <AlertCircle size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Para configurar o envio via Gmail, você precisará de uma conta Google e habilitar o acesso de aplicativos.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <span>Provedor</span>
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-normal">
                🔒 Disponível em breve
              </span>
            </label>
            <select
              disabled
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            >
              <option>Gmail</option>
              <option>SMTP Customizado</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <span>E-mail remetente</span>
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-normal">
                🔒 Disponível em breve
              </span>
            </label>
            <input
              disabled
              type="email"
              placeholder="seuemail@gmail.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <span>Senha / Token de App</span>
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded font-normal">
                🔒 Disponível em breve
              </span>
            </label>
            <input
              disabled
              type="password"
              placeholder="••••••••••••"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>

          <button
            disabled
            className="w-full py-2.5 text-sm font-medium bg-gray-100 text-gray-400 rounded-lg cursor-not-allowed"
          >
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Emails Page ─────────────────────────────────────────────────────────

export function Emails({
  modelosEmail,
  setModelosEmail,
  emailsDisparo,
  setEmailsDisparo,
  configGatilhos,
  setConfigGatilhos,
  clientes,
  segurosNovos,
  renovacoes,
  usuarios,
}: Props) {
  const [tab, setTab] = useState<Tab>('modelos');

  const tabClass = (t: Tab) =>
    `px-4 py-2.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2 ${
      tab === t
        ? 'bg-blue-700 text-white'
        : 'text-gray-600 hover:bg-gray-100'
    }`;

  const pendentesCount = emailsDisparo.filter(e => e.status === 'pendente').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Mail size={22} className="text-blue-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-800">E-mails</h1>
          <p className="text-sm text-gray-500">Gerencie modelos, gatilhos automáticos, disparos e campanhas de e-mail</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit flex-wrap">
        <button onClick={() => setTab('modelos')} className={tabClass('modelos')}>
          <Edit2 size={15} />
          Modelos
        </button>
        <button onClick={() => setTab('gatilhos')} className={tabClass('gatilhos')}>
          <Zap size={15} />
          Gatilhos
        </button>
        <button onClick={() => setTab('disparos')} className={tabClass('disparos')}>
          <Send size={15} />
          Disparos
          {pendentesCount > 0 && (
            <span className="ml-1 min-w-[18px] px-1 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded-full flex items-center justify-center h-[18px]">
              {pendentesCount > 99 ? '99+' : pendentesCount}
            </span>
          )}
        </button>
        <button onClick={() => setTab('configuracoes')} className={tabClass('configuracoes')}>
          <Settings size={15} />
          Configurações
        </button>
      </div>

      {/* Tab Content */}
      <div>
        {tab === 'modelos' && (
          <TabModelos
            modelosEmail={modelosEmail}
            setModelosEmail={setModelosEmail}
            onIrParaGatilho={undefined}
          />
        )}
        {tab === 'gatilhos' && (
          <TabGatilhos
            configGatilhos={configGatilhos}
            setConfigGatilhos={setConfigGatilhos}
            modelosEmail={modelosEmail}
          />
        )}
        {tab === 'disparos' && (
          <TabDisparos
            emailsDisparo={emailsDisparo}
            setEmailsDisparo={setEmailsDisparo}
            modelosEmail={modelosEmail}
            clientes={clientes}
            renovacoes={renovacoes}
          />
        )}
        {tab === 'configuracoes' && <TabConfiguracoes />}
      </div>

      {/* Suppress unused import warnings */}
      {usuarios.length < 0 && null}
      {segurosNovos.length < 0 && null}
    </div>
  );
}
