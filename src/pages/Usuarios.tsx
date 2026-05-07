import { useState, useMemo } from 'react';
import { Plus, Edit2, X, Save, Check, CheckSquare, Square, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { Usuario, Role, ConfiguracoesMetas, TipoUsuario, ConfigRamoUsuario, Ramo } from '../types';
import { generateId } from '../utils/formatters';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface Props {
  usuarios: Usuario[];
  setUsuarios: (u: Usuario[]) => void;
  metas: ConfiguracoesMetas;
  tiposUsuario: TipoUsuario[];
  ramos: Ramo[];
}

type FormUsuario = {
  nome: string;
  email: string;
  senha: string;
  role: Role;
  acessoRenovacoes: boolean;
  acessoSegurosNovos: boolean;
  acessoProspeccao: boolean;
  podeDescartarProspeccao: boolean;
  acessoConsultaRenovacoes: boolean;
  visualizarDashboard: boolean;
  visualizarProducao: boolean;
  visualizarMetas: boolean;
  visualizarComissoes: boolean;
  camposRestritos: { renovacoes: string[]; segurosNovos: string[]; prospeccoes: string[] };
  recebeRemuneracaoRenovacoes: boolean;
  planoMetaRenovacaoId: string;
  recebeRemuneracaoTaxaRenovacoes: boolean;
  recebeRemuneracaoAumentoComissao: boolean;
  recebeRemuneracaoSegurosNovos: boolean;
  planoMetaSeguroNovoId: string;
  recebeRemuneracaoSnComissao: boolean;
  recebeRemuneracaoSnTaxa: boolean;
  ativo: boolean;
  tipoUsuarioId: string;
  horarioLoginInicio: string;
  horarioLoginFim: string;
  diasPermitidos: number[];
  exigir2FA: boolean;
  configRamos: ConfigRamoUsuario[];
};

const ROLE_LABELS: Record<Role, string> = { admin: 'Administrador', gestor: 'Gestor', usuario: 'Usuário' };
const ROLE_COLORS: Record<Role, string> = {
  admin: 'bg-red-100 text-red-700',
  gestor: 'bg-blue-100 text-blue-700',
  usuario: 'bg-gray-100 text-gray-700',
};

const formVazio: FormUsuario = {
  nome: '', email: '', senha: '', role: 'usuario',
  acessoRenovacoes: true, acessoSegurosNovos: true, acessoProspeccao: true,
  podeDescartarProspeccao: false,
  acessoConsultaRenovacoes: false,
  visualizarDashboard: true, visualizarProducao: false, visualizarMetas: true, visualizarComissoes: false,
  camposRestritos: { renovacoes: [], segurosNovos: [], prospeccoes: [] },
  recebeRemuneracaoRenovacoes: false, planoMetaRenovacaoId: '',
  recebeRemuneracaoTaxaRenovacoes: true, recebeRemuneracaoAumentoComissao: true,
  recebeRemuneracaoSegurosNovos: false, planoMetaSeguroNovoId: '',
  recebeRemuneracaoSnComissao: true, recebeRemuneracaoSnTaxa: true,
  ativo: true,
  tipoUsuarioId: '',
  horarioLoginInicio: '', horarioLoginFim: '', diasPermitidos: [], exigir2FA: false,
  configRamos: [],
};

function Ck({ v, label, onChange }: { v: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!v)} className="flex items-center gap-2 text-sm text-gray-700">
      {v ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-gray-400" />}
      {label}
    </button>
  );
}

