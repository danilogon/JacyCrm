import { useState, useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ErrorBoundary } from './ErrorBoundary';
import type { Renovacao, SeguroNovo, Tarefa } from '../types';

interface Props {
  renovacoes: Renovacao[];
  segurosNovos: SeguroNovo[];
  tarefas: Tarefa[];
}

export function Layout({ renovacoes, segurosNovos, tarefas }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen(v => !v), []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Overlay backdrop (mobile only) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeMobile}
        />
      )}

      {/* Sidebar — drawer on mobile, fixed column on desktop */}
      <div className={`
        fixed inset-y-0 left-0 z-50 md:relative md:z-auto
        transform transition-transform duration-200 ease-in-out
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <Sidebar tarefas={tarefas} onNavigate={closeMobile} />
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <Header
          renovacoes={renovacoes}
          segurosNovos={segurosNovos}
          onMenuToggle={toggleMobile}
        />
        <main className="flex-1 p-3 sm:p-6 overflow-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
