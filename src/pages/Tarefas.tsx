import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, Calendar, Clock, ExternalLink, Filter, Plus, X, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Tarefa, TipoTarefa, Usuario } from '../types';
import { TIPO_LABELS, TipoIcon } from '../components/TarefasPanel';
import { generateId } from '../utils/formatters';

interface Props {
  tarefas: Tarefa[];
  setTarefas: (t: Tarefa[]) => void;
  usuarios: Usuario[];
}

const TIPO_CORES: Record<string, string> = {
  ligacao: 'bg-green-100 text-green-700',
  email:   'bg-blue-100 text-blue-700',
  reuniao: 'bg-purple-100 text-purple-700',
  visita:  'bg-orange-100 text-orange-700',
  outro:   'bg-gray-100 text-gray-600',
};

const ORIGEM_LABELS: Record<string, string> = {
  seguro_novo: 'Seguro Novo',
  renovacao:   'Renovação',
  prospeccao:  'Prospecção',
  geral:       'Geral',
};

const ORIGEM_CORES: Record<string, string> = {
  seguro_novo: 'bg-blue-50 text-blue-600 border-blue-200',
  renovacao:   'bg-amber-50 text-amber-700 border-amber-200',
  prospeccao:  'bg-teal-50 text-teal-700 border-teal-200',
  geral:       'bg-gray-100 text-gray-600 border-gray-200',
};

const ORIGEM_PATHS: Record<string, string> = {
  seguro_novo: '/seguros-novos',
  renovacao:   '/renovacoes',
  prospeccao:  '/prospeccao',
};

const formVazio = (responsavelId: string) => ({
  tipo: 'ligacao' as TipoTarefa,
  descricao: '',
  dataAgendada: new Date().toISOString().split('T')[0],
  horaAgendada: '',
  nomeCliente: '',
  responsavelId,
});

