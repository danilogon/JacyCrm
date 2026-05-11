import { useRef } from 'react';
import { Paperclip, X, ExternalLink, FileText, Image } from 'lucide-react';
import type { Observacao, ArquivoAnexo } from '../types';
import { generateId, abrirArquivoNoNavegador } from '../utils/formatters';

interface Props {
  observacoes: Observacao[];
  novaObservacao: string;
  onChangeNovaObservacao: (v: string) => void;
  novosArquivos: ArquivoAnexo[];
  onChangeNovosArquivos: (a: ArquivoAnexo[]) => void;
  placeholder?: string;
  somenteLeitura?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isImage(tipo: string) {
  return tipo.startsWith('image/');
}

const abrirArquivo = (a: ArquivoAnexo) => abrirArquivoNoNavegador(a.dataBase64, a.tipo);

export function ObservacoesPanel({
  observacoes,
  novaObservacao,
  onChangeNovaObservacao,
  novosArquivos,
  onChangeNovosArquivos,
  placeholder = 'Adicionar nova observação...',
  somenteLeitura = false,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const novos: ArquivoAnexo[] = [];
    let pending = files.length;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(',')[1];
        novos.push({ id: generateId(), nome: file.name, tipo: file.type || 'application/octet-stream', tamanho: file.size, dataBase64: base64 });
        pending--;
        if (pending === 0) onChangeNovosArquivos([...novosArquivos, ...novos]);
      };
      reader.readAsDataURL(file);
    });
  }

  return (
    <div className="space-y-3">

      {/* Histórico de observações */}
      {observacoes.length > 0 && (
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {observacoes.map(obs => (
            <div key={obs.id} className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-gray-700">{obs.autor}</span>
                <span className="text-xs text-gray-400">
                  {new Date(obs.data).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
              {obs.texto && <p className="text-gray-600 whitespace-pre-wrap">{obs.texto}</p>}
              {obs.arquivos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {obs.arquivos.map(a => (
                    <button key={a.id} type="button" onClick={() => abrirArquivo(a)}
                      title={`${a.nome} · ${formatBytes(a.tamanho)} — clique para abrir`}
                      className="flex items-center gap-1.5 px-2 py-1 bg-white border border-gray-200 rounded text-xs text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                      {isImage(a.tipo) ? <Image size={11} /> : <FileText size={11} />}
                      <span className="max-w-[130px] truncate">{a.nome}</span>
                      <ExternalLink size={10} className="shrink-0 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Nova observação */}
      {!somenteLeitura && <div className="space-y-2">
        <textarea
          value={novaObservacao}
          onChange={e => onChangeNovaObservacao(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />

        {/* Pré-visualização dos arquivos a anexar */}
        {novosArquivos.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            {novosArquivos.map(a => (
              <div key={a.id}
                className="flex items-center gap-1.5 px-2 py-1 bg-white border border-blue-200 rounded text-xs text-blue-700">
                {isImage(a.tipo) ? <Image size={11} /> : <FileText size={11} />}
                <span className="max-w-[120px] truncate">{a.nome}</span>
                <span className="text-blue-400 shrink-0">({formatBytes(a.tamanho)})</span>
                <button type="button"
                  onClick={() => onChangeNovosArquivos(novosArquivos.filter(x => x.id !== a.id))}
                  className="text-blue-400 hover:text-red-500 ml-0.5 shrink-0">
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Botão anexar */}
        <input ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => { handleFiles(e.target.files); (e.target as HTMLInputElement).value = ''; }} />
        <button type="button" onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          <Paperclip size={13} />
          Anexar arquivo
        </button>
      </div>}
    </div>
  );
}
