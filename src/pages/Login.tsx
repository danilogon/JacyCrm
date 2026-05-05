import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Clock, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { enviarCodigo2FA, gerarCodigo, emailJsConfigurado } from '../lib/email';
import type { Usuario } from '../types';

type Fase = 'credenciais' | 'verificacao';

interface PendingLogin {
  usuario: Usuario;
  codigo: string;
  expira: Date;
}

function getFirstRoute(u: Usuario): string {
  if (u.role === 'admin' || u.role === 'gestor') return '/dashboard';
  if (u.acessoRenovacoes) return '/renovacoes';
  if (u.acessoSegurosNovos) return '/seguros-novos';
  return '/clientes';
}

/** Verifica se o horário atual está dentro da janela permitida */
function dentroDoHorario(u: Usuario): boolean {
  if (!u.horarioLoginInicio || !u.horarioLoginFim) return true;
  const now   = new Date();
  const atual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return atual >= u.horarioLoginInicio && atual <= u.horarioLoginFim;
}

const fmtHora = (h: string) => h.replace(':', 'h');

export function Login() {
  const { login, completarLogin, usuario } = useAuth();
  const navigate = useNavigate();

  const [fase,    setFase]    = useState<Fase>('credenciais');
  const [email,   setEmail]   = useState('');
  const [senha,   setSenha]   = useState('');
  const [erro,    setErro]    = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingLogin | null>(null);

  // Seis caixas de dígito para o código 2FA
  const [digitos, setDigitos] = useState(['', '', '', '', '', '']);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Contador de reenvio (segundos)
  const [reenvioSeg, setReenvioSeg] = useState(0);
  useEffect(() => {
    if (reenvioSeg <= 0) return;
    const t = setTimeout(() => setReenvioSeg(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [reenvioSeg]);

  useEffect(() => {
    if (usuario) navigate(getFirstRoute(usuario), { replace: true });
  }, [usuario, navigate]);

  // ── Fase 1: validar credenciais ────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    const result = await login(email, senha);

    if ('erro' in result) {
      setErro(result.erro);
      setLoading(false);
      return;
    }

    const perfil = result.perfil;

    // Restrição de horário — se fora do horário, encerra sessão no Supabase
    if (!dentroDoHorario(perfil)) {
      await supabase.auth.signOut();
      const ini = fmtHora(perfil.horarioLoginInicio!);
      const fim = fmtHora(perfil.horarioLoginFim!);
      setErro(`Acesso permitido somente das ${ini} às ${fim}.`);
      setLoading(false);
      return;
    }

    // 2FA ativado e EmailJS configurado → enviar código
    if (perfil.exigir2FA && emailJsConfigurado()) {
      const codigo = gerarCodigo();
      const expira = new Date(Date.now() + 5 * 60 * 1000);
      try {
        await enviarCodigo2FA({ email: perfil.email, nome: perfil.nome, codigo });
        setPending({ usuario: perfil, codigo, expira });
        setDigitos(['', '', '', '', '', '']);
        setFase('verificacao');
        setReenvioSeg(60);
        setTimeout(() => inputsRef.current[0]?.focus(), 100);
      } catch {
        // Falha no envio do código — encerra sessão para não deixar autenticado sem 2FA
        await supabase.auth.signOut();
        setErro('Não foi possível enviar o código. Verifique a configuração do EmailJS.');
      }
      setLoading(false);
      return;
    }

    // Sem 2FA → login direto
    completarLogin(perfil);
    navigate(getFirstRoute(perfil));
    setLoading(false);
  };

  // ── Fase 2: verificar código ───────────────────────────────

  const handleDigito = (idx: number, val: string) => {
    const d    = val.replace(/\D/g, '').slice(-1);
    const next = [...digitos];
    next[idx]  = d;
    setDigitos(next);
    setErro('');
    if (d && idx < 5) inputsRef.current[idx + 1]?.focus();
    if (idx === 5 && d) verificarCodigo(next.join(''));
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digitos[idx] && idx > 0)
      inputsRef.current[idx - 1]?.focus();
  };

  const verificarCodigo = (codigo: string) => {
    if (!pending) return;
    if (new Date() > pending.expira) {
      setErro('Código expirado. Solicite um novo.');
      return;
    }
    if (codigo !== pending.codigo) {
      setErro('Código inválido. Tente novamente.');
      setDigitos(['', '', '', '', '', '']);
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
      return;
    }
    completarLogin(pending.usuario);
    navigate(getFirstRoute(pending.usuario));
  };

  const handleReenviar = async () => {
    if (!pending || reenvioSeg > 0) return;
    const codigo = gerarCodigo();
    const expira = new Date(Date.now() + 5 * 60 * 1000);
    setErro('');
    try {
      await enviarCodigo2FA({ email: pending.usuario.email, nome: pending.usuario.nome, codigo });
      setPending({ ...pending, codigo, expira });
      setDigitos(['', '', '', '', '', '']);
      setReenvioSeg(60);
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
    } catch {
      setErro('Falha ao reenviar. Tente novamente.');
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">

        {/* Cabeçalho */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-700 rounded-2xl mb-4">
            {fase === 'verificacao'
              ? <Mail size={28} className="text-white" />
              : <Shield size={28} className="text-white" />}
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {fase === 'verificacao' ? 'Verificação' : 'SmartCor'}
          </div>
          <div className="text-gray-500 text-sm mt-1">
            {fase === 'verificacao'
              ? `Código enviado para ${email}`
              : 'Gestão de Produção'}
          </div>
        </div>

        {/* ── Fase 1: credenciais ───────────────── */}
        {fase === 'credenciais' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus placeholder="seu@email.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password" value={senha} onChange={e => setSenha(e.target.value)}
                required placeholder="••••••"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            {erro && <MsgErro texto={erro} />}
            <button
              type="submit" disabled={loading}
              className="w-full py-2.5 bg-blue-700 text-white rounded-lg font-medium hover:bg-blue-800 transition-colors disabled:opacity-60 text-sm"
            >
              {loading ? 'Aguarde...' : 'Entrar'}
            </button>
          </form>
        )}

        {/* ── Fase 2: código 2FA ────────────────── */}
        {fase === 'verificacao' && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 text-center">
              Digite o código de 6 dígitos enviado ao seu e-mail.{' '}
              <span className="font-medium text-gray-700">Válido por 5 minutos.</span>
            </p>

            {/* Seis caixas */}
            <div className="flex gap-2 justify-center">
              {digitos.map((d, i) => (
                <input
                  key={i}
                  ref={el => { inputsRef.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1} value={d}
                  onChange={e => handleDigito(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(i, e)}
                  className="w-10 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg
                             focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-colors"
                />
              ))}
            </div>

            {erro && <MsgErro texto={erro} />}

            {/* Reenviar */}
            <div className="text-center">
              {reenvioSeg > 0 ? (
                <div className="flex items-center justify-center gap-1.5 text-sm text-gray-400">
                  <Clock size={14} />
                  Reenviar em {reenvioSeg}s
                </div>
              ) : (
                <button
                  onClick={handleReenviar}
                  className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 mx-auto transition-colors"
                >
                  <RefreshCw size={14} />
                  Reenviar código
                </button>
              )}
            </div>

            <button
              onClick={() => { setFase('credenciais'); setErro(''); setPending(null); }}
              className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Voltar ao login
            </button>
          </div>
        )}

        {/* Usuários demo */}
        {fase === 'credenciais' && (
          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 text-center mb-3">Usuários demo (senha: 123456)</p>
            <div className="space-y-1">
              {[
                { email: 'ana@empresa.com',    label: 'Ana Oliveira — Admin'   },
                { email: 'carlos@empresa.com', label: 'Carlos Gestor — Gestor' },
                { email: 'joao@empresa.com',   label: 'João Silva — Usuário'   },
              ].map(u => (
                <button key={u.email} type="button"
                  onClick={() => { setEmail(u.email); setSenha('123456'); }}
                  className="w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 rounded transition-colors"
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MsgErro({ texto }: { texto: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
      {texto}
    </div>
  );
}
