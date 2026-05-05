import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Renovacoes } from './pages/Renovacoes';
import { SeguroNovos } from './pages/SeguroNovos';
import { ProspeccaoPage } from './pages/Prospeccao';
import { Clientes } from './pages/Clientes';
import { Usuarios } from './pages/Usuarios';
import { Configuracoes } from './pages/Configuracoes';
import { Comissoes } from './pages/Comissoes';
import { MetasAcompanhamento } from './pages/MetasAcompanhamento';
import { DashboardProducao } from './pages/DashboardProducao';
import { Tarefas } from './pages/Tarefas';
import { ConsultaRenovacoes } from './pages/ConsultaRenovacoes';
import { fetchAll, db } from './lib/db';
import type {
  Renovacao, SeguroNovo, Prospeccao, Cliente, Usuario, Seguradora, Ramo,
  ConfiguracoesMetas, MotivoPerda, CampoCustomizavel, ConfiguracaoEmpresa, TipoUsuario, Tarefa, OrigemProspeccao,
} from './types';

// ─── Helper: cria um setter que sincroniza listas com o Supabase ─────────────
//
// Estratégia:
//  • Itens removidos da lista → DELETE no banco
//  • Todos os itens da nova lista → UPSERT (simples, sem detecção de diff)
// Para um CRM de porte pequeno esse overhead é aceitável e garante consistência.

function makeSyncer<T extends { id: string }>(
  setState: React.Dispatch<React.SetStateAction<T[]>>,
  upsertFn: (items: T[]) => void,
  deleteFn: (ids: string[]) => void,
) {
  return (newItems: T[]) => {
    setState(prev => {
      const prevIds = new Set(prev.map(i => i.id));
      const newIds  = new Set(newItems.map(i => i.id));

      // IDs que sumiram da lista → deletar no banco
      const deletedIds = [...prevIds].filter(id => !newIds.has(id));
      if (deletedIds.length) deleteFn(deletedIds);

      // Upsert todos (insere novos + atualiza existentes)
      if (newItems.length) upsertFn(newItems);

      return newItems;
    });
  };
}

// ─── Tela de carregamento ────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 text-sm font-medium">Carregando dados...</p>
      </div>
    </div>
  );
}

// ─── Tela de erro de conexão ─────────────────────────────────────────────────

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow p-8 max-w-sm w-full text-center">
        <div className="text-red-500 text-4xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Falha ao conectar</h2>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

// ─── Rotas e estado principal ────────────────────────────────────────────────

