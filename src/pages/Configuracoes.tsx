import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, CheckSquare, Square, Check, Lock } from 'lucide-react';
import type { Seguradora, Ramo, ConfiguracoesMetas, MotivoPerda, CampoCustomizavel, ConfiguracaoEmpresa, FaixaMeta, TipoCampoCustom, PlanoMetaRenovacao, PlanoMetaSeguroNovo, TipoUsuario, Role, OrigemProspeccao } from '../types';
import { formatCurrency, formatPercent, generateId } from '../utils/formatters';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Props {
  seguradoras: Seguradora[];
  setSeguradoras: (s: Seguradora[]) => void;
  ramos: Ramo[];
  setRamos: (r: Ramo[]) => void;
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
}

type Tab = 'empresa' | 'seguradoras' | 'ramos' | 'metas' | 'motivos' | 'campos' | 'tipos_usuario' | 'origens_prospeccao';

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

export function Configuracoes({ seguradoras, setSeguradoras, ramos, setRamos, metas, setMetas, motivos, setMotivos, campos, setCampos, empresa, setEmpresa, tiposUsuario, setTiposUsuario, origensProspeccao, setOrigensProspeccao }: Props) {
  const [tab, setTab] = useState<Tab>('empresa');

  // Seguradoras state
  const [editSeg, setEditSeg] = useState<Seguradora | null>(null);
  const [criandoSeg, setCriandoSeg] = useState(false);
  const [formSegNome, setFormSegNome] = useState('');
  const [confirmDelSeg, setConfirmDelSeg] = useState<string | null>(null);

  // Ramos state
  const [editRamo, setEditRamo] = useState<Ramo | null>(null);
  const [criandoRamo, setCriandoRamo] = useState(false);
  const [formRamo, setFormRamo] = useState<Omit<Ramo, 'id'>>({ nome: '', ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 0, valorFixo: 0, considerarParaTaxaSegurosNovos: true, considerarParaTaxaConversao: true, remuneracaoIndividual: false });
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
    visualizarDashboard: true, visualizarProducao: false, visualizarMetas: true, visualizarComissoes: false,
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
  const camposOrd  = useMemo(() => [...campos].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [campos]);
  const origensOrd = useMemo(() => {
    const sistema = origensProspeccao.filter(o => o.isSystem).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const custom  = origensProspeccao.filter(o => !o.isSystem).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return [...sistema, ...custom];
  }, [origensProspeccao]);

  const TABS: { key: Tab; label: string }[] = [
    { key: 'empresa', label: 'Empresa' },
    { key: 'tipos_usuario', label: 'Tipos de Usuário' },
    { key: 'seguradoras', label: 'Seguradoras' },
    { key: 'ramos', label: 'Ramos' },
    { key: 'metas', label: 'Metas' },
    { key: 'motivos', label: 'Motivos de Perda' },
    { key: 'campos', label: 'Campos Customizáveis' },
    { key: 'origens_prospeccao', label: 'Origem do Negócio' },
  ];

  // --- Seguradoras ---
  function salvarSeg() {
    if (!formSegNome.trim()) return;
    if (criandoSeg) {
      setSeguradoras([...seguradoras, { id: generateId(), nome: formSegNome.trim(), ativo: true }]);
    } else if (editSeg) {
      setSeguradoras(seguradoras.map(s => s.id === editSeg.id ? { ...s, nome: formSegNome.trim() } : s));
    }
    setEditSeg(null); setCriandoSeg(false);
  }

  // --- Ramos ---
  function salvarRamo() {
    if (!formRamo.nome.trim()) return;
    if (criandoRamo) {
      setRamos([...ramos, { id: generateId(), ...formRamo }]);
    } else if (editRamo) {
      setRamos(ramos.map(r => r.id === editRamo.id ? { ...editRamo, ...formRamo } : r));
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
        </div>
      )}

      {/* Ramos */}
      {tab === 'ramos' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => { setFormRamo({ nome: '', ativo: true, tipoComissaoSegurosNovos: 'percentual', percentualComissao: 0, valorFixo: 0, considerarParaTaxaSegurosNovos: true, considerarParaTaxaConversao: true, remuneracaoIndividual: false }); setCriandoRamo(true); setEditRamo(null); }}
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
                          <button onClick={() => { setFormRamo({nome: r.nome, ativo: r.ativo, tipoComissaoSegurosNovos: r.tipoComissaoSegurosNovos, percentualComissao: r.percentualComissao, valorFixo: r.valorFixo, considerarParaTaxaSegurosNovos: r.considerarParaTaxaSegurosNovos, considerarParaTaxaConversao: r.considerarParaTaxaConversao, remuneracaoIndividual: r.remuneracaoIndividual ?? false}); setEditRamo(r); setCriandoRamo(false); }}
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
                    <Ck v={formRamo.considerarParaTaxaSegurosNovos} label="Considerar para taxa de seguros novos"
                      onChange={v => setFormRamo(f => ({...f, considerarParaTaxaSegurosNovos: v}))} />
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
        </div>
      )}

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
                          <button onClick={() => { setFormCampo({nome: c.nome, tipo: c.tipo, obrigatorio: c.obrigatorio, ativo: c.ativo, aplicavelA: c.aplicavelA, opcoes: c.opcoes, ramosAplicaveis: c.ramosAplicaveis ?? [], multiplosArquivos: c.multiplosArquivos, tiposPermitidos: c.tiposPermitidos, tamanhoMaximoMB: c.tamanhoMaximoMB}); setOpcoesInput((c.opcoes ?? []).join('\n')); setEditCampo(c); setCriandoCampo(false); }}
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
                        <input type="number" min="1" value={formCampo.tamanhoMaximoMB ?? ''} onChange={e => setFormCampo(f => ({...f, tamanhoMaximoMB: parseFloat(e.target.value) || undefined}))}
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
    </div>
  );
}
