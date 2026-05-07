import type { InputHTMLAttributes } from 'react';

/**
 * Tenta interpretar texto colado no campo de data e converte para YYYY-MM-DD.
 * Suporta: DD/MM/YYYY · DD-MM-YYYY · DD.MM.YYYY · YYYY-MM-DD
 */
function parseDateText(text: string): string | null {
  const s = text.trim();

  // Já está no formato correto
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY ou D/M/YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  return null;
}

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Campo de data com suporte a colar (Ctrl+V) em formato brasileiro DD/MM/YYYY.
 * Substitui <input type="date"> em todo o sistema.
 */
export function DateInput({ onChange, ...props }: Props) {
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text');
    const parsed = parseDateText(text);
    if (parsed && onChange) {
      e.preventDefault();
      // Cria evento sintético mínimo compatível com os handlers do React
      onChange({ target: { value: parsed } } as React.ChangeEvent<HTMLInputElement>);
    }
  }

  return <input type="date" onPaste={handlePaste} onChange={onChange} {...props} />;
}
