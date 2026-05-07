import { useState } from 'react';
import { Phone, Mail, Users, MapPin, CheckSquare, Plus, CheckCircle2, Circle, Calendar, X, ChevronDown } from 'lucide-react';
import type { Tarefa, TipoTarefa } from '../types';
import { generateId } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import { DateInput } from './DateInput';

interface Props {
  origemTipo: 'seguro_novo' | 'renovacao' | 'prospeccao';
  origemId: string | null; // null quando ainda não foi salvo (criando)
  nomeCliente: string;
  responsavelId: string;
  tarefas: Tarefa[];
  setTarefas: (t: Tarefa[]) => void;
}

export const TIPO_LABELS: Record<TipoTarefa, string> = {
  ligacao: 'Ligação',
  email: 'E-mail',
  reuniao: 'Reunião',
  visita: 'Visita',
  outro: 'Outro',
};

export function TipoIcon({ tipo, size = 13 }: { tipo: TipoTarefa; size?: number }) {
  const props = { size, className: 'shrink-0' };
  switch (tipo) {
    case 'ligacao':  return <Phone   {...props} />;
    case 'email':    return <Mail    {...props} />;
    case 'reuniao':  return <Users   {...props} />;
    case 'visita':   return <MapPin  {...props} />;
    default:         return <CheckSquare {...props} />;
  }
}

const TIPO_CORES: Record<TipoTarefa, string> = {
  ligacao: 'bg-green-100 text-green-700',
  email:   'bg-blue-100 text-blue-700',
  reuniao: 'bg-purple-100 text-purple-700',
  visita:  'bg-orange-100 text-orange-700',
  outro:   'bg-gray-100 text-gray-600',
};

function isAtrasada(dataAgendada: string): boolean {
  const hoje = new Date().toISOString().split('T')[0];
  return dataAgendada < hoje;
}

