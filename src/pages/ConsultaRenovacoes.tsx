import { useState, useMemo } from 'react';
import { Search, Bell } from 'lucide-react';
import type { Renovacao, Usuario, Cliente } from '../types';
import { formatDate } from '../utils/formatters';
import { Tooltip } from '../components/Tooltip';

interface Props {
  renovacoes: Renovacao[];
  usuarios: Usuario[];
  clientes?: Cliente[];
}

const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function ConsultaRenovacoes({ renovacoes, usuarios, clientes = [] }: Props) {
  const now = new Date();
  const [filtroAno, setFiltroAno] = useState(now.getFullYear());
  const [filtroMes, setFiltroMes] = useState(now.getMonth() + 1);
  const [busca, setBusca] = useState('');

  const anos = useMemo(() => {
    const set = new Set<number>();
    renovacoes.forEach(r => { if (r.fimVigencia) set.add(+r.fimVigencia.split('-')[0]); });
    if (!set.has(now.getFullYear())) set.add(now.getFullYear());
    return [...set].sort((a, b) => b - a);
  }, [renovacoes]);

  const filtradas = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return renovacoes
      .filter(r => {
        if (r.fimVigencia) {
          const [y, m] = r.fimVigencia.split('-').map(Number);
          if (filtroAno && y !== filtroAno) return false;
          if (filtroMes && m !== filtroMes) return false;
        }
        if (q && !r.nomeCliente.toLowerCase().includes(q) &&
            !r.cpfCnpjCliente?.includes(q)) return false;
        return true;
      })
      .sort((a, b) => (a.fimVigencia || '').localeCompare(b.fimVigencia || ''));
  }, [renovacoes, filtroAno, filtroMes, busca]);

  function nomeUsuario(id: string) {
    return usuarios.find(u => u.id === id)?.nome ?? '—';
  }


  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Consulta de Renovações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Consulte o responsável por cada renovação para direcionar o cliente corretamente.</p>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
        <select value={filtroAno} onChange={e => setFiltroAno(+e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={0}>Todos os anos</option>
          {anos.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={filtroMes} onChange={e => setFiltroMes(+e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={0}>Todos os meses</option>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por nome do cliente..."
            className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <span className="ml-auto text-sm text-gray-400">{filtradas.length} registro(s)</span>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Fim de Vigência</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Segurado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Seguradora Atual</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Ramo</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                  Nenhuma renovação encontrada para os filtros selecionados
                </td>
              </tr>
            ) : filtradas.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">
                  {formatDate(r.fimVigencia) || '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-800">{r.nomeCliente}</span>
                    {(() => {
                      const obs = clientes.find(c => c.id === r.clienteId)?.observacaoImportante;
                      if (!obs) return null;
                      return (
                        <Tooltip content={obs} width={224}>
                          <Bell size={11} className="text-amber-500 cursor-help" />
                        </Tooltip>
                      );
                    })()}
                  </div>
                  {r.telefoneCliente && (
                    <div className="text-xs text-gray-400 mt-0.5">{r.telefoneCliente}</div>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">{r.seguradoraAnterior || '—'}</td>
                <td className="px-4 py-3 text-gray-700">{r.ramo || '—'}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={r.status} />
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700">
                    {nomeUsuario(r.responsavelId)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  renovado:       { label: 'Renovado',       cls: 'bg-green-100 text-green-700' },
  nao_renovada:   { label: 'Não Renovada',   cls: 'bg-red-100 text-red-600' },
  em_negociacao:  { label: 'Em Negociação',  cls: 'bg-yellow-100 text-yellow-700' },
  em_orcamento:   { label: 'Em Orçamento',   cls: 'bg-blue-100 text-blue-700' },
  a_trabalhar:    { label: 'A Trabalhar',    cls: 'bg-gray-100 text-gray-600' },
  a_transmitir:   { label: 'A Transmitir',   cls: 'bg-indigo-100 text-indigo-700' },
  pendente:       { label: 'Pendente',       cls: 'bg-orange-100 text-orange-700' },
  vencidas:       { label: 'Vencida',        cls: 'bg-rose-100 text-rose-700' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}