export function Usuarios({ usuarios, setUsuarios, metas, tiposUsuario, ramos }: Props) {
  const { usuario: me } = useAuth();
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<FormUsuario>(formVazio);
  const [copiarDeId, setCopiarDeId] = useState('');
  const [confirmToggle, setConfirmToggle] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const sorted = useMemo(() => [...usuarios].sort((a, b) => a.nome.localeCompare(b.nome)), [usuarios]);

  function abrirCriacao() {
    const firstRen = metas.planosRenovacao[0]?.id ?? '';
    const firstSn = metas.planosSeguroNovo[0]?.id ?? '';
    setForm({ ...formVazio, planoMetaRenovacaoId: firstRen, planoMetaSeguroNovoId: firstSn });
    setCopiarDeId('');
    setEditando(null);
    setCriando(true);
  }

  function aplicarCopiaDeUsuario(id: string) {
    setCopiarDeId(id);
    if (!id) return;
    const u = usuarios.find(x => x.id === id);
    if (!u) return;
    setForm(f => ({
      ...f,
      role: u.role,
      acessoRenovacoes: u.acessoRenovacoes,
      acessoSegurosNovos: u.acessoSegurosNovos,
      acessoProspeccao: u.acessoProspeccao ?? true,
      podeDescartarProspeccao: u.podeDescartarProspeccao ?? false,
      acessoConsultaRenovacoes: u.acessoConsultaRenovacoes ?? false,
      visualizarDashboard: u.visualizarDashboard ?? true,
      visualizarProducao: u.visualizarProducao ?? false,
      visualizarMetas: u.visualizarMetas ?? true,
      visualizarComissoes: u.visualizarComissoes ?? false,
      camposRestritos: u.camposRestritos ?? { renovacoes: [], segurosNovos: [], prospeccoes: [] },
      recebeRemuneracaoRenovacoes: u.recebeRemuneracaoRenovacoes,
      planoMetaRenovacaoId: u.planoMetaRenovacaoId ?? metas.planosRenovacao[0]?.id ?? '',
      recebeRemuneracaoTaxaRenovacoes: u.recebeRemuneracaoTaxaRenovacoes ?? true,
      recebeRemuneracaoAumentoComissao: u.recebeRemuneracaoAumentoComissao ?? true,
      recebeRemuneracaoSegurosNovos: u.recebeRemuneracaoSegurosNovos,
      planoMetaSeguroNovoId: u.planoMetaSeguroNovoId ?? metas.planosSeguroNovo[0]?.id ?? '',
      recebeRemuneracaoSnComissao: u.recebeRemuneracaoSnComissao ?? true,
      recebeRemuneracaoSnTaxa: u.recebeRemuneracaoSnTaxa ?? true,
      tipoUsuarioId: u.tipoUsuarioId ?? '',
      horarioLoginInicio: u.horarioLoginInicio ?? '',
      horarioLoginFim: u.horarioLoginFim ?? '',
      diasPermitidos: u.diasPermitidos ?? [],
      exigir2FA: u.exigir2FA ?? false,
      configRamos: u.configRamos ?? [],
    }));
  }

  function abrirEdicao(u: Usuario) {
    setForm({
      nome: u.nome, email: u.email, senha: '', role: u.role,
      acessoRenovacoes: u.acessoRenovacoes, acessoSegurosNovos: u.acessoSegurosNovos, acessoProspeccao: u.acessoProspeccao ?? true,
      podeDescartarProspeccao: u.podeDescartarProspeccao ?? false,
      acessoConsultaRenovacoes: u.acessoConsultaRenovacoes ?? false,
      visualizarDashboard: u.visualizarDashboard ?? true,
      visualizarProducao: u.visualizarProducao ?? false,
      visualizarMetas: u.visualizarMetas ?? true,
      visualizarComissoes: u.visualizarComissoes ?? false,
      camposRestritos: u.camposRestritos ?? { renovacoes: [], segurosNovos: [], prospeccoes: [] },
      recebeRemuneracaoRenovacoes: u.recebeRemuneracaoRenovacoes,
      planoMetaRenovacaoId: u.planoMetaRenovacaoId ?? metas.planosRenovacao[0]?.id ?? '',
      recebeRemuneracaoTaxaRenovacoes: u.recebeRemuneracaoTaxaRenovacoes ?? true,
      recebeRemuneracaoAumentoComissao: u.recebeRemuneracaoAumentoComissao ?? true,
      recebeRemuneracaoSegurosNovos: u.recebeRemuneracaoSegurosNovos,
      planoMetaSeguroNovoId: u.planoMetaSeguroNovoId ?? metas.planosSeguroNovo[0]?.id ?? '',
      recebeRemuneracaoSnComissao: u.recebeRemuneracaoSnComissao ?? true,
      recebeRemuneracaoSnTaxa: u.recebeRemuneracaoSnTaxa ?? true,
      ativo: u.ativo,
      tipoUsuarioId:      u.tipoUsuarioId      ?? '',
      horarioLoginInicio: u.horarioLoginInicio ?? '',
      horarioLoginFim:    u.horarioLoginFim    ?? '',
      diasPermitidos:     u.diasPermitidos     ?? [],
      exigir2FA:          u.exigir2FA          ?? false,
      configRamos:        u.configRamos        ?? [],
    });
    setEditando(u);
    setCriando(false);
  }

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) { alert('Nome e email são obrigatórios.'); return; }
    if (criando && !form.senha) { alert('Senha é obrigatória para novos usuários.'); return; }
    const emailDup = usuarios.find(u => u.email === form.email && u.id !== editando?.id);
    if (emailDup) { alert('Este email já está em uso.'); return; }

    setSalvando(true);
    try {
      let authUid = editando?.authUid;

      if (criando) {
        // Cria o login no Supabase Auth via Edge Function
        const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
          body: { acao: 'criar', email: form.email, senha: form.senha },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
        authUid = data.authUid;
      } else if (editando && form.senha) {
        // Atualiza a senha no Supabase Auth via Edge Function
        const { data, error } = await supabase.functions.invoke('gerenciar-usuario', {
          body: { acao: 'atualizar_senha', authUid: editando.authUid, senha: form.senha },
        });
        if (error) throw new Error(error.message);
        if (data?.error) throw new Error(data.error);
      }

      const dados: Omit<Usuario, 'id'> = {
        authUid,
        nome: form.nome,
        email: form.email,
        role: form.role,
        acessoRenovacoes: form.acessoRenovacoes,
        acessoSegurosNovos: form.acessoSegurosNovos,
        acessoProspeccao: form.acessoProspeccao,
        podeDescartarProspeccao: form.podeDescartarProspeccao,
        acessoConsultaRenovacoes: form.acessoConsultaRenovacoes,
        visualizarDashboard: form.visualizarDashboard,
        visualizarProducao: form.visualizarProducao,
        visualizarMetas: form.visualizarMetas,
        visualizarComissoes: form.visualizarComissoes,
        camposRestritos: form.camposRestritos,
        recebeRemuneracaoRenovacoes: form.recebeRemuneracaoRenovacoes,
        planoMetaRenovacaoId: form.recebeRemuneracaoRenovacoes ? form.planoMetaRenovacaoId || undefined : undefined,
        recebeRemuneracaoTaxaRenovacoes: form.recebeRemuneracaoRenovacoes ? form.recebeRemuneracaoTaxaRenovacoes : false,
        recebeRemuneracaoAumentoComissao: form.recebeRemuneracaoRenovacoes ? form.recebeRemuneracaoAumentoComissao : false,
        recebeRemuneracaoSegurosNovos: form.recebeRemuneracaoSegurosNovos,
        planoMetaSeguroNovoId: form.recebeRemuneracaoSegurosNovos ? form.planoMetaSeguroNovoId || undefined : undefined,
        recebeRemuneracaoSnComissao: form.recebeRemuneracaoSegurosNovos ? form.recebeRemuneracaoSnComissao : false,
        recebeRemuneracaoSnTaxa: form.recebeRemuneracaoSegurosNovos ? form.recebeRemuneracaoSnTaxa : false,
        ativo: form.ativo,
        tipoUsuarioId:      form.tipoUsuarioId      || undefined,
        horarioLoginInicio: form.horarioLoginInicio || undefined,
        horarioLoginFim:    form.horarioLoginFim    || undefined,
        diasPermitidos:     form.diasPermitidos.length > 0 ? form.diasPermitidos : undefined,
        exigir2FA:          form.exigir2FA,
        configRamos:        form.configRamos.length > 0 ? form.configRamos : undefined,
      };

      if (criando) {
        setUsuarios([...usuarios, { id: generateId(), ...dados }]);
      } else if (editando) {
        setUsuarios(usuarios.map(u => u.id === editando.id ? { ...editando, ...dados } : u));
      }
      setCriando(false);
      setEditando(null);
    } catch (err) {
      alert('Erro ao salvar usuário: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setSalvando(false);
    }
  }

  function toggleAtivo(id: string) {
    if (id === me?.id) { alert('Você não pode desativar sua própria conta.'); return; }
    setConfirmToggle(id);
  }

  function confirmarToggle() {
    if (!confirmToggle) return;
    setUsuarios(usuarios.map(u => u.id === confirmToggle ? { ...u, ativo: !u.ativo } : u));
    setConfirmToggle(null);
  }

  function nomeRen(id?: string) {
    return metas.planosRenovacao.find(p => p.id === id)?.nome ?? '—';
  }
  function nomeSn(id?: string) {
    return metas.planosSeguroNovo.find(p => p.id === id)?.nome ?? '—';
  }

  const modalAberto = editando !== null || criando;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Usuários</h1>
        <button onClick={abrirCriacao} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
          <Plus size={14} /> Novo Usuário
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nome','Email','Perfil','Renovações','Seg. Novos','Remuneração / Plano','Status','Ações'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map(u => (
              <tr key={u.id} className={`hover:bg-gray-50 ${!u.ativo ? 'opacity-60' : ''}`}>
                <td className="px-4 py-2.5">
                  <div className="font-medium text-gray-800">{u.nome}</div>
                  {u.id === me?.id && <div className="text-xs text-blue-500">Você</div>}
                </td>
                <td className="px-4 py-2.5 text-gray-600">{u.email}</td>
                <td className="px-4 py-2.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span>
                  {u.tipoUsuarioId && (() => { const t = tiposUsuario.find(t => t.id === u.tipoUsuarioId); return t ? <div className="text-xs text-gray-400 mt-0.5">{t.nome}</div> : null; })()}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {u.acessoRenovacoes ? <Check size={14} className="text-green-600 mx-auto" /> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {u.acessoSegurosNovos ? <Check size={14} className="text-green-600 mx-auto" /> : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-gray-500 space-y-0.5">
                  {u.recebeRemuneracaoRenovacoes && (
                    <div className="flex items-center gap-1">
                      <span className="text-blue-600 font-medium">Ren.</span>
                      <span className="text-gray-400">— {nomeRen(u.planoMetaRenovacaoId)}</span>
                    </div>
                  )}
                  {u.recebeRemuneracaoSegurosNovos && (
                    <div className="flex items-center gap-1">
                      <span className="text-indigo-600 font-medium">Seg.</span>
                      <span className="text-gray-400">— {nomeSn(u.planoMetaSeguroNovoId)}</span>
                    </div>
                  )}
                  {!u.recebeRemuneracaoRenovacoes && !u.recebeRemuneracaoSegurosNovos && <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => toggleAtivo(u.id)} className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.ativo ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <button onClick={() => abrirEdicao(u)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <Edit2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal */}
      {modalAberto && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">{criando ? 'Novo Usuário' : 'Editar Usuário'}</h2>
              <button onClick={() => { setEditando(null); setCriando(false); }} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              {/* Copiar configurações de outro usuário — apenas na criação */}
              {criando && usuarios.filter(u => u.ativo).length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                    <Copy size={12} /> Copiar configurações de
                  </p>
                  <select
                    value={copiarDeId}
                    onChange={e => aplicarCopiaDeUsuario(e.target.value)}
                    className="w-full px-3 py-1.5 border border-amber-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">— Não copiar —</option>
                    {[...usuarios].filter(u => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome)).map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                  {copiarDeId && (
                    <p className="text-xs text-amber-600">
                      Permissões, acessos e configurações de remuneração copiados. Nome, e-mail e senha precisam ser preenchidos.
                    </p>
                  )}
                </div>
              )}

              {/* Seletor de tipo — apenas na criação ou como atalho na edição */}
              {tiposUsuario.filter(t => t.ativo).length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Tipo de usuário</p>
                  <div className="flex gap-2">
                    <select
                      value={form.tipoUsuarioId}
                      onChange={e => {
                        const id = e.target.value;
                        const tipo = tiposUsuario.find(t => t.id === id);
                        if (!tipo) {
                          setForm(f => ({ ...f, tipoUsuarioId: '' }));
                          return;
                        }
                        setForm(f => ({
                          ...f,
                          tipoUsuarioId: id,
                          role: tipo.role,
                          acessoRenovacoes: tipo.acessoRenovacoes,
                          acessoSegurosNovos: tipo.acessoSegurosNovos,
                          acessoProspeccao: tipo.acessoProspeccao ?? true,
                          acessoConsultaRenovacoes: tipo.acessoConsultaRenovacoes ?? false,
                          podeDescartarProspeccao: tipo.podeDescartarProspeccao ?? false,
                          visualizarDashboard: tipo.visualizarDashboard ?? true,
                          visualizarProducao: tipo.visualizarProducao ?? false,
                          visualizarMetas: tipo.visualizarMetas,
                          visualizarComissoes: tipo.visualizarComissoes,
                          camposRestritos: tipo.camposRestritos,
                        }));
                      }}
                      className="flex-1 px-3 py-1.5 border border-blue-300 bg-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Sem tipo definido —</option>
                      {tiposUsuario.filter(t => t.ativo).map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </select>
                  </div>
                  <p className="text-xs text-blue-500">Selecionar um tipo aplica as permissões automaticamente. Você pode ajustar individualmente depois.</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                <input value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha {criando ? <span className="text-red-500">*</span> : <span className="text-gray-400 font-normal">(deixe em branco para manter)</span>}</label>
                <input type="password" value={form.senha} onChange={e => setForm(f => ({...f, senha: e.target.value}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Perfil</label>
                <select value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value as Role}))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="usuario">Usuário</option>
                  <option value="gestor">Gestor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Permissões de Acesso</div>
                <Ck v={form.acessoRenovacoes} label="Acesso a Renovações" onChange={v => setForm(f => ({...f, acessoRenovacoes: v}))} />
                <Ck v={form.acessoSegurosNovos} label="Acesso a Seguros Novos" onChange={v => setForm(f => ({...f, acessoSegurosNovos: v}))} />
                <Ck v={form.acessoProspeccao} label="Acesso a Prospecção" onChange={v => setForm(f => ({...f, acessoProspeccao: v}))} />
                <Ck v={form.acessoConsultaRenovacoes} label="Consulta de Renovações" onChange={v => setForm(f => ({...f, acessoConsultaRenovacoes: v}))} />
                <Ck v={form.podeDescartarProspeccao} label="Pode descartar prospecções" onChange={v => setForm(f => ({...f, podeDescartarProspeccao: v}))} />
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Páginas do Dashboard</div>
                <Ck v={form.visualizarDashboard}  label="Dashboard Principal"       onChange={v => setForm(f => ({...f, visualizarDashboard: v}))} />
                <Ck v={form.visualizarProducao}   label="Produção (Administrativo)" onChange={v => setForm(f => ({...f, visualizarProducao: v}))} />
                <Ck v={form.visualizarMetas}      label="Metas"                     onChange={v => setForm(f => ({...f, visualizarMetas: v}))} />
                <Ck v={form.visualizarComissoes}  label="Comissões a Pagar"         onChange={v => setForm(f => ({...f, visualizarComissoes: v}))} />
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Remuneração</div>

                {/* Renovações */}
                <div className="space-y-2">
                  <Ck v={form.recebeRemuneracaoRenovacoes} label="Recebe Remuneração por Renovações"
                    onChange={v => setForm(f => ({...f, recebeRemuneracaoRenovacoes: v}))} />
                  {form.recebeRemuneracaoRenovacoes && (
                    <div className="ml-6 space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Categorias incluídas</p>
                        <Ck v={form.recebeRemuneracaoTaxaRenovacoes} label="Taxa de Conversão de Renovações"
                          onChange={v => setForm(f => ({...f, recebeRemuneracaoTaxaRenovacoes: v}))} />
                        <Ck v={form.recebeRemuneracaoAumentoComissao} label="Aumento de Comissão"
                          onChange={v => setForm(f => ({...f, recebeRemuneracaoAumentoComissao: v}))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Plano de Metas</label>
                        {metas.planosRenovacao.length === 0 ? (
                          <p className="text-xs text-amber-600">Nenhum plano cadastrado. Crie um em Configurações → Metas.</p>
                        ) : (
                          <select value={form.planoMetaRenovacaoId}
                            onChange={e => setForm(f => ({...f, planoMetaRenovacaoId: e.target.value}))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">— Selecione um plano —</option>
                            {metas.planosRenovacao.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Seguros Novos */}
                <div className="space-y-2">
                  <Ck v={form.recebeRemuneracaoSegurosNovos} label="Recebe Remuneração por Seguros Novos"
                    onChange={v => setForm(f => ({...f, recebeRemuneracaoSegurosNovos: v}))} />
                  {form.recebeRemuneracaoSegurosNovos && (
                    <div className="ml-6 space-y-3">
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Categorias incluídas</p>
                        <Ck v={form.recebeRemuneracaoSnComissao} label="Comissão Gerada"
                          onChange={v => setForm(f => ({...f, recebeRemuneracaoSnComissao: v}))} />
                        <Ck v={form.recebeRemuneracaoSnTaxa} label="Taxa de Conversão"
                          onChange={v => setForm(f => ({...f, recebeRemuneracaoSnTaxa: v}))} />
                      </div>
                      {(() => {
                        const ramosCfg = ramos.filter(r => r.remuneracaoIndividual && r.ativo);
                        return ramosCfg.length > 0 ? (
                          <div className="mt-3 border border-blue-100 rounded-lg p-3 bg-blue-50/50">
                            <p className="text-xs font-semibold text-blue-700 mb-2">Configuração de remuneração por ramo</p>
                            <div className="space-y-2">
                              {ramosCfg.map(r => {
                                const cfg = form.configRamos.find(c => c.ramoId === r.id);
                                const recebeInd = cfg ? cfg.recebeIndividual : r.remuneracaoIndividual;
                                const recebeMeta = cfg ? cfg.recebeMeta : (r.participaMetaProducao ?? false);
                                const update = (field: 'recebeIndividual' | 'recebeMeta', val: boolean) => {
                                  setForm(f => {
                                    const existing = f.configRamos.find(c => c.ramoId === r.id);
                                    const newCfg: ConfigRamoUsuario = existing
                                      ? { ...existing, [field]: val }
                                      : { ramoId: r.id, recebeIndividual: r.remuneracaoIndividual, recebeMeta: r.participaMetaProducao ?? false, [field]: val };
                                    return { ...f, configRamos: [...f.configRamos.filter(c => c.ramoId !== r.id), newCfg] };
                                  });
                                };
                                return (
                                  <div key={r.id} className="flex items-center gap-4 py-1.5 px-2 bg-white rounded border border-blue-100">
                                    <span className="text-xs font-medium text-gray-700 w-32 truncate">{r.nome}</span>
                                    <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                      <input type="checkbox" checked={recebeInd} onChange={e => update('recebeIndividual', e.target.checked)}
                                        className="w-3.5 h-3.5 text-blue-600 rounded" />
                                      Individual
                                    </label>
                                    {r.participaMetaProducao && (
                                      <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                                        <input type="checkbox" checked={recebeMeta} onChange={e => update('recebeMeta', e.target.checked)}
                                          className="w-3.5 h-3.5 text-blue-600 rounded" />
                                        Meta
                                      </label>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null;
                      })()}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Plano de Metas</label>
                        {metas.planosSeguroNovo.length === 0 ? (
                          <p className="text-xs text-amber-600">Nenhum plano cadastrado. Crie um em Configurações → Metas.</p>
                        ) : (
                          <select value={form.planoMetaSeguroNovoId}
                            onChange={e => setForm(f => ({...f, planoMetaSeguroNovoId: e.target.value}))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">— Selecione um plano —</option>
                            {metas.planosSeguroNovo.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Segurança de acesso */}
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Segurança de Acesso</p>

                {/* Horário de login */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Horário permitido para login</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Das</label>
                      <input
                        type="time"
                        value={form.horarioLoginInicio}
                        onChange={e => setForm(f => ({ ...f, horarioLoginInicio: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-500 mb-1">Até</label>
                      <input
                        type="time"
                        value={form.horarioLoginFim}
                        onChange={e => setForm(f => ({ ...f, horarioLoginFim: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {(form.horarioLoginInicio || form.horarioLoginFim) && (
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, horarioLoginInicio: '', horarioLoginFim: '' }))}
                        className="mt-5 text-xs text-gray-400 hover:text-red-500 transition-colors"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {form.horarioLoginInicio && form.horarioLoginFim
                      ? `Acesso permitido das ${form.horarioLoginInicio.replace(':', 'h')} às ${form.horarioLoginFim.replace(':', 'h')}`
                      : 'Sem restrição de horário'}
                  </p>
                </div>

                {/* Dias da semana */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Dias permitidos para login</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {([
                      { label: 'Dom', value: 0 },
                      { label: 'Seg', value: 1 },
                      { label: 'Ter', value: 2 },
                      { label: 'Qua', value: 3 },
                      { label: 'Qui', value: 4 },
                      { label: 'Sex', value: 5 },
                      { label: 'Sáb', value: 6 },
                    ] as const).map(({ label, value }) => {
                      const selecionado = form.diasPermitidos.includes(value);
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setForm(f => ({
                              ...f,
                              diasPermitidos: selecionado
                                ? f.diasPermitidos.filter(d => d !== value)
                                : [...f.diasPermitidos, value].sort((a, b) => a - b),
                            }));
                          }}
                          className={`w-11 h-9 rounded-lg text-sm font-medium transition-colors border ${
                            selecionado
                              ? 'bg-blue-700 text-white border-blue-700'
                              : 'bg-white text-gray-500 border-gray-300 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {form.diasPermitidos.length === 0
                      ? 'Sem restrição de dia'
                      : `Acesso permitido: ${form.diasPermitidos.map(d => ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d]).join(', ')}`}
                  </p>
                </div>

                {/* 2FA */}
                <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="pt-0.5">
                    <Ck
                      v={form.exigir2FA}
                      label=""
                      onChange={v => setForm(f => ({ ...f, exigir2FA: v }))}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Verificação em duas etapas (2FA)</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ao fazer login, um código de 6 dígitos será enviado ao e-mail do usuário para confirmação.
                      Requer configuração do EmailJS.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <Ck v={form.ativo} label="Usuário ativo" onChange={v => setForm(f => ({...f, ativo: v}))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => { setEditando(null); setCriando(false); }} disabled={salvando} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
              <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-60">
                <Save size={14} /> {salvando ? 'Salvando...' : criando ? 'Criar' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmToggle}
        title="Alterar status do usuário"
        message={`Deseja ${usuarios.find(u => u.id === confirmToggle)?.ativo ? 'desativar' : 'ativar'} este usuário?`}
        onConfirm={confirmarToggle}
        onCancel={() => setConfirmToggle(null)}
        confirmLabel="Confirmar"
        danger={false}
      />
    </div>
  );
}
