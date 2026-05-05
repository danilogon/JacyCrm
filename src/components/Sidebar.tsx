import { useState, useMemo } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, RefreshCw, PlusCircle, Target, Users, Settings,
  UserCog, Shield, ChevronLeft, ChevronRight, ChevronDown, Briefcase, DollarSign, TrendingUp, Factory, CalendarCheck, BookOpen,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Tarefa } from '../types';

const DASHBOARD_PATHS = ['/dashboard', '/metas', '/comissoes', '/producao'];
const NEGOCIOS_PATHS  = ['/renovacoes', '/seguros-novos', '/prospeccao', '/consulta-renovacoes'];

export function Sidebar({ tarefas }: { tarefas: Tarefa[] }) {
  const { usuario } = useAuth();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );
  const [dashboardOpen, setDashboardOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_dashboard_open');
    if (saved !== null) return saved === 'true';
    return DASHBOARD_PATHS.some(p => location.pathname.startsWith(p));
  });
  const [negociosOpen, setNegociosOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_negocios_open');
    if (saved !== null) return saved === 'true';
    return NEGOCIOS_PATHS.some(p => location.pathname.startsWith(p));
  });

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
    if (next) { setDashboardOpen(false); setNegociosOpen(false); }
  }

  function toggleDashboard() {
    const next = !dashboardOpen;
    setDashboardOpen(next);
    localStorage.setItem('sidebar_dashboard_open', String(next));
  }

  function toggleNegocios() {
    const next = !negociosOpen;
    setNegociosOpen(next);
    localStorage.setItem('sidebar_negocios_open', String(next));
  }

  // Conta tarefas pendentes do usuário atual para o badge
  const tarefasPendentes = useMemo(() => {
    if (!usuario) return 0;
    return tarefas.filter(t =>
      t.status === 'pendente' &&
      (usuario.role !== 'usuario' || t.responsavelId === usuario.id)
    ).length;
  }, [tarefas, usuario]);

  if (!usuario) return null;

  const dashboardSublinks = [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard',               show: usuario.role === 'admin' || usuario.role === 'gestor' || (usuario.visualizarDashboard ?? true) },
    { to: '/producao',  icon: Factory,         label: 'Produção',                show: usuario.role === 'admin' || usuario.role === 'gestor' || (usuario.visualizarProducao ?? false) },
    { to: '/metas',     icon: TrendingUp,      label: 'Metas',                   show: usuario.role === 'admin' || usuario.role === 'gestor' || (usuario.visualizarMetas ?? true) },
    { to: '/comissoes', icon: DollarSign,      label: 'Comissões a Pagar',       show: usuario.role === 'admin' || (usuario.visualizarComissoes ?? false) },
  ];

  const negociosSublinks = [
    { to: '/renovacoes',    icon: RefreshCw,  label: 'Renovações',    show: usuario.role !== 'usuario' || usuario.acessoRenovacoes },
    { to: '/seguros-novos', icon: PlusCircle, label: 'Seguros Novos', show: usuario.role !== 'usuario' || usuario.acessoSegurosNovos },
    { to: '/prospeccao',    icon: Target,     label: 'Prospecção',    show: usuario.role !== 'usuario' || (usuario.acessoProspeccao ?? true) },
    { to: '/consulta-renovacoes', icon: BookOpen, label: 'Consulta Renovações', show: usuario.role === 'admin' || usuario.role === 'gestor' || (usuario.acessoConsultaRenovacoes ?? false) },
  ];

  const dashboardAtivo = DASHBOARD_PATHS.some(p => location.pathname.startsWith(p));
  const negociosAtivo  = NEGOCIOS_PATHS.some(p => location.pathname.startsWith(p));

  const bottomLinks = [
    { to: '/tarefas',       icon: CalendarCheck, label: 'Tarefas',       show: true, badge: tarefasPendentes },
    { to: '/clientes',      icon: Users,         label: 'Clientes',      show: true, badge: 0 },
    { to: '/usuarios',      icon: UserCog,       label: 'Usuários',      show: usuario.role === 'admin', badge: 0 },
    { to: '/configuracoes', icon: Settings,      label: 'Configurações', show: usuario.role === 'admin', badge: 0 },
  ];

  const linkClass = (isActive: boolean, extra = '') =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${extra} ${
      isActive
        ? 'bg-blue-700 text-white'
        : 'text-blue-300 hover:bg-blue-900 hover:text-white'
    }`;

  return (
    <aside className={`${collapsed ? 'w-14' : 'w-60'} bg-blue-950 text-white flex flex-col min-h-screen shrink-0 transition-all duration-200`}>

      {/* Logo + Toggle */}
      <div className={`border-b border-blue-900 flex items-center ${collapsed ? 'flex-col gap-3 py-4 px-2' : 'p-4 gap-2'}`}>
        {collapsed ? (
          <>
            <button
              onClick={toggle}
              title="Expandir menu"
              className="p-1.5 rounded-lg text-blue-400 hover:text-white hover:bg-blue-800 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <Shield size={20} className="text-blue-300" />
          </>
        ) : (
          <>
            <Shield size={20} className="text-blue-300 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-bold tracking-wide">Segura Mais</div>
              <div className="text-blue-400 text-xs">Gestão de Produção</div>
            </div>
            <button
              onClick={toggle}
              title="Recolher menu"
              className="p-1.5 rounded-lg text-blue-400 hover:text-white hover:bg-blue-800 transition-colors shrink-0"
            >
              <ChevronLeft size={16} />
            </button>
          </>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 space-y-0.5">

        {/* Grupo Dashboard */}
        {(collapsed ? (
          <div className="space-y-0.5">
            {dashboardSublinks.filter(l => l.show).map(({ to, icon: Icon, label }) => (
              <NavLink key={to} to={to} title={label}
                className={({ isActive }) =>
                  `flex items-center justify-center px-3 py-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-700 text-white' : 'text-blue-300 hover:bg-blue-900 hover:text-white'
                  }`}
              >
                <Icon size={17} className="shrink-0" />
              </NavLink>
            ))}
          </div>
        ) : (
          <div>
            <button onClick={toggleDashboard}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                dashboardAtivo ? 'text-white bg-blue-800/60' : 'text-blue-300 hover:bg-blue-900 hover:text-white'
              }`}>
              <div className="flex items-center gap-3">
                <LayoutDashboard size={17} className="shrink-0" />
                <span>Dashboard</span>
              </div>
              <ChevronDown size={14}
                className={`shrink-0 transition-transform duration-200 ${dashboardOpen ? 'rotate-180' : ''}`} />
            </button>
            {dashboardOpen && (
              <div className="mt-0.5 ml-3 pl-3 border-l border-blue-800 space-y-0.5">
                {dashboardSublinks.filter(l => l.show).map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-blue-700 text-white' : 'text-blue-400 hover:bg-blue-900 hover:text-white'
                      }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Grupo Negócios */}
        {negociosSublinks.some(l => l.show) && (
          <div>
            <button
              onClick={collapsed ? undefined : toggleNegocios}
              title={collapsed ? 'Negócios' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                collapsed ? 'justify-center' : 'justify-between'
              } ${
                negociosAtivo && collapsed
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-300 hover:bg-blue-900 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Briefcase size={17} className="shrink-0" />
                {!collapsed && <span>Negócios</span>}
              </div>
              {!collapsed && (
                <ChevronDown size={14}
                  className={`shrink-0 transition-transform duration-200 ${negociosOpen ? 'rotate-180' : ''}`} />
              )}
            </button>

            {!collapsed && negociosOpen && (
              <div className="mt-0.5 ml-3 pl-3 border-l border-blue-800 space-y-0.5">
                {negociosSublinks.filter(l => l.show).map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive ? 'bg-blue-700 text-white' : 'text-blue-400 hover:bg-blue-900 hover:text-white'
                      }`}
                  >
                    <Icon size={15} className="shrink-0" />
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            )}

            {collapsed && (
              <div className="space-y-0.5 mt-0.5">
                {negociosSublinks.filter(l => l.show).map(({ to, icon: Icon, label }) => (
                  <NavLink key={to} to={to} title={label}
                    className={({ isActive }) =>
                      `flex items-center justify-center px-3 py-2 rounded-lg text-sm transition-colors ${
                        isActive ? 'bg-blue-700 text-white' : 'text-blue-400 hover:bg-blue-900 hover:text-white'
                      }`}
                  >
                    <Icon size={15} className="shrink-0" />
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Divisor visual */}
        <div className="py-1">
          <div className="border-t border-blue-900/60" />
        </div>

        {/* Links do rodapé (Tarefas, Clientes, Usuários, Configurações) */}
        {bottomLinks.filter(l => l.show).map(({ to, icon: Icon, label, badge }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? label : undefined}
            className={({ isActive }) => linkClass(isActive, collapsed ? 'justify-center' : '')}
          >
            <div className="relative shrink-0">
              <Icon size={17} />
              {badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </div>
            {!collapsed && <span className="flex-1">{label}</span>}
            {!collapsed && badge > 0 && (
              <span className="ml-auto min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-xs font-bold rounded-full">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </NavLink>
        ))}

      </nav>

      {/* Versão */}
      {!collapsed && (
        <div className="border-t border-blue-900 px-4 py-3">
          <span className="text-xs text-blue-500">v1.0.0 · Segura Mais</span>
        </div>
      )}
    </aside>
  );
}