function formatData(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function labelDia(dateStr: string): string {
  const hoje = new Date().toISOString().split('T')[0];
  const amanha = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  if (dateStr < hoje) return 'Atrasadas';
  if (dateStr === hoje) return 'Hoje';
  if (dateStr === amanha) return 'Amanhã';
  return formatData(dateStr);
}

function grupoCor(dateStr: string): { header: string; card: string } {
  const hoje = new Date().toISOString().split('T')[0];
  if (dateStr < hoje) return { header: 'text-red-700 bg-red-50 border-red-200',   card: 'border-red-100 bg-red-50/30' };
  if (dateStr === hoje) return { header: 'text-blue-700 bg-blue-50 border-blue-200', card: 'border-blue-100 bg-white' };
  return { header: 'text-gray-600 bg-gray-50 border-gray-200', card: 'border-gray-100 bg-white' };
}

export function Tarefas({ tarefas, setTarefas, usuarios }: Props) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const isAdmin  = usuario?.role === 'admin';
  const isGestor = usuario?.role === 'gestor';

  const [filtroResp, setFiltroResp] = useState(
    usuario?.role === 'usuario' ? usuario.id : ''
  );
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState(formVazio(usuario?.id ?? ''));

  const usuariosVisiveis = useMemo(() =>
    usuarios.filter(u => u.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [usuarios]);

  // Filtra tarefas
  const tarefasFiltradas = useMemo(() => {
    return tarefas.filter(t => {
      if (!mostrarConcluidas && t.status === 'concluida') return false;
      if (filtroResp && t.responsavelId !== filtroResp) return false;
      if (usuario?.role === 'usuario' && t.responsavelId !== usuario.id) return false;
      return true;
    });
  }, [tarefas, filtroResp, mostrarConcluidas, usuario]);

  // Agrupa por data
  const grupos = useMemo(() => {
    const map = new Map<string, Tarefa[]>();
    for (const t of tarefasFiltradas) {
      const k = t.status === 'pendente' ? t.dataAgendada : '__concluidas__';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
    const entries = [...map.entries()].sort(([a], [b]) => {
      if (a === '__concluidas__') return 1;
      if (b === '__concluidas__') return -1;
      return a.localeCompare(b);
    });
    return entries.map(([data, items]) => ({
      data,
      items: items.sort((a, b) => {
        const ha = a.horaAgendada ?? '99:99';
        const hb = b.horaAgendada ?? '99:99';
        return ha.localeCompare(hb);
      }),
    }));
  }, [tarefasFiltradas]);

  const totalPendentes = tarefas.filter(t =>
    t.status === 'pendente' &&
    (usuario?.role !== 'usuario' || t.responsavelId === usuario.id)
  ).length;

  function concluir(id: string) {
    setTarefas(tarefas.map(t =>
      t.id === id ? { ...t, status: 'concluida', atualizadoEm: new Date().toISOString() } : t
    ));
  }

  function reabrir(id: string) {
    setTarefas(tarefas.map(t =>
      t.id === id ? { ...t, status: 'pendente', atualizadoEm: new Date().toISOString() } : t
    ));
  }

  function excluir(id: string) {
    setTarefas(tarefas.filter(t => t.id !== id));
  }

  function abrirNegocio(t: Tarefa) {
    if (!t.origemId || t.origemTipo === 'geral') return;
    navigate(ORIGEM_PATHS[t.origemTipo], { state: { openId: t.origemId } });
  }

  function salvarNova() {
    if (!form.descricao.trim() || !form.dataAgendada) return;
    const nova: Tarefa = {
      id: generateId(),
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      dataAgendada: form.dataAgendada,
      horaAgendada: form.horaAgendada || undefined,
      responsavelId: form.responsavelId,
      origemTipo: 'geral',
      origemId: undefined,
      nomeCliente: form.nomeCliente.trim() || undefined,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    setTarefas([...tarefas, nova]);
    setCriando(false);
    setForm(formVazio(usuario?.id ?? ''));
  }

  return (
    <div className="space-y-4">

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tarefas</h1>
          {totalPendentes > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {totalPendentes} tarefa{totalPendentes !== 1 ? 's' : ''} pendente{totalPendentes !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={() => { setCriando(true); setForm(formVazio(usuario?.id ?? '')); }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800"
        >
          <Plus size={14} /> Nova Tarefa
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <Filter size={14} className="text-gray-400 shrink-0" />
        {(isAdmin || isGestor) && (
          <select
            value={filtroResp}
            onChange={e => setFiltroResp(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os responsáveis</option>
            {usuariosVisiveis.map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={mostrarConcluidas}
            onChange={e => setMostrarConcluidas(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Mostrar concluídas
        </label>
        <span className="ml-auto text-sm text-gray-400">{tarefasFiltradas.length} tarefa(s)</span>
      </div>

      {/* Grupos por dia */}
      {grupos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-12 text-center">
          <CheckCircle2 size={36} className="text-green-400 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Nenhuma tarefa pendente!</p>
          <p className="text-sm text-gray-400 mt-1">
            Use o botão <strong>Nova Tarefa</strong> ou agende dentro de cada negócio.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {grupos.map(({ data, items }) => {
            const label = data === '__concluidas__' ? 'Concluídas' : labelDia(data);
            const cores = data === '__concluidas__'
              ? { header: 'text-gray-400 bg-gray-50 border-gray-200', card: 'border-gray-100 bg-gray-50/50' }
              : grupoCor(data);

            return (
              <div key={data}>
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border mb-2 w-fit ${cores.header}`}>
                  <Calendar size={13} />
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-xs opacity-70">({items.length})</span>
                </div>

                <div className="space-y-2">
                  {items.map(t => (
                    <div
                      key={t.id}
                      className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cores.card} transition-opacity ${
                        t.status === 'concluida' ? 'opacity-60' : ''
                      }`}
                    >
                      {/* Concluir / reabrir */}
                      <button
                        onClick={() => t.status === 'pendente' ? concluir(t.id) : reabrir(t.id)}
                        title={t.status === 'pendente' ? 'Marcar como concluída' : 'Reabrir tarefa'}
                        className={`mt-0.5 shrink-0 transition-colors ${
                          t.status === 'concluida'
                            ? 'text-green-500 hover:text-gray-400'
                            : 'text-gray-300 hover:text-green-500'
                        }`}
                      >
                        {t.status === 'concluida' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </button>

                      {/* Conteúdo */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${TIPO_CORES[t.tipo]}`}>
                            <TipoIcon tipo={t.tipo} size={11} />
                            {TIPO_LABELS[t.tipo]}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${ORIGEM_CORES[t.origemTipo]}`}>
                            {ORIGEM_LABELS[t.origemTipo]}
                          </span>
                          {t.horaAgendada && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Clock size={11} /> {t.horaAgendada}
                            </span>
                          )}
                        </div>

                        <p className={`text-sm font-medium text-gray-800 ${t.status === 'concluida' ? 'line-through text-gray-400' : ''}`}>
                          {t.descricao}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {t.nomeCliente && (
                            <span className="text-xs text-gray-500">{t.nomeCliente}</span>
                          )}
                          {(isAdmin || isGestor) && (
                            <span className="text-xs text-gray-400">
                              {t.nomeCliente ? '· ' : ''}{usuarios.find(u => u.id === t.responsavelId)?.nome ?? '—'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-1 shrink-0">
                        {t.origemTipo !== 'geral' && t.origemId && (
                          <button
                            onClick={() => abrirNegocio(t)}
                            title={`Abrir ${ORIGEM_LABELS[t.origemTipo]}`}
                            className="p-1.5 text-gray-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => excluir(t.id)}
                          title="Excluir tarefa"
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de nova tarefa avulsa */}
      {criando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="font-bold text-gray-900">Nova Tarefa</h2>
              <button onClick={() => setCriando(false)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Tipo + Data + Hora */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={form.tipo}
                    onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoTarefa }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {(Object.keys(TIPO_LABELS) as TipoTarefa[]).map(k => (
                      <option key={k} value={k}>{TIPO_LABELS[k]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.dataAgendada}
                    onChange={e => setForm(f => ({ ...f, dataAgendada: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hora (opcional)</label>
                  <input
                    type="time"
                    value={form.horaAgendada}
                    onChange={e => setForm(f => ({ ...f, horaAgendada: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {(isAdmin || isGestor) && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Responsável</label>
                    <select
                      value={form.responsavelId}
                      onChange={e => setForm(f => ({ ...f, responsavelId: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {usuariosVisiveis.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descrição <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') salvarNova(); }}
                  placeholder="Descreva a tarefa..."
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Cliente (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cliente / Referência <span className="text-xs text-gray-400 font-normal">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={form.nomeCliente}
                  onChange={e => setForm(f => ({ ...f, nomeCliente: e.target.value }))}
                  placeholder="Nome do cliente ou referência..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button
                onClick={() => setCriando(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarNova}
                disabled={!form.descricao.trim() || !form.dataAgendada}
                className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50"
              >
                <Save size={14} /> Agendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
