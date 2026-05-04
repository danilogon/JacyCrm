import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirmar', danger = true }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="text-amber-500 shrink-0" size={22} />
          <h3 className="font-semibold text-gray-900">{title}</h3>
        </div>
        <p className="text-gray-600 mb-5 text-sm leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white text-sm font-medium ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-700 hover:bg-blue-800'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
