import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, User, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { LogIn, Loader2 } from 'lucide-react';

export default function Layout() {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [authError, setAuthError] = React.useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    // Safety timeout to avoid infinite loading if Firebase doesn't respond
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        setLoading(false);
        setAuthError("Tempo de carregamento esgotado. Verifique sua conexão.");
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (mounted) {
        setUser(user);
        setLoading(false);
        clearTimeout(timeout);
      }
    }, (error) => {
      console.error("Auth state error", error);
      if (mounted) {
        setLoading(false);
        setAuthError("Erro ao verificar autenticação.");
        clearTimeout(timeout);
      }
    });

    // Check for redirect result only after mount
    getRedirectResult(auth)
      .then((result) => {
        if (result && mounted) {
           console.log("Redirect sign-in successful", result.user);
        }
      })
      .catch((error) => {
        console.error("Redirect auth error", error);
        if (mounted && error.code !== 'auth/popup-closed-by-user') {
          setAuthError("Erro na autenticação. Tente entrar novamente.");
        }
      });

    return () => {
      mounted = false;
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleLogin = async () => {
    setAuthError(null);
    setIsAuthenticating(true);
    const provider = new GoogleAuthProvider();
    
    // Check if it's likely a mobile/embedded environment
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    try {
      if (isMobile) {
        await signInWithRedirect(auth, provider);
      } else {
        await signInWithPopup(auth, provider);
      }
    } catch (error: any) {
      console.error("Login failed", error);
      setIsAuthenticating(false);
      if (error.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, provider);
      } else if (error.code !== 'auth/popup-closed-by-user') {
        setAuthError("Falha ao entrar com Google. Tente novamente.");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-slate-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-4">
        <div className="max-w-md w-full card p-10 text-center space-y-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg shadow-blue-200">
            <LogIn size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Bem-vindo ao RentMaster</h1>
            <p className="text-slate-500 mt-2">Acesse sua conta para gerenciar seus aluguéis.</p>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm">
              {authError}
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isAuthenticating}
            className="w-full btn btn-primary py-3 gap-3 disabled:opacity-70"
          >
            {isAuthenticating ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full" alt="G" />
            )}
            {isAuthenticating ? 'Conectando...' : 'Entrar com Google'}
          </button>
          
          <p className="text-[10px] text-slate-400">
            Dica: Se o login travar no celular, tente abrir no navegador padrão Chrome ou Safari.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <Sidebar />
      <main className="lg:pl-64 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-20 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
