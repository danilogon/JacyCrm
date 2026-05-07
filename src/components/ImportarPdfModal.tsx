import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import type { Ramo } from '../types';
import { parsePdfCotacao, mapRamoToSystem, type DadosCotacao } from '../utils/parsePdfCotacao';

interface Props {
  ramos: Ramo[];
  onImportar: (dados: DadosCotacao, ramoSistema: string) => void;
  onClose: () => void;
}

type Estado = 'aguardando' | 'lendo' | 'ok' | 'erro';

export function ImportarPdfModal({ ramos, onImportar, onClose }: Props) {
  const [estado, setEstado] = useState<Estado>('aguardando');
  const [erroMsg, setErroMsg] = useState('');
  const [dados, setDados] = useState<DadosCotacao | null>(null);
  const [ramoSistema, setRamoSistema] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const nomesRamos = ramos.filter(r => r.ativo).map(r => r.nome);

  async function processarArquivo(file: File) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErroMsg('Selecione um arquivo PDF.');
      setEstado('erro');
      return;
    }
    setNomeArquivo(file.name);
    setEstado('lendo');
    setErroMsg('');
    try {
      const resultado = await parsePdfCotacao(file);
      const ramo = mapRamoToSystem(resultado.ramoKeyword, nomesRamos);
      setDados(resultado);
      setRamoSistema(ramo);
      setEstado('ok');
    } catch (e) {
      console.error(e);
      const detalhe = e instanceof Error ? e.message : String(e);
      setErroMsg(`Erro: ${detalhe}`);
      setEstado('erro');
    }
  }

  function handleFile(files: FileList | null) {
    if (!files || files.length === 0) return;
    processarArquivo(files[0]);
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files);
  }, []);

  function reiniciar() {
    setEstado('aguardando');
    setDados(null);
    setErroMsg('');
    setNomeArquivo('');
    if (inputRef.current) inputRef.current.value = '';
  }

  function confirmar() {
    if (!dados) return;
    onImportar(dados, ramoSistema);
  }

  // ── Componente de campo extraído ────────────────────────────────────────
  function Campo({ label, valor, obrigatorio = false }: { label: string; valor: string; obrigatorio?: boolean }) {
    const encontrado = valor.trim().length > 0;
    return (
      <div className="flex items-start gap-2.5 py-2 border-b border-gray-100 last:border-0">
        <div className="mt-0.5 shrink-0">
          {encontrado
            ? <CheckCircle size={14} className="text-green-500" />
            : <AlertCircle size={14} className={obrigatorio ? 'text-amber-400' : 'text-gray-300'} />}
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
          {encontrado
            ? <div className="text-sm font-medium text-gray-800 truncate">{valor}</div>
            : <div className="text-sm text-gray-400 italic">{obrigatorio ? 'Não encontrado — preencher manualmente' : 'Não encontrado'}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="font-bold text-gray-900">Importar Cotação PDF</h2>
            <p className="text-xs text-gray-400 mt-0.5">Agger Sistemas — cotações de seguro</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── Estado: aguardando ── */}
          {(estado === 'aguardando' || estado === 'erro') && (
            <>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors
                  ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/40'}`}
              >
                <div className="p-3 bg-blue-100 rounded-full">
                  <Upload size={22} className="text-blue-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Clique ou arraste um arquivo PDF</p>
                  <p className="text-xs text-gray-400 mt-1">Cotações geradas pelo Agger Sistemas</p>
                </div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={e => handleFile(e.target.files)}
                />
              </div>

              {estado === 'erro' && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{erroMsg}</span>
                </div>
              )}
            </>
          )}

          {/* ── Estado: lendo ── */}
          {estado === 'lendo' && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={32} className="text-blue-500 animate-spin" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Lendo o PDF...</p>
                <p className="text-xs text-gray-400 mt-1 truncate max-w-xs">{nomeArquivo}</p>
              </div>
            </div>
          )}

          {/* ── Estado: ok — preview dos dados ── */}
          {estado === 'ok' && dados && (
            <>
              {/* Arquivo lido */}
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                <FileText size={15} className="text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-green-800 truncate">{nomeArquivo}</p>
                  <p className="text-xs text-green-600">
                    Cotação de Seguro — <strong>{dados.ramoKeyword || 'Ramo não identificado'}</strong>
                    {dados.tipoSeguro && ` · ${dados.tipoSeguro}`}
                  </p>
                </div>
                <button onClick={reiniciar} title="Trocar arquivo"
                  className="p-1 text-green-500 hover:text-green-700 hover:bg-green-100 rounded">
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* Campos extraídos */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Dados extraídos do PDF</p>
                <div className="bg-gray-50 rounded-lg px-4 divide-y divide-gray-100">
                  <Campo label="Nome do Segurado" valor={dados.nome} obrigatorio />
                  <Campo label="CPF / CNPJ" valor={dados.cpfCnpj} obrigatorio />
                  <Campo label="Data de Nascimento" valor={dados.dataNascimentoRaw} />
                  <Campo label="Telefone" valor={dados.telefone} />
                  <Campo label="E-mail" valor={dados.email} />
                </div>
              </div>

              {/* Ramo detectado */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ramo Detectado</p>
                <div className="flex items-center gap-3">
                  {ramoSistema ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex-1">
                      <CheckCircle size={14} className="text-blue-500 shrink-0" />
                      <span className="text-sm font-medium text-blue-800">{ramoSistema}</span>
                      <span className="text-xs text-blue-400 ml-auto">(detectado: {dados.ramoKeyword})</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex-1">
                      <AlertCircle size={14} className="text-amber-500 shrink-0" />
                      <span className="text-sm text-amber-700">
                        {dados.ramoKeyword
                          ? `"${dados.ramoKeyword}" não corresponde a nenhum ramo cadastrado`
                          : 'Ramo não identificado no PDF'}
                      </span>
                    </div>
                  )}
                  {/* Select para corrigir/escolher ramo */}
                  <select
                    value={ramoSistema}
                    onChange={e => setRamoSistema(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Selecionar —</option>
                    {nomesRamos.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Info sobre campos restantes */}
              <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-lg">
                <p className="text-xs text-blue-700">
                  <strong>Próximo passo:</strong> Os dados acima serão pré-preenchidos no formulário.
                  Você ainda precisará preencher: <strong>seguradora, prêmio líquido, % comissão e início de vigência</strong>.
                </p>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
          <button onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            Cancelar
          </button>
          {estado === 'ok' && dados && (
            <button onClick={confirmar}
              className="flex items-center gap-2 px-4 py-2 bg-blue-700 text-white rounded-lg text-sm hover:bg-blue-800">
              <FileText size={14} /> Usar estes dados
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
