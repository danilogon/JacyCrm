import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ErrorBoundary } from './ErrorBoundary';
import type { Renovacao, SeguroNovo } from '../types';

interface Props {
  renovacoes: Renovacao[];
  segurosNovos: SeguroNovo[];
}

export function Layout({ renovacoes, segurosNovos }: Props) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header renovacoes={renovacoes} segurosNovos={segurosNovos} />
        <main className="flex-1 p-6 overflow-auto">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
