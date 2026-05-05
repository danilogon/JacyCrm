import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Usuario } from '../types';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type LoginResult =
  | { ok: true; perfil: Usuario }
  | { erro: string }
  | { requires2FA: true; perfil: Usuario };

interface AuthContextType {
  usuario: Usuario | null;
  authLoading: boolean;
  login: (email: string, senha: string) => Promise<LoginResult>;
  completarLogin: (u: Usuario) => void;
  logout: () => Promise<void>;
  updateUsuario: (u: Usuario) => void;
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  authLoading: true,
  login: async () => ({ erro: 'Contexto não inicializado' }),
  completarLogin: () => {},
  logout: async () => {},
  updateUsuario: () => {},
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toCamel(s: string) {
  return s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** Busca o perfil do usuário logado na tabela `usuarios` via auth_uid. */
async function fetchPerfil(): Promise<Usuario | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_uid', user.id)
    .single();

  if (error || !data) return null;

  // snake_case → camelCase
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(data as Record<string, unknown>)) {
    out[toCamel(k)] = (data as Record<string, unknown>)[k];
  }
  return out as unknown as Usuario;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario,     setUsuario]     = useState<Usuario | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Restaura sessão ao montar (page refresh, aba nova)
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const perfil = await fetchPerfil();
        setUsuario(perfil);
      }
      setAuthLoading(false);
    });

    // Reage a logout e renovação de token
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        setUsuario(null);
      }
      // TOKEN_REFRESHED: perfil já está em memória, não precisa re-buscar
    });

    return () => subscription.unsubscribe();
  }, []);

  /**
   * Autentica com Supabase Auth e retorna o perfil.
   * Não define `usuario` no contexto — isso fica a cargo de `completarLogin()`
   * para permitir que Login.tsx aplique as verificações de horário e 2FA antes.
   */
  const login = useCallback(async (email: string, senha: string): Promise<LoginResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: senha });

    if (error) {
      // Mensagem genérica — não revela se o email existe ou não
      return { erro: 'Email ou senha inválidos.' };
    }

    const perfil = await fetchPerfil();
    if (!perfil) {
      // Autenticou no Auth mas não tem registro em `usuarios` (usuário não migrado)
      await supabase.auth.signOut();
      return { erro: 'Usuário não encontrado. Contate o administrador.' };
    }

    if (!perfil.ativo) {
      await supabase.auth.signOut();
      return { erro: 'Usuário inativo. Contate o administrador.' };
    }

    return { ok: true, perfil };
  }, []);

  /** Finaliza o login após 2FA ou após verificação de horário — define o usuario no contexto. */
  const completarLogin = useCallback((u: Usuario) => {
    setUsuario(u);
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange SIGNED_OUT vai setar usuario = null
  }, []);

  const updateUsuario = useCallback((u: Usuario) => {
    setUsuario(u);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, authLoading, login, completarLogin, logout, updateUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
