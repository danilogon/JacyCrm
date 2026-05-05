import React, { createContext, useContext, useState, useCallback } from 'react';
import type { Usuario } from '../types';

interface AuthContextType {
  usuario: Usuario | null;
  login: (email: string, senha: string, usuarios: Usuario[]) => boolean;
  logout: () => void;
  updateUsuario: (u: Usuario) => void;
}

const AuthContext = createContext<AuthContextType>({
  usuario: null,
  login: () => false,
  logout: () => {},
  updateUsuario: () => {},
});

/** Campos do Usuario que são seguros para persistir no localStorage (sem senha). */
function toSafeSession(u: Usuario): Omit<Usuario, 'senha'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { senha: _senha, ...safe } = u as Usuario & { senha?: string };
  return safe as Omit<Usuario, 'senha'>;
}

/** Restaura a sessão do localStorage; rejeita silenciosamente dados corrompidos. */
function restoreSession(): Usuario | null {
  try {
    const raw = localStorage.getItem('usuario_logado');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Garante que o objeto tem ao menos id e role (sessões antigas podem ter campos extras)
    if (!parsed?.id || !parsed?.role) return null;
    // Remove senha caso exista em sessões salvas antes desta versão
    delete parsed.senha;
    return parsed as Usuario;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(restoreSession);

  const login = useCallback((email: string, senha: string, usuarios: Usuario[]) => {
    const found = usuarios.find(u => u.email === email && u.senha === senha && u.ativo);
    if (found) {
      setUsuario(found);
      // Persiste apenas campos não-sensíveis
      localStorage.setItem('usuario_logado', JSON.stringify(toSafeSession(found)));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUsuario(null);
    localStorage.removeItem('usuario_logado');
  }, []);

  const updateUsuario = useCallback((u: Usuario) => {
    setUsuario(u);
    localStorage.setItem('usuario_logado', JSON.stringify(toSafeSession(u)));
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, updateUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
