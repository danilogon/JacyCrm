import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  content: React.ReactNode;
  children: React.ReactNode;
  width?: number; // largura do tooltip em px (padrão 240)
}

/**
 * Tooltip que renderiza via Portal (fora do overflow-hidden dos containers).
 * Detecta automaticamente se há espaço abaixo e muda para cima quando necessário.
 */
export function Tooltip({ content, children, width = 240 }: Props) {
  const [pos, setPos] = useState<{ top: number; left: number; above: boolean } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const TOOLTIP_HEIGHT = 100; // altura estimada
    const GAP = 8;

    const above = window.innerHeight - rect.bottom < TOOLTIP_HEIGHT + GAP;

    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }

    setPos({
      top: above ? rect.top - GAP : rect.bottom + GAP,
      left,
      above,
    });
  }, [width]);

  const hide = useCallback(() => setPos(null), []);

  return (
    <span ref={triggerRef} onMouseEnter={show} onMouseLeave={hide} className="inline-flex">
      {children}
      {pos && createPortal(
        <span
          style={{ position: 'fixed', top: pos.top, left: pos.left, width, zIndex: 9999,
                   transform: pos.above ? 'translateY(-100%)' : 'none' }}
          className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl leading-relaxed whitespace-normal pointer-events-none"
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  );
}
