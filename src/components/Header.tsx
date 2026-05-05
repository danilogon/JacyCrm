import { useState, useRef, useEffect } from 'react';
import { Search, Bell, LogOut, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import type { Renovacao, SeguroNovo } from '../types';

interface Props {
  renovacoes: Renovacao[];
  segurosNovos: SeguroNovo[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  usuario: 'Usuário',
};

type SearchResult = {
  id: string;
  tipo: string;
  nome: string;
  detalhe: string;
  route: string;
};

export function Header({ renovacoes, segurosNovos }: Props) {
  const { usuario, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results: SearchResult[] = (() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    const rv: SearchResult[] = renovacoes
      .filter(r =>
        r.nomeCliente?.toLowerCase().includes(q) ||
        r.emailCliente?.toLowerCase().includes(q) ||
        r.cpfCnpjCliente?.includes(q) ||
        r.ramo?.toLowerCase().includes(q) ||
        r.status?.toLowerCase().includes(q) ||
        r.seguradoraAnterior?.toLowerCase().includes(q) ||
        r.seguradoraNova?.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map(r => ({ id: r.id, tipo: 'Renovação', nome: r.nomeCliente, detalhe: `${r.ramo} · ${r.fimVigencia}`, route: '/renovacoes' }));

    const sn: SearchResult[] = segurosNovos
      .filter(s =>
        s.nomeCliente?.toLowerCase().includes(q) ||
        s.emailCliente?.toLowerCase().includes(q) ||
        s.cpfCnpjCliente?.includes(q) ||
        s.ramo?.toLowerCase().includes(q) ||
        s.status?.toLowerCase().includes(q) ||
        s.seguradora?.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map(s => ({ id: s.id, tipo: 'Seg. Novo', nome: s.nomeCliente, detalhe: `${s.ramo} · ${s.inicioVigencia}`, route: '/seguros-novos' }));

    return [...rv, ...sn].slice(0, 8);
  })();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!inputRef.current?.parentElement?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-4 sticky top-0 z-30 shrink-0">
      <div className="flex-1 relative max-w-md" ref={inputRef as React.RefObject<HTMLDivElement>}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
        <input
          type="text"
          placeholder="Buscar clientes, renovações, seguros..."
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {open && results.length > 0 && (
          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
            {results.map(item => (
              <button
                key={`${item.tipo}-${item.id}`}
                onMouseDown={() => { navigate(item.route); setOpen(false); setSearch(''); }}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0 flex items-center gap-3"
              >
                <span className="text-xs bg-blue-100 text-blue-700 font-medium px-1.5 py-0.5 rounded shrink-0">{item.tipo}</span>
                <div>
                  <div className="font-medium text-gray-800">{item.nome}</div>
                  <div className="text-xs text-gray-400">{item.detalhe}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
        <Bell size={17} />
      </button>

      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-blue-700 text-white flex items-center justify-center text-sm font-bold shrink-0">
          {usuario?.nome?.charAt(0).toUpperCase()}
        </div>
        <div className="text-right hidden sm:block">
          <div className="text-sm font-medium text-gray-800 leading-tight">{usuario?.nome}</div>
          <div className="text-xs text-gray-500">{ROLE_LABELS[usuario?.role ?? '']}</div>
        </div>
      </div>

      <button
        onClick={() => { logout(); navigate('/login'); }}
        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        title="Sair"
      >
        <LogOut size={17} />
      </button>
    </header>
  );
}