export function TarefasPanel({ origemTipo, origemId, nomeCliente, responsavelId, tarefas, setTarefas }: Props) {
  const { usuario: _usuario } = useAuth();
  const [adicionando, setAdicionando] = useState(false);
  const [concluidasAbertas, setConcluidasAbertas] = useState(true);
  const [form, setForm] = useState({
    tipo: 'ligacao' as TipoTarefa,
    descricao: '',
    dataAgendada: new Date().toISOString().split('T')[0],
    horaAgendada: '',
  });

  // Tarefas deste negócio
  const tarefasNegocio = origemId
    ? tarefas.filter(t => t.origemId === origemId).sort((a, b) => {
        // pendentes primeiro, depois por data
        if (a.status !== b.status) return a.status === 'pendente' ? -1 : 1;
        return a.dataAgendada.localeCompare(b.dataAgendada);
      })
    : [];

  const pendentes = tarefasNegocio.filter(t => t.status === 'pendente');
  const concluidas = tarefasNegocio.filter(t => t.status === 'concluida');

  function salvar() {
    if (!form.descricao.trim() || !form.dataAgendada || !origemId) return;
    const nova: Tarefa = {
      id: generateId(),
      tipo: form.tipo,
      descricao: form.descricao.trim(),
      dataAgendada: form.dataAgendada,
      horaAgendada: form.horaAgendada || undefined,
      responsavelId,
      origemTipo,
      origemId,
      nomeCliente,
      status: 'pendente',
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
    setTarefas([...tarefas, nova]);
    setForm({ tipo: 'ligacao', descricao: '', dataAgendada: new Date().toISOString().split('T')[0], horaAgendada: '' });
    setAdicionando(false);
  }

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

  function formatDataHora(t: Tarefa) {
    const [y, m, d] = t.dataAgendada.split('-');
    const data = `${d}/${m}/${y}`;
    return t.horaAgendada ? `${data} às ${t.horaAgendada}` : data;
  }

  function formatConclusao(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="space-y-3">
      {/* Aviso se negócio ainda não salvo */}
      {!origemId && (
        <p className="text-xs text-gray-400 italic">
          Salve o negócio primeiro para poder adicionar tarefas.
        </p>
      )}

      {/* Lista de tarefas pendentes */}
      {pendentes.length > 0 && (
        <div className="space-y-2">
          {pendentes.map(t => (
            <div
              key={t.id}
              className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${
                isAtrasada(t.dataAgendada)
                  ? 'bg-red-50 border-red-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <button
                type="button"
                onClick={() => concluir(t.id)}
                title="Marcar como concluída"
                className="mt-0.5 text-gray-300 hover:text-green-500 transition-colors shrink-0"
              >
                <Circle size={16} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${TIPO_CORES[t.tipo]}`}>
                    <TipoIcon tipo={t.tipo} size={11} />
                    {TIPO_LABELS[t.tipo]}
                  </span>
                  <span className={`flex items-center gap-1 text-xs ${isAtrasada(t.dataAgendada) ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                    <Calendar size={11} />
                    {formatDataHora(t)}
                    {isAtrasada(t.dataAgendada) && ' · Atrasada'}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-0.5">{t.descricao}</p>
              </div>
              <button
                type="button"
                onClick={() => excluir(t.id)}
                title="Excluir tarefa"
                className="mt-0.5 text-gray-300 hover:text-red-400 transition-colors shrink-0"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Concluídas — histórico registrado */}
      {concluidas.length > 0 && (
        <div className="border border-green-200 rounded-lg overflow-hidden">
          {/* Cabeçalho colapsável */}
          <button
            type="button"
            onClick={() => setConcluidasAbertas(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 bg-green-50 hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-green-600 shrink-0" />
              <span className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                Concluídas ({concluidas.length})
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-green-500 transition-transform duration-200 ${concluidasAbertas ? 'rotate-180' : ''}`}
            />
          </button>

          {/* Lista */}
          {concluidasAbertas && (
            <div className="divide-y divide-green-100">
              {concluidas
                .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
                .map(t => (
                  <div key={t.id} className="flex items-start gap-2.5 px-3 py-2.5 bg-white">
                    <CheckCircle2 size={15} className="text-green-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${TIPO_CORES[t.tipo]}`}>
                          <TipoIcon tipo={t.tipo} size={11} />
                          {TIPO_LABELS[t.tipo]}
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar size={11} /> {formatDataHora(t)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 line-through">{t.descricao}</p>
                      <p className="text-xs text-green-600 mt-0.5">
                        ✓ Concluída em {formatConclusao(t.atualizadoEm)}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => reabrir(t.id)}
                        title="Reabrir tarefa"
                        className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        Reabrir
                      </button>
                      <button
                        type="button"
                        onClick={() => excluir(t.id)}
                        title="Excluir registro"
                        className="text-gray-200 hover:text-red-400 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Nenhuma tarefa */}
      {tarefasNegocio.length === 0 && origemId && (
        <p className="text-xs text-gray-400 italic">Nenhuma tarefa agendada para este negócio.</p>
      )}

      {/* Formulário de nova tarefa */}
      {adicionando && origemId ? (
        <div className="border border-blue-200 bg-blue-50/40 rounded-lg p-3 space-y-2.5">
          <div className="flex gap-2">
            <select
              value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoTarefa }))}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              {(Object.keys(TIPO_LABELS) as TipoTarefa[]).map(k => (
                <option key={k} value={k}>{TIPO_LABELS[k]}</option>
              ))}
            </select>
            <DateInput
              value={form.dataAgendada}
              onChange={e => setForm(f => ({ ...f, dataAgendada: e.target.value }))}
              className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            <input
              type="time"
              value={form.horaAgendada}
              onChange={e => setForm(f => ({ ...f, horaAgendada: e.target.value }))}
              placeholder="Hora (opcional)"
              className="w-28 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <input
            type="text"
            value={form.descricao}
            onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') salvar(); if (e.key === 'Escape') setAdicionando(false); }}
            placeholder="Descrição da tarefa..."
            autoFocus
            className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setAdicionando(false)}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={!form.descricao.trim()}
              className="px-3 py-1.5 text-sm bg-blue-700 text-white rounded-lg hover:bg-blue-800 disabled:opacity-50"
            >
              Agendar
            </button>
          </div>
        </div>
      ) : origemId ? (
        <button
          type="button"
          onClick={() => setAdicionando(true)}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <Plus size={14} /> Agendar tarefa
        </button>
      ) : null}
    </div>
  );
}