function AppRoutes() {
  const { usuario } = useAuth();

  // Controle de carregamento
  const [loading,   setLoading]   = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Estado local (espelho do banco)
  const [usuarios,     setUsuariosState]     = useState<Usuario[]>([]);
  const [renovacoes,   setRenovacoesState]   = useState<Renovacao[]>([]);
  const [segurosNovos, setSegurosNovosState] = useState<SeguroNovo[]>([]);
  const [prospeccoes,  setProspeccoesState]  = useState<Prospeccao[]>([]);
  const [clientes,     setClientesState]     = useState<Cliente[]>([]);
  const [seguradoras,  setSeguradorasState]  = useState<Seguradora[]>([]);
  const [ramos,        setRamosState]        = useState<Ramo[]>([]);
  const [metas,        setMetasState]        = useState<ConfiguracoesMetas>({ planosRenovacao: [], planosSeguroNovo: [] });
  const [motivos,      setMotivosState]      = useState<MotivoPerda[]>([]);
  const [campos,       setCamposState]       = useState<CampoCustomizavel[]>([]);
  const [empresa,      setEmpresaState]      = useState<ConfiguracaoEmpresa>({ nome: 'Segura Mais', logoUrl: '', corPrimaria: '#1e40af', corSecundaria: '#1d4ed8' });
  const [tiposUsuario, setTiposUsuarioState] = useState<TipoUsuario[]>([]);
  const [tarefas,      setTarefasState]      = useState<Tarefa[]>([]);
  const [origensProspeccao, setOrigensProspeccaoState] = useState<OrigemProspeccao[]>([]);

  // Carrega todos os dados ao montar
  useEffect(() => {
    fetchAll()
      .then(data => {
        setUsuariosState(data.usuarios);
        setSeguradorasState(data.seguradoras);
        setRamosState(data.ramos);
        setMotivosState(data.motivos);
        setCamposState(data.campos);
        setMetasState(data.metas);
        setEmpresaState(data.empresa);
        setClientesState(data.clientes);
        setRenovacoesState(data.renovacoes);
        setSegurosNovosState(data.segurosNovos);
        setProspeccoesState(data.prospeccoes);
        setTarefasState(data.tarefas);
        setTiposUsuarioState(data.tiposUsuario);
        setOrigensProspeccaoState(data.origensProspeccao);
        setLoading(false);
      })
      .catch((err: Error) => {
        console.error('[App] fetchAll falhou:', err);
        setLoadError(err.message || 'Erro desconhecido ao carregar os dados.');
        setLoading(false);
      });
  }, []);

  // ── Setters sincronizados com Supabase ──────────────────────────────────────

  const setUsuarios = useCallback(
    makeSyncer(setUsuariosState, db.upsertUsuarios, db.deleteUsuarios), []);

  const setRenovacoes = useCallback(
    makeSyncer(setRenovacoesState, db.upsertRenovacoes, db.deleteRenovacoes), []);

  const setSegurosNovos = useCallback(
    makeSyncer(setSegurosNovosState, db.upsertSegurosNovos, db.deleteSegurosNovos), []);

  const setProspeccoes = useCallback(
    makeSyncer(setProspeccoesState, db.upsertProspeccoes, db.deleteProspeccoes), []);

  const setClientes = useCallback(
    makeSyncer(setClientesState, db.upsertClientes, db.deleteClientes), []);

  const setSeguradoras = useCallback(
    makeSyncer(setSeguradorasState, db.upsertSeguradoras, db.deleteSeguradoras), []);

  const setRamos = useCallback(
    makeSyncer(setRamosState, db.upsertRamos, db.deleteRamos), []);

  const setMotivos = useCallback(
    makeSyncer(setMotivosState, db.upsertMotivos, db.deleteMotivos), []);

  const setCampos = useCallback(
    makeSyncer(setCamposState, db.upsertCampos, db.deleteCampos), []);

  const setTiposUsuario = useCallback(
    makeSyncer(setTiposUsuarioState, db.upsertTiposUsuario, db.deleteTiposUsuario), []);

  const setOrigensProspeccao = useCallback(
    makeSyncer(setOrigensProspeccaoState, db.upsertOrigensProspeccao, db.deleteOrigensProspeccao), []);

  const setTarefas = useCallback(
    makeSyncer(setTarefasState, db.upsertTarefas, db.deleteTarefas), []);

  // Singletons (metas e empresa)
  const setMetas = useCallback((newMetas: ConfiguracoesMetas) => {
    setMetasState(newMetas);
    db.upsertMetas(newMetas).catch((err: Error) => {
      alert('Erro ao salvar as configurações de metas: ' + err.message);
    });
  }, []);

  const setEmpresa = useCallback(async (newEmpresa: ConfiguracaoEmpresa) => {
    setEmpresaState(newEmpresa);
    await db.upsertEmpresa(newEmpresa);
  }, []);

  // ── Renderização ────────────────────────────────────────────────────────────

  if (loading)   return <LoadingScreen />;
  if (loadError) return <ErrorScreen message={loadError} />;

  const motivosRenovacao  = motivos.filter(m => m.tipo === 'negocio'    && m.aplicaRenovacoes);
  const motivosSeguroNovo = motivos.filter(m => m.tipo === 'negocio'    && m.aplicaSegurosNovos);

  if (!usuario) {
    return (
      <Routes>
        <Route path="/login" element={<Login usuarios={usuarios} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const podeRenovacoes           = usuario.role !== 'usuario' || usuario.acessoRenovacoes;
  const podeSegurosNovos         = usuario.role !== 'usuario' || usuario.acessoSegurosNovos;
  const podeProspeccao           = usuario.role !== 'usuario' || (usuario.acessoProspeccao ?? true);
  const podeDescartarProspeccao  = usuario.role === 'admin' || usuario.role === 'gestor' || (usuario.podeDescartarProspeccao ?? false);
  const podeConsultarRenovacoes = usuario.role === 'admin' || usuario.role === 'gestor' || (usuario.acessoConsultaRenovacoes ?? false);
  const podeVerDashboard         = usuario.role === 'admin' || usuario.role === 'gestor' || (usuario.visualizarDashboard ?? true);
  const podeVerProducao          = usuario.role === 'admin' || usuario.role === 'gestor' || (usuario.visualizarProducao ?? false);
  const podeVerMetas             = usuario.role === 'admin' || usuario.role === 'gestor' || (usuario.visualizarMetas ?? true);
  const podeVerComissoes         = usuario.role === 'admin' || (usuario.visualizarComissoes ?? false);

  return (
    <Routes>
      <Route element={<Layout renovacoes={renovacoes} segurosNovos={segurosNovos} tarefas={tarefas} />}>

        {podeVerMetas && (
          <Route path="/metas" element={
            <MetasAcompanhamento
              renovacoes={renovacoes}
              segurosNovos={segurosNovos}
              usuarios={usuarios}
              ramos={ramos}
              motivos={motivos}
              metas={metas}
            />
          } />
        )}

        {podeVerDashboard && (
          <Route path="/dashboard" element={
            <Dashboard
              renovacoes={renovacoes}
              segurosNovos={segurosNovos}
              usuarios={usuarios}
              ramos={ramos}
              motivos={motivos}
              metas={metas}
            />
          } />
        )}

        {podeVerProducao && (
          <Route path="/producao" element={
            <DashboardProducao
              segurosNovos={segurosNovos}
              renovacoes={renovacoes}
              prospeccoes={prospeccoes}
              ramos={ramos}
              seguradoras={seguradoras}
              motivos={motivos}
              usuarios={usuarios}
              origensProspeccao={origensProspeccao}
            />
          } />
        )}

        {podeRenovacoes && (
          <Route path="/renovacoes" element={
            <Renovacoes
              renovacoes={renovacoes}
              setRenovacoes={setRenovacoes}
              prospeccoes={prospeccoes}
              setProspeccoes={setProspeccoes}
              usuarios={usuarios}
              seguradoras={seguradoras}
              ramos={ramos}
              motivos={motivosRenovacao}
              camposCustomizaveis={campos}
              clientes={clientes}
              setClientes={setClientes}
              tarefas={tarefas}
              setTarefas={setTarefas}
            />
          } />
        )}

        {podeSegurosNovos && (
          <Route path="/seguros-novos" element={
            <SeguroNovos
              segurosNovos={segurosNovos}
              setSegurosNovos={setSegurosNovos}
              prospeccoes={prospeccoes}
              setProspeccoes={setProspeccoes}
              usuarios={usuarios}
              seguradoras={seguradoras}
              ramos={ramos}
              motivos={motivosSeguroNovo}
              camposCustomizaveis={campos}
              clientes={clientes}
              setClientes={setClientes}
              tarefas={tarefas}
              setTarefas={setTarefas}
              origensNegocio={origensProspeccao}
            />
          } />
        )}

        {podeProspeccao && (
          <Route path="/prospeccao" element={
            <ProspeccaoPage
              prospeccoes={prospeccoes}
              setProspeccoes={setProspeccoes}
              segurosNovos={segurosNovos}
              setSegurosNovos={setSegurosNovos}
              clientes={clientes}
              setClientes={setClientes}
              usuarios={usuarios}
              seguradoras={seguradoras}
              ramos={ramos}
              motivos={motivos.filter(m => m.tipo === 'prospeccao')}
              tarefas={tarefas}
              setTarefas={setTarefas}
              podeDescartar={podeDescartarProspeccao}
              origensProspeccao={origensProspeccao}
            />
          } />
        )}

        {podeConsultarRenovacoes && (
          <Route path="/consulta-renovacoes" element={
            <ConsultaRenovacoes
              renovacoes={renovacoes}
              usuarios={usuarios}
            />
          } />
        )}

        <Route path="/tarefas" element={
          <Tarefas
            tarefas={tarefas}
            setTarefas={setTarefas}
            usuarios={usuarios}
          />
        } />

        <Route path="/clientes" element={
          <Clientes
            clientes={clientes}
            setClientes={setClientes}
            renovacoes={renovacoes}
            segurosNovos={segurosNovos}
            usuarios={usuarios}
          />
        } />

        {podeVerComissoes && (
          <Route path="/comissoes" element={
            <Comissoes
              renovacoes={renovacoes}
              segurosNovos={segurosNovos}
              usuarios={usuarios}
              ramos={ramos}
              motivos={motivos}
              metas={metas}
            />
          } />
        )}

        {usuario.role === 'admin' && (
          <Route path="/usuarios" element={
            <Usuarios
              usuarios={usuarios}
              setUsuarios={setUsuarios}
              metas={metas}
              tiposUsuario={tiposUsuario}
            />
          } />
        )}

        {usuario.role === 'admin' && (
          <Route path="/configuracoes" element={
            <Configuracoes
              seguradoras={seguradoras}
              setSeguradoras={setSeguradoras}
              ramos={ramos}
              setRamos={setRamos}
              metas={metas}
              setMetas={setMetas}
              motivos={motivos}
              setMotivos={setMotivos}
              campos={campos}
              setCampos={setCampos}
              empresa={empresa}
              setEmpresa={setEmpresa}
              tiposUsuario={tiposUsuario}
              setTiposUsuario={setTiposUsuario}
              origensProspeccao={origensProspeccao}
              setOrigensProspeccao={setOrigensProspeccao}
            />
          } />
        )}

        <Route path="/"  element={<Navigate to="/dashboard" replace />} />
        <Route path="*"  element={<Navigate to="/dashboard" replace />} />
      </Route>

      <Route path="/login" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

// ─── App root ────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
