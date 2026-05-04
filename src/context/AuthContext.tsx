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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    try {
      const saved = localStorage.getItem('usuario_logado');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const login = useCallback((email: string, senha: string, usuarios: Usuario[]) => {
    const found = usuarios.find(u => u.email === email && u.senha === senha && u.ativo);
    if (found) {
      setUsuario(found);
      localStorage.setItem('usuario_logado', JSON.stringify(found));
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
    localStorage.setItem('usuario_logado', JSON.stringify(u));
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
