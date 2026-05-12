import { useState, useMemo } from 'react';
import { Plus, Edit2, Trash2, X, Save, Play, Zap } from 'lucide-react';
import type { AutomacaoParcela, CondicaoAutomacao, CampoParcela, OperadorCondicao, StatusParcela } from '../types';
import { generateId } from '../utils/formatters';

const STATUS_LABELS: Record<StatusParcela, string> = {
  importada:        'Importada',
  tratar:           'Tratar',
  em_tratativa:     'Em Tratativa',
  paga:          'Paga',
  desconsiderada:   'Desconsiderada',
  seguro_cancelado:     'Seguro Cancelado',
  aguardando_baixa: 'Aguardando Baixa',
  baixada_sistema:  'Baixa Automática',
  analise_critica:  'Análise Crítica',
};

const TODOS_STATUS: StatusParcela[] = [
  'importada', 'tratar', 'em_tratativa', 'paga',
  'desconsiderada', 'seguro_cancelado', 'aguardando_baixa', 'baixada_sistema', 'analise_critica',
];

const CAMPO_LABELS: Record<CampoParcela, string> = {
  dias_apos_vencimento: 'Dias após vencimento',
  dias_sem_import: 'Dias sem aparecer no import',
  status: 'Status atual',
  seguradora: 'Seguradora',
  ramo: 'Ramo',
  forma_pagamento: 'Forma de pagamento',
  valor_parcela: 'Valor da parcela (R$)',
  prorrogada: 'Parcela desconsiderada na prorrogação',
  data_prorrogacao: 'Data de prorrogação',
};

const CAMPOS_NUMERICOS: CampoParcela[] = ['dias_apos_vencimento', 'dias_sem_import', 'valor_parcela'];
const CAMPOS_STATUS: CampoParcela[] = ['status'];
const CAMPOS_TEXTO: CampoParcela[] = ['seguradora', 'ramo', 'forma_pagamento'];
const CAMPOS_BOOLEANOS: CampoParcela[] = ['prorrogada'];
const CAMPOS_DATA: CampoParcela[] = ['data_prorrogacao'];

const OPCOES_DATA_ACAO = [
  { value: '', label: 'Não alterar' },
  { value: 'hoje', label: 'Data de hoje' },
  { value: 'vencimento', label: 'Data de vencimento da parcela' },
  { value: 'relativo', label: 'X dias após...' },
  { value: 'custom', label: 'Data específica (fixa)' },
  { value: 'limpar', label: '🗑 Limpar (remover data)' },
];

const BASES_RELATIVO = [
  { value: 'vencimento', label: 'vencimento da parcela' },
  { value: 'import', label: 'último import' },
  { value: 'hoje', label: 'hoje' },
];

/** Retorna os campos compatíveis para comparação campo-a-campo (excluindo o próprio campo) */
function camposCompativeisParaReferencia(campo: CampoParcela): CampoParcela[] {
  if (CAMPOS_NUMERICOS.includes(campo)) return CAMPOS_NUMERICOS.filter(c => c !== campo);
  if (CAMPOS_STATUS.includes(campo)) return [];
  if (CAMPOS_BOOLEANOS.includes(campo)) return [];
  if (CAMPOS_DATA.includes(campo)) return [];
  return CAMPOS_TEXTO.filter(c => c !== campo);
}

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
  if (CAMPOS_DATA.includes(campo)) {
    return [
      { value: 'igual', label: 'é igual a' },
      { value: 'diferente', label: 'é diferente de' },
      { value: 'maior_que', label: 'é depois de' },
      { value: 'maior_igual', label: 'é igual ou depois de' },
      { value: 'menor_que', label: 'é antes de' },
      { value: 'menor_igual', label: 'é igual ou antes de' },
    ];
  }
  return [
    { value: 'igual', label: 'é igual a' },
    { value: 'diferente', label: 'é diferente de' },
  ];
}

