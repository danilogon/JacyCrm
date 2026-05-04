import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Usuario } from '../types';

interface Props { usuarios: Usuario[]; }

function getFirstRoute(u: Usuario): string {
  if (u.role === 'admin' || u.role === 'gestor') return '/dashboard';
  if (u.acessoRenovacoes) return '/renovacoes';
  if (u.acessoSegurosNovos) return '/seguros-novos';
  return '/clientes';
}

export function Login({ usuarios }: Props) {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (usuario) navigate(getFirstRoute(usuario), { replace: true });
  }, [usuario, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    const ok = login(email, senha, usuarios);
    if (ok) {
      const u = usuarios.find(x => x.email === email)!;
      navigate(getFirstRoute(u));
    } else {
      setErro('Email ou senha inválidos.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-700 rounded-2xl mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <div className="text-2xl font-bold text-gray-900">Segura Mais</div>
          <div className="text-gray-500 text-sm mt-1">Gestão de Produção</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
              placeholder="seu@email.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
            <input
              type="password"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              required
              placeholder="••••••"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          {erro && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
              {erro}
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-60 text-sm"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center mb-3">Usuários demo (senha: 123456)</p>
          <div className="space-y-1">
            {[
              { email: 'ana@empresa.com', label: 'Ana Oliveira — Admin' },
              { email: 'carlos@empresa.com', label: 'Carlos Gestor — Gestor' },
              { email: 'joao@empresa.com', label: 'João Silva — Usuário' },
            ].map(u => (
              <button
                key={u.email}
                type="button"
                onClick={() => { setEmail(u.email); setSenha('123456'); }}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
