import { X, CheckCircle2, XCircle, UserPlus } from 'lucide-react';

export interface LinhaValida {
  linha: number;
  nome: string;
  detalhe?: string;
  clienteNovo?: boolean;
}

export interface LinhaInvalida {
  linha: number;
  nome: string;
  motivo: string;
}

interface ImportPreviewModalProps {
  titulo: string;
  nomeArquivo: string;
  linhasValidas: LinhaValida[];
  linhasInvalidas: LinhaInvalida[];
  importando?: boolean;
  onConfirmar(): void;
  onCancelar(): void;
}

export function ImportPreviewModal({
  titulo,
  nomeArquivo,
  linhasValidas,
  linhasInvalidas,
  importando,
  onConfirmar,
  onCancelar,
}: ImportPreviewModalProps) {
  const clientesNovos = linhasValidas.filter(l => l.clienteNovo).length;
  const preview = linhasValidas.slice(0, 5);
  const restante = linhasValidas.length - preview.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{titulo}</h2>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-sm">{nomeArquivo}</p>
          </div>
          <button
            onClick={onCancelar}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{linhasValidas.length}</div>
              <div className="text-xs text-green-600 mt-0.5">registros válidos</div>
            </div>
            <div className={`border rounded-lg p-3 text-center ${linhasInvalidas.length > 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className={`text-2xl font-bold ${linhasInvalidas.length > 0 ? 'text-red-700' : 'text-gray-400'}`}>{linhasInvalidas.length}</div>
              <div className={`text-xs mt-0.5 ${linhasInvalidas.length > 0 ? 'text-red-600' : 'text-gray-400'}`}>rejeitados</div>
            </div>
            <div className={`border rounded-lg p-3 text-center ${clientesNovos > 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className={`text-2xl font-bold ${clientesNovos > 0 ? 'text-blue-700' : 'text-gray-400'}`}>{clientesNovos}</div>
              <div className={`text-xs mt-0.5 ${clientesNovos > 0 ? 'text-blue-600' : 'text-gray-400'}`}>clientes novos</div>
            </div>
          </div>

          {/* Rejected rows */}
          {linhasInvalidas.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-red-700 mb-2">
                <XCircle size={15} />
                Linhas rejeitadas ({linhasInvalidas.length})
              </div>
              <div className="max-h-40 overflow-y-auto bg-red-50 rounded-lg p-3 space-y-1.5">
                {linhasInvalidas.map(l => (
                  <div key={l.linha} className="text-xs text-red-800">
                    <span className="font-medium">Linha {l.linha}</span>
                    {l.nome && l.nome !== '(sem nome)' ? ` — ${l.nome}` : ''}
                    : <span className="text-red-600">{l.motivo}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Valid rows preview */}
          {linhasValidas.length > 0 ? (
            <div>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-700 mb-2">
                <CheckCircle2 size={15} className="text-green-600" />
                Registros que serão importados
              </div>
              <div className="space-y-1.5">
                {preview.map(l => (
                  <div key={l.linha} className="flex items-center gap-2 py-1.5 px-3 bg-green-50 rounded-lg text-sm border border-green-100">
                    <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                    <span className="font-medium text-gray-800">{l.nome}</span>
                    {l.detalhe && <span className="text-xs text-gray-500">· {l.detalhe}</span>}
                    {l.clienteNovo && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                        <UserPlus size={11} /> novo
                      </span>
                    )}
                  </div>
                ))}
                {restante > 0 && (
                  <p className="text-xs text-gray-400 text-center py-1">... e mais {restante} registro(s)</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
              <XCircle size={16} className="shrink-0" />
              Nenhum registro válido para importar.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 sticky bottom-0 bg-white rounded-b-xl">
          <button
            onClick={onCancelar}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
          >
            Cancelar
          </button>
          {linhasValidas.length > 0 && (
            <button
              onClick={onConfirmar}
              disabled={importando}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-medium hover:bg-blue-800 disabled:opacity-60"
            >
              {importando && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              Confirmar Importação
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
