import { useState } from 'react';
import { Plus, Edit2, Trash2, X, Save, Play, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import type { AutomacaoParcela, CondicaoAutomacao, CampoParcela, OperadorCondicao, StatusParcela } from '../types';
import { generateId } from '../utils/formatters';

const STATUS_LABELS: Record<StatusParcela, string> = {
  '': 'Não Tratada',
  nao_tratada: 'Não Tratada',
  em_tratamento: 'Em Tratamento',
  baixada: 'Parcela Baixada',
  cancelado: 'Seguro Cancelado',
  desconsiderado: 'Desconsiderado',
  aguardando_baixa: 'Aguardando Baixa',
  baixada_sistema: 'Baixada Sistema',
  analise_critica: 'Análise Crítica',
};

const TODOS_STATUS: StatusParcela[] = [
  '', 'nao_tratada', 'em_tratamento', 'baixada', 'cancelado',
  'desconsiderado', 'aguardando_baixa', 'baixada_sistema', 'analise_critica',
];

const CAMPO_LABELS: Record<CampoParcela, string> = {
  dias_apos_vencimento: 'Dias após vencimento',
  dias_sem_import: 'Dias sem aparecer no import',
  status: 'Status atual',
  seguradora: 'Seguradora',
  ramo: 'Ramo',
  forma_pagamento: 'Forma de pagamento',
  valor_parcela: 'Valor da parcela (R$)',
};

const CAMPOS_NUMERICOS: CampoParcela[] = ['dias_apos_vencimento', 'dias_sem_import', 'valor_parcela'];
const CAMPOS_STATUS: CampoParcela[] = ['status'];

function operadoresParaCampo(campo: CampoParcela): { value: OperadorCondicao; label: string }[] {
  if (CAMPOS_NUMERICOS.includes(campo)) {
    return [
      { value: 'maior_que', label: 'é maior que' },
      { value: 'maior_igual', label: 'é maior ou igual a' },
      { value: 'menor_que', label: 'é menor que' },
      { value: 'menor_igual', label: 'é menor ou igual a' },
      { value: 'igual', label: 'é igual a' },
      { value: 'diferente', label: 'é diferente de' },
    ];
  }
  return [
    { value: 'igual', label: 'é igual a' },
    { value: 'diferente', label: 'é diferente de' },
  ];
}

function ValorInput({ campo, valor, onChange }: { campo: CampoParcela; valor: string; onChange: (v: string) => void }) {
  if (CAMPOS_STATUS.includes(campo)) {
    return (
      <select value={valor} onChange={e => onChange(e.target.value)}
        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
        {TODOS_STATUS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
    );
  }
  if (CAMPOS_NUMERICOS.includes(campo)) {
    return (
      <input type="number" value={valor} onChange={e => onChange(e.target.value)} min="0"
        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder={campo === 'valor_parcela' ? '0.00' : '0'} />
    );
  }
  return (
    <input type="text" value={valor} onChange={e => onChange(e.target.value)}
      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      placeholder="Valor..." />
  );
}

interface Props {
  automacoes: AutomacaoParcela[];
  setAutomacoes: (a: AutomacaoParcela[]) => void;
  seguradoras: string[];
  ramos: string[];
}

const autoVazia = (): Omit<AutomacaoParcela, 'id' | 'criadoEm' | 'atualizadoEm'> => ({
  nome: '',
  ativo: true,
  tipo: 'personalizada',
  condicoes: [],
  operadorLogico: 'E',
  filtroSeguradora: '',
  filtroRamo: '',
  novoStatus: 'em_tratamento',
  prioridade: 0,
});

export function AutomacoesParcelasConfig({ automacoes, setAutomacoes, seguradoras, ramos }: Props) {
  const [modal, setModal] = useState<AutomacaoParcela | 'nova' | null>(null);
  const [form, setForm] = useState(autoVazia());
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [expandedSQL, setExpandedSQL] = useState(false);

  const padroesVenc     = automacoes.filter(a => a.tipo === 'padrao_vencimento');
  const padroesSemImp   = automacoes.filter(a => a.tipo === 'padrao_sem_import');
  const personalizadas  = automacoes.filter(a => a.tipo === 'personalizada');

  function abrirNova(tipo: AutomacaoParcela['tipo']) {
    setForm({ ...autoVazia(), tipo,
      diasAposVencimento:  tipo === 'padrao_vencimento' ? 5 : undefined,
      diasAntesSemImport:  tipo === 'padrao_sem_import' ? 30 : undefined,
    });
    setModal('nova');
  }

  function abrirEditar(a: AutomacaoParcela) {
    const { id: _id, criadoEm: _c, atualizadoEm: _u, ...rest } = a;
    setForm(rest);
    setModal(a);
  }

  function salvar() {
    if (!form.nome.trim()) { alert('Nome é obrigatório.'); return; }
    const now = new Date().toISOString();
    if (modal === 'nova') {
      setAutomacoes([...automacoes, { id: generateId(), ...form, nome: form.nome.trim(), criadoEm: now, atualizadoEm: now }]);
    } else if (modal) {
      setAutomacoes(automacoes.map(a => a.id === (modal as AutomacaoParcela).id
        ? { ...(modal as AutomacaoParcela), ...form, nome: form.nome.trim(), atualizadoEm: now }
        : a
      ));
    }
    setModal(null);
  }

  function excluir(id: string) {
    setAutomacoes(automacoes.filter(a => a.id !== id));
    setConfirmDel(null);
  }

  function addCondicao() {
    const nova: CondicaoAutomacao = { id: generateId(), campo: 'dias_apos_vencimento', operador: 'maior_que', valor: '5' };
    setForm(f => ({ ...f, condicoes: [...f.condicoes, nova] }));
  }

  function updateCondicao(id: string, patch: Partial<CondicaoAutomacao>) {
    setForm(f => ({ ...f, condicoes: f.condicoes.map(c => c.id === id ? { ...c, ...patch } : c) }));
  }

  function removeCondicao(id: string) {
    setForm(f => ({ ...f, condicoes: f.condicoes.filter(c => c.id !== id) }));
  }

  function toggleAtivo(id: string) {
    setAutomacoes(automacoes.map(a => a.id === id ? { ...a, ativo: !a.ativo, atualizadoEm: new Date().toISOString() } : a));
  }

  function resumoCondicoes(a: AutomacaoParcela): string {
    if (a.tipo === 'padrao_vencimento') return `Após ${a.diasAposVencimento ?? 0} dias do vencimento`;
    if (a.tipo === 'padrao_sem_import') return `Ausente no import há ${a.diasAntesSemImport ?? 0} dias`;
    if (!a.condicoes.length) return '(sem condições)';
    return a.condicoes.map(c => `${CAMPO_LABELS[c.campo]} ${c.operador.replace(/_/g,' ')} ${c.valor}`).join(` ${a.operadorLogico} `);
  }

  const CardRegra = ({ a }: { a: AutomacaoParcela }) => (
    <div className={`border rounded-lg p-3 transition-opacity ${a.ativo ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-800 text-sm">{a.nome}</span>
            {(a.filtroSeguradora || a.filtroRamo) && (
              <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                {[a.filtroSeguradora, a.filtroRamo].filter(Boolean).join(' · ')}
              </span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${a.ativo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {a.ativo ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1 font-mono">{resumoCondicoes(a)}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            → <span className="font-medium text-gray-600">{STATUS_LABELS[a.novoStatus]}</span>
            {a.prioridade > 0 && <span className="ml-2">Prioridade: {a.prioridade}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => toggleAtivo(a.id)} title={a.ativo ? 'Desativar' : 'Ativar'}
            className={`p-1 rounded text-xs ${a.ativo ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}>
            <Play size={13} />
          </button>
          <button onClick={() => abrirEditar(a)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
            <Edit2 size={13} />
          </button>
          <button onClick={() => setConfirmDel(a.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* SQL hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <button className="flex items-center justify-between w-full text-left"
          onClick={() => setExpandedSQL(v => !v)}>
          <span className="text-sm font-semibold text-amber-800">Pré-requisito: criar tabela no Supabase</span>
          {expandedSQL ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-amber-600" />}
        </button>
        {expandedSQL && (
          <div className="mt-3">
            <p className="text-xs text-amber-700 mb-2">Acesse <strong>Supabase → SQL Editor</strong> e execute o comando abaixo para criar a tabela de automações:</p>
            <pre className="bg-white border border-amber-200 rounded p-3 text-xs text-gray-700 overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS automacoes_parcelas (
  id text PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  tipo text NOT NULL,
  dias_apos_vencimento integer,
  dias_antes_sem_import integer,
  condicoes jsonb DEFAULT '[]',
  operador_logico text DEFAULT 'E',
  filtro_seguradora text DEFAULT '',
  filtro_ramo text DEFAULT '',
  novo_status text NOT NULL,
  prioridade integer DEFAULT 0,
  criado_em text,
  atualizado_em text
);
ALTER TABLE automacoes_parcelas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all" ON automacoes_parcelas FOR ALL USING (true) WITH CHECK (true);`}</pre>
          </div>
        )}
      </div>

      {/* Section: After due date */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Após X dias do vencimento</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Muda o status automaticamente quando a parcela atingir X dias vencida.</p>
          </div>
          <button onClick={() => abrirNova('padrao_vencimento')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 shrink-0">
            <Plus size={13} /> Nova
          </button>
        </div>
        {padroesVenc.length === 0
          ? <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">Nenhuma regra configurada.</p>
          : <div className="space-y-2">{padroesVenc.map(a => <CardRegra key={a.id} a={a} />)}</div>
        }
      </div>

      {/* Section: Missing from import */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-orange-500" />
              <h2 className="font-semibold text-gray-900 text-sm">Ausente no import com vencimento passado</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Quando uma parcela não aparece no novo import e já venceu há X ou mais dias.</p>
          </div>
          <button onClick={() => abrirNova('padrao_sem_import')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 shrink-0">
            <Plus size={13} /> Nova
          </button>
        </div>
        {padroesSemImp.length === 0
          ? <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">Nenhuma regra configurada.</p>
          : <div className="space-y-2">{padroesSemImp.map(a => <CardRegra key={a.id} a={a} />)}</div>
        }
      </div>

      {/* Section: Custom rules */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900 text-sm">Regras Personalizadas</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Crie condições combinadas (SE campo operador valor ENTÃO mudar status).</p>
          </div>
          <button onClick={() => abrirNova('personalizada')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 shrink-0">
            <Plus size={13} /> Nova Regra
          </button>
        </div>
        {personalizadas.length === 0
          ? <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">Nenhuma regra personalizada criada ainda.</p>
          : <div className="space-y-2">{personalizadas.map(a => <CardRegra key={a.id} a={a} />)}</div>
        }
      </div>

      {/* Modal create/edit */}
      {modal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="font-bold text-gray-900">
                {modal === 'nova' ? 'Nova Automação' : 'Editar Automação'}
              </h2>
              <button onClick={() => setModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="Ex.: Parcela vencida há 30 dias → Em Tratamento"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Standard: after due date */}
              {form.tipo === 'padrao_vencimento' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-amber-700 mb-3">Condição padrão</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-700">Após</span>
                    <input type="number" min="1" value={form.diasAposVencimento ?? 5}
                      onChange={e => setForm(f => ({ ...f, diasAposVencimento: Number(e.target.value) }))}
                      className="w-20 px-2 py-1.5 border border-amber-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">dias do vencimento da parcela</span>
                  </div>
                </div>
              )}

              {/* Standard: missing from import */}
              {form.tipo === 'padrao_sem_import' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-xs font-semibold text-orange-700 mb-3">Condição padrão</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-700">Parcela ausente no import e vencimento há</span>
                    <input type="number" min="1" value={form.diasAntesSemImport ?? 30}
                      onChange={e => setForm(f => ({ ...f, diasAntesSemImport: Number(e.target.value) }))}
                      className="w-20 px-2 py-1.5 border border-orange-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">ou mais dias</span>
                  </div>
                </div>
              )}

              {/* Custom: conditions builder */}
              {form.tipo === 'personalizada' && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Condições (SE...)</span>
                    {form.condicoes.length > 1 && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => setForm(f => ({ ...f, operadorLogico: 'E' }))}
                          className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${form.operadorLogico === 'E' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>E</button>
                        <button onClick={() => setForm(f => ({ ...f, operadorLogico: 'OU' }))}
                          className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${form.operadorLogico === 'OU' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>OU</button>
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-2">
                    {form.condicoes.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-2">Nenhuma condição adicionada ainda.</p>
                    )}
                    {form.condicoes.map((cond, idx) => (
                      <div key={cond.id} className="flex items-center gap-2 flex-wrap bg-gray-50 rounded-lg px-3 py-2">
                        {idx > 0 && (
                          <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                            {form.operadorLogico}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 shrink-0">SE</span>
                        <select value={cond.campo}
                          onChange={e => {
                            const campo = e.target.value as CampoParcela;
                            const ops = operadoresParaCampo(campo);
                            const operador = ops[0].value;
                            const valor = campo === 'status' ? '' : campo === 'valor_parcela' ? '0' : '5';
                            updateCondicao(cond.id, { campo, operador, valor });
                          }}
                          className="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {(Object.entries(CAMPO_LABELS) as [CampoParcela, string][]).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <select value={cond.operador}
                          onChange={e => updateCondicao(cond.id, { operador: e.target.value as OperadorCondicao })}
                          className="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                          {operadoresParaCampo(cond.campo).map(op => (
                            <option key={op.value} value={op.value}>{op.label}</option>
                          ))}
                        </select>
                        <ValorInput campo={cond.campo} valor={cond.valor} onChange={v => updateCondicao(cond.id, { valor: v })} />
                        <button onClick={() => removeCondicao(cond.id)} className="p-1 text-gray-400 hover:text-red-600 rounded shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    <button onClick={addCondicao}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 mt-1">
                      <Plus size={12} /> Adicionar condição
                    </button>
                  </div>
                </div>
              )}

              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ENTÃO mudar status para</label>
                <select value={form.novoStatus} onChange={e => setForm(f => ({ ...f, novoStatus: e.target.value as StatusParcela }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {TODOS_STATUS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
              </div>

              {/* Scope filters */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Filtro Seguradora (opcional)</label>
                  <select value={form.filtroSeguradora} onChange={e => setForm(f => ({ ...f, filtroSeguradora: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Qualquer —</option>
                    {seguradoras.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Filtro Ramo (opcional)</label>
                  <select value={form.filtroRamo} onChange={e => setForm(f => ({ ...f, filtroRamo: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">— Qualquer —</option>
                    {ramos.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Priority + Active */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Prioridade (0 = mais alta)</label>
                  <input type="number" min="0" value={form.prioridade}
                    onChange={e => setForm(f => ({ ...f, prioridade: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="ativo-auto" checked={form.ativo}
                    onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <label htmlFor="ativo-auto" className="text-sm text-gray-700">Ativa</label>
                </div>
              </div>

              {/* Preview */}
              {(form.tipo !== 'personalizada' || form.condicoes.length > 0) && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
                  <p className="font-semibold mb-1">Resumo da regra:</p>
                  <p>
                    {form.tipo === 'padrao_vencimento' && `Após ${form.diasAposVencimento ?? 0} dias do vencimento`}
                    {form.tipo === 'padrao_sem_import' && `Parcela ausente no import com vencimento há ${form.diasAntesSemImport ?? 0}+ dias`}
                    {form.tipo === 'personalizada' && form.condicoes.map((c, i) => (
                      <span key={c.id}>{i > 0 && <strong> {form.operadorLogico} </strong>}
                        {CAMPO_LABELS[c.campo]} {c.operador.replace(/_/g,' ')} <strong>{c.valor || '—'}</strong>
                      </span>
                    ))}
                    {form.filtroSeguradora && <span> · Seguradora: <strong>{form.filtroSeguradora}</strong></span>}
                    {form.filtroRamo && <span> · Ramo: <strong>{form.filtroRamo}</strong></span>}
                    {' → '}<strong>{STATUS_LABELS[form.novoStatus]}</strong>
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => setModal(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={salvar} className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
                <Save size={14} /> Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <p className="text-gray-800 font-medium mb-4">Excluir esta automação?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDel(null)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={() => excluir(confirmDel)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