function ValorInput({ campo, valor, onChange, seguradoras = [], ramos = [], formasPagamento = [] }: {
  campo: CampoParcela; valor: string; onChange: (v: string) => void;
  seguradoras?: string[]; ramos?: string[]; formasPagamento?: string[];
}) {
  const cls = "flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  if (CAMPOS_STATUS.includes(campo)) {
    return (
      <select value={valor} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— Selecione —</option>
        {TODOS_STATUS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </select>
    );
  }
  if (CAMPOS_BOOLEANOS.includes(campo)) {
    return (
      <select value={valor} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </select>
    );
  }
  if (CAMPOS_DATA.includes(campo)) {
    return <input type="date" value={valor} onChange={e => onChange(e.target.value)} className={cls} />;
  }
  if (CAMPOS_NUMERICOS.includes(campo)) {
    return (
      <input type="number" value={valor} onChange={e => onChange(e.target.value)} min="0" className={cls}
        placeholder={campo === 'valor_parcela' ? '0.00' : '0'} />
    );
  }
  // Campos de lista: seguradora, ramo, forma_pagamento
  if (campo === 'seguradora') {
    return (
      <select value={valor} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— Selecione —</option>
        {seguradoras.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }
  if (campo === 'ramo') {
    return (
      <select value={valor} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— Selecione —</option>
        {ramos.map(r => <option key={r} value={r}>{r}</option>)}
      </select>
    );
  }
  if (campo === 'forma_pagamento') {
    return (
      <select value={valor} onChange={e => onChange(e.target.value)} className={cls}>
        <option value="">— Selecione —</option>
        {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
    );
  }
  return (
    <input type="text" value={valor} onChange={e => onChange(e.target.value)} className={cls} placeholder="Valor..." />
  );
}

/** Helper: render um seletor de data para ações (suporta relativo "+N:base") */
function AcaoDataInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const isRelativo = value.startsWith('+');
  const isFixa = value && !isRelativo && value !== 'hoje' && value !== 'vencimento' && value !== 'limpar';
  const modo = value === '' ? '' : value === 'limpar' ? 'limpar' : value === 'hoje' ? 'hoje'
    : value === 'vencimento' ? 'vencimento' : isRelativo ? 'relativo' : 'custom';

  // Parse relative value "+N:base"
  let diasRel = 1;
  let baseRel = 'vencimento';
  if (isRelativo) {
    const [d, b] = value.slice(1).split(':');
    diasRel = parseInt(d, 10) || 1;
    baseRel = b || 'vencimento';
  }

  function handleModoChange(novo: string) {
    if (novo === 'relativo') onChange('+1:vencimento');
    else if (novo === 'custom') onChange(new Date().toISOString().slice(0, 10));
    else onChange(novo);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <select value={modo} onChange={e => handleModoChange(e.target.value)}
        className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
        {OPCOES_DATA_ACAO.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {modo === 'relativo' && (
        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
          <input type="number" min="0" value={diasRel}
            onChange={e => onChange(`+${e.target.value || '0'}:${baseRel}`)}
            className="w-14 px-1.5 py-0.5 border border-blue-300 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-500" />
          <span className="text-xs text-blue-700 shrink-0">dias após</span>
          <select value={baseRel}
            onChange={e => onChange(`+${diasRel}:${e.target.value}`)}
            className="flex-1 px-1.5 py-0.5 border border-blue-300 rounded text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            {BASES_RELATIVO.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      )}
      {(modo === 'custom' || isFixa) && (
        <input type="date" value={isFixa ? value : ''}
          onChange={e => onChange(e.target.value)}
          className="px-2 py-1.5 border border-blue-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
      )}
    </div>
  );
}

interface Props {
  automacoes: AutomacaoParcela[];
  setAutomacoes: (a: AutomacaoParcela[]) => void;
  seguradoras: string[];
  ramos: string[];
  formasPagamento: string[];
}

const autoVazia = (): Omit<AutomacaoParcela, 'id' | 'criadoEm' | 'atualizadoEm'> => ({
  nome: '',
  ativo: true,
  tipo: 'personalizada',
  condicoes: [],
  operadorLogico: 'E',
  filtroSeguradora: '',
  filtroRamo: '',
  filtroFormaPagamento: '',
  alterarStatus: true,
  novoStatus: 'em_tratativa',
  acaoProrrogada: '',
  acaoDataProrrogacao: '',
  acaoDataLimite: '',
  prioridade: 0,
});

export function AutomacoesParcelasConfig({ automacoes, setAutomacoes, seguradoras, ramos, formasPagamento }: Props) {
  const [modal, setModal] = useState<AutomacaoParcela | 'nova' | null>(null);
  const [form, setForm] = useState(autoVazia());
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const personalizadas  = automacoes.filter(a => a.tipo === 'personalizada' || a.tipo === 'ao_criar');
  const [filtroSegVis, setFiltroSegVis] = useState('');

  // Seguradoras únicas presentes nas regras (para o filtro)
  const seguradoarasNasRegras = useMemo(() =>
    [...new Set(personalizadas.map(a => a.filtroSeguradora).filter(Boolean))].sort() as string[],
    [personalizadas]
  );

  // Regras visíveis após filtro
  const personalizadasVisiveis = filtroSegVis
    ? personalizadas.filter(a => a.filtroSeguradora === filtroSegVis)
    : personalizadas;

  // Grupos: { label, itens }
  const gruposRegras = useMemo(() => {
    const map = new Map<string, AutomacaoParcela[]>();
    personalizadasVisiveis.forEach(a => {
      const key = a.filtroSeguradora || '__geral__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    const result: { label: string; chave: string; itens: AutomacaoParcela[] }[] = [];
    // "Todas" primeiro
    if (map.has('__geral__')) result.push({ label: 'Todas as Seguradoras', chave: '__geral__', itens: map.get('__geral__')! });
    map.forEach((itens, key) => { if (key !== '__geral__') result.push({ label: key, chave: key, itens }); });
    return result;
  }, [personalizadasVisiveis]);

  function abrirNova() {
    setForm({ ...autoVazia(), tipo: 'personalizada' });
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
    const nova: CondicaoAutomacao = { id: generateId(), campo: 'dias_apos_vencimento', operador: 'maior_que', tipoValor: 'fixo', valor: '5' };
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
    if (a.tipo === 'ao_criar') return 'Disparada ao importar nova parcela';
    if (a.tipo === 'padrao_vencimento') return `Após ${a.diasAposVencimento ?? 0} dias do vencimento`;
    if (a.tipo === 'padrao_sem_import') return `Ausente no import há ${a.diasAntesSemImport ?? 0} dias`;
    if (!a.condicoes.length) return '(sem condições)';
    return a.condicoes.map(c => {
      const lado = c.tipoValor === 'campo' && c.valorCampo
        ? CAMPO_LABELS[c.valorCampo]
        : c.valor;
      return `${CAMPO_LABELS[c.campo]} ${c.operador.replace(/_/g,' ')} ${lado}`;
    }).join(` ${a.operadorLogico} `);
  }

  const CardRegra = ({ a }: { a: AutomacaoParcela }) => (
    <div className={`border rounded-lg p-3 transition-opacity ${a.ativo ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-800 text-sm">{a.nome}</span>
            {a.tipo === 'ao_criar' && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                Ao Criar
              </span>
            )}
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
          <div className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-1.5">
            {a.alterarStatus !== false && (
              <span>→ <span className="font-medium text-gray-600">{STATUS_LABELS[a.novoStatus]}</span></span>
            )}
            {a.acaoProrrogada === 'sim' && <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">Prorrogada: Sim</span>}
            {a.acaoProrrogada === 'nao' && <span className="px-1.5 py-0.5 bg-gray-50 text-gray-600 rounded border border-gray-200">Prorrogada: Não</span>}
            {a.acaoDataProrrogacao === 'limpar'
              ? <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-200">Data Prorr.: Limpar</span>
              : a.acaoDataProrrogacao
                ? <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">Data Prorr.: {a.acaoDataProrrogacao}</span>
                : null}
            {a.acaoDataLimite === 'limpar'
              ? <span className="px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-200">Data Limite: Limpar</span>
              : a.acaoDataLimite
                ? <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">Data Limite: {a.acaoDataLimite}</span>
                : null}
            {(() => {
              const temSeg  = a.condicoes.some(c => c.campo === 'seguradora'      && c.operador === 'igual') || !!a.filtroSeguradora;
              const temRamo = a.condicoes.some(c => c.campo === 'ramo'            && c.operador === 'igual') || !!a.filtroRamo;
              const temFp   = a.condicoes.some(c => c.campo === 'forma_pagamento' && c.operador === 'igual') || !!a.filtroFormaPagamento;
              const esp = (temSeg ? 1 : 0) + (temRamo ? 1 : 0) + (temFp ? 1 : 0);
              const labels = ['Geral', 'Específica', 'Mais específica', 'Muito específica'];
              const colors = ['bg-gray-100 text-gray-500', 'bg-blue-50 text-blue-600', 'bg-indigo-100 text-indigo-700', 'bg-purple-100 text-purple-700'];
              return <span className={`px-1.5 py-0.5 rounded border text-xs font-medium ${colors[esp]} border-transparent`}>{labels[esp]}</span>;
            })()}
            {a.prioridade > 0 && <span className="text-gray-400">· desempate {a.prioridade}</span>}
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

      {/* Section: Custom rules */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-blue-600" />
              <h2 className="font-semibold text-gray-900 text-sm">Regras de Automação</h2>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Crie condições combinadas (SE campo operador valor ENTÃO mudar status).</p>
          </div>
          <button onClick={() => abrirNova()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white text-sm rounded-lg hover:bg-blue-800 shrink-0">
            <Plus size={13} /> Nova Regra
          </button>
        </div>

        {/* Filtro por seguradora */}
        {seguradoarasNasRegras.length > 0 && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Filtrar:</span>
            <button onClick={() => setFiltroSegVis('')}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${filtroSegVis === '' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              Todas
            </button>
            {seguradoarasNasRegras.map(seg => (
              <button key={seg} onClick={() => setFiltroSegVis(seg === filtroSegVis ? '' : seg)}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${filtroSegVis === seg ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
                {seg}
              </button>
            ))}
          </div>
        )}

        {personalizadas.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">Nenhuma regra criada ainda.</p>
        ) : gruposRegras.length === 0 ? (
          <p className="text-sm text-gray-400 italic text-center py-4 bg-gray-50 rounded-lg">Nenhuma regra para este filtro.</p>
        ) : (
          <div className="space-y-4">
            {gruposRegras.map(grupo => (
              <div key={grupo.chave}>
                {gruposRegras.length > 1 && (
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      grupo.chave === '__geral__'
                        ? 'bg-gray-100 text-gray-600 border-gray-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>{grupo.label}</span>
                    <div className="flex-1 h-px bg-gray-100" />
                    <span className="text-xs text-gray-400">{grupo.itens.length} regra(s)</span>
                  </div>
                )}
                <div className="space-y-2">
                  {grupo.itens.map(a => <CardRegra key={a.id} a={a} />)}
                </div>
              </div>
            ))}
          </div>
        )}
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
              {/* Tipo de gatilho */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Gatilho</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { tipo: 'personalizada', titulo: 'Condições personalizadas', sub: 'SE campo operador valor ENTÃO ação' },
                    { tipo: 'ao_criar',      titulo: 'Ao criar novo negócio',    sub: 'Executa ao importar uma parcela nova' },
                  ] as const).map(({ tipo, titulo, sub }) => (
                    <button key={tipo} type="button"
                      onClick={() => setForm(f => ({ ...f, tipo, condicoes: [] }))}
                      className={`text-left px-3 py-2.5 border rounded-lg text-sm transition-colors ${
                        form.tipo === tipo
                          ? tipo === 'ao_criar'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-blue-700 text-white border-blue-700'
                          : 'border-gray-300 text-gray-700 hover:border-blue-400'
                      }`}>
                      <div className="font-medium">{titulo}</div>
                      <div className={`text-xs mt-0.5 ${form.tipo === tipo ? 'opacity-80' : 'text-gray-400'}`}>{sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome <span className="text-red-500">*</span></label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder={form.tipo === 'ao_criar' ? 'Ex.: Definir status Tratar ao importar' : 'Ex.: Parcela vencida há 30 dias → Em Tratamento'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              {/* Conditions builder — oculto para ao_criar */}
              {form.tipo === 'ao_criar' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
                  Esta automação é disparada automaticamente toda vez que uma nova parcela é importada (status <strong>Importada</strong>). Não é necessário definir condições — configure apenas as ações abaixo.
                </div>
              )}

              {/* Conditions builder */}
              {form.tipo !== 'ao_criar' && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-200">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Condições (SE...)</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 mr-1">Operador:</span>
                      <button onClick={() => setForm(f => ({ ...f, operadorLogico: 'E' }))}
                        className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${form.operadorLogico === 'E' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>E</button>
                      <button onClick={() => setForm(f => ({ ...f, operadorLogico: 'OU' }))}
                        className={`px-2 py-0.5 rounded text-xs font-bold border transition-colors ${form.operadorLogico === 'OU' ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>OU</button>
                    </div>
                  </div>

                  <div className="p-3 space-y-2">
                    {form.condicoes.length === 0 && (
                      <p className="text-sm text-gray-400 text-center py-2">Nenhuma condição adicionada ainda.</p>
                    )}
                    {form.condicoes.map((cond, idx) => {
                      const camposRef = camposCompativeisParaReferencia(cond.campo);
                      const podeCompararcampo = camposRef.length > 0;
                      const modoAtual = cond.tipoValor ?? 'fixo';
                      return (
                        <div key={cond.id} className="bg-gray-50 rounded-lg px-3 py-2 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {idx > 0 && (
                              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 shrink-0">
                                {form.operadorLogico}
                              </span>
                            )}
                            <span className="text-xs text-gray-500 shrink-0">SE</span>
                            {/* Campo esquerdo */}
                            <select value={cond.campo}
                              onChange={e => {
                                const campo = e.target.value as CampoParcela;
                                const ops = operadoresParaCampo(campo);
                                const operador = ops[0].value;
                                const valor = campo === 'status' ? '' : campo === 'valor_parcela' ? '0' : '5';
                                updateCondicao(cond.id, { campo, operador, valor, tipoValor: 'fixo', valorCampo: undefined });
                              }}
                              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                              {(Object.entries(CAMPO_LABELS) as [CampoParcela, string][]).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </select>
                            {/* Operador */}
                            <select value={cond.operador}
                              onChange={e => updateCondicao(cond.id, { operador: e.target.value as OperadorCondicao })}
                              className="px-2 py-1 border border-gray-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                              {operadoresParaCampo(cond.campo).map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                            {/* Toggle fixo/campo — só aparece quando há campos compatíveis */}
                            {podeCompararcampo && (
                              <div className="flex rounded border border-gray-300 overflow-hidden text-xs shrink-0">
                                <button type="button"
                                  onClick={() => updateCondicao(cond.id, { tipoValor: 'fixo', valorCampo: undefined })}
                                  className={`px-2 py-1 transition-colors ${modoAtual === 'fixo' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                                  Valor
                                </button>
                                <button type="button"
                                  onClick={() => updateCondicao(cond.id, { tipoValor: 'campo', valorCampo: camposRef[0] })}
                                  className={`px-2 py-1 border-l border-gray-300 transition-colors ${modoAtual === 'campo' ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
                                  Campo
                                </button>
                              </div>
                            )}
                            {/* Lado direito: valor fixo ou campo de referência */}
                            {modoAtual === 'campo' && podeCompararcampo ? (
                              <select value={cond.valorCampo ?? camposRef[0]}
                                onChange={e => updateCondicao(cond.id, { valorCampo: e.target.value as CampoParcela })}
                                className="flex-1 px-2 py-1 border border-blue-300 rounded text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                                {camposRef.map(c => (
                                  <option key={c} value={c}>{CAMPO_LABELS[c]}</option>
                                ))}
                              </select>
                            ) : (
                              <ValorInput campo={cond.campo} valor={cond.valor} onChange={v => updateCondicao(cond.id, { valor: v })} seguradoras={seguradoras} ramos={ramos} formasPagamento={formasPagamento} />
                            )}
                            <button onClick={() => removeCondicao(cond.id)} className="p-1 text-gray-400 hover:text-red-600 rounded shrink-0">
                              <X size={13} />
                            </button>
                          </div>
                          {/* Indicador visual quando modo campo */}
                          {modoAtual === 'campo' && cond.valorCampo && (
                            <div className="text-xs text-blue-600 bg-blue-50 rounded px-2 py-1">
                              Comparando <strong>{CAMPO_LABELS[cond.campo]}</strong> com o valor de <strong>{CAMPO_LABELS[cond.valorCampo]}</strong> da própria parcela
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button onClick={addCondicao}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 mt-1">
                      <Plus size={12} /> Adicionar condição
                    </button>
                  </div>
                </div>
              )}

              {/* Actions (ENTÃO) */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ações (ENTÃO...)</span>
                </div>
                <div className="p-3 space-y-3">
                  {/* Status */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-1.5 text-sm text-gray-700 shrink-0 cursor-pointer">
                      <input type="checkbox" checked={form.alterarStatus !== false}
                        onChange={e => setForm(f => ({ ...f, alterarStatus: e.target.checked }))}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                      Mudar status para
                    </label>
                    {form.alterarStatus !== false && (
                      <select value={form.novoStatus} onChange={e => setForm(f => ({ ...f, novoStatus: e.target.value as StatusParcela }))}
                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {TODOS_STATUS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    )}
                  </div>
                  {/* Prorrogada */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-sm text-gray-700 shrink-0">Parcela desconsiderada na prorrogação:</label>
                    <div className="flex rounded border border-gray-300 overflow-hidden text-xs shrink-0">
                      {([['', 'Não alterar'], ['sim', 'Sim'], ['nao', 'Não']] as const).map(([v, l]) => (
                        <button key={v} type="button"
                          onClick={() => setForm(f => ({ ...f, acaoProrrogada: v }))}
                          className={`px-2.5 py-1.5 border-l first:border-l-0 border-gray-300 transition-colors ${(form.acaoProrrogada ?? '') === v ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Data Prorrogação + Data Limite */}
                  <div className="grid grid-cols-2 gap-3">
                    <AcaoDataInput label="Data de Prorrogação"
                      value={form.acaoDataProrrogacao ?? ''}
                      onChange={v => setForm(f => ({ ...f, acaoDataProrrogacao: v }))} />
                    <AcaoDataInput label="Data Limite"
                      value={form.acaoDataLimite ?? ''}
                      onChange={v => setForm(f => ({ ...f, acaoDataLimite: v }))} />
                  </div>
                </div>
              </div>

              {/* Priority + Active */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Desempate (0 = primeiro)</label>
                  <input type="number" min="0" value={form.prioridade}
                    onChange={e => setForm(f => ({ ...f, prioridade: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <p className="text-xs text-gray-400 mt-1">O sistema já ordena automaticamente: mais filtros = roda primeiro. Este número só desempata automações com o mesmo nível de filtros.</p>
                </div>
                <div className="flex items-center gap-2 pt-5">
                  <input type="checkbox" id="ativo-auto" checked={form.ativo}
                    onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  <label htmlFor="ativo-auto" className="text-sm text-gray-700">Ativa</label>
                </div>
              </div>

              {/* Preview */}
              {form.tipo !== 'ao_criar' && form.condicoes.length > 0 && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700">
                  <p className="font-semibold mb-1">Resumo da regra:</p>
                  <p>
                    {form.condicoes.map((c, i) => (
                      <span key={c.id}>{i > 0 && <strong> {form.operadorLogico} </strong>}
                        {CAMPO_LABELS[c.campo]} {c.operador.replace(/_/g,' ')}{' '}
                        {c.tipoValor === 'campo' && c.valorCampo
                          ? <em>{CAMPO_LABELS[c.valorCampo]}</em>
                          : <strong>{c.valor || '—'}</strong>}
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
