import React, { useState } from 'react';
import { ShieldCheck, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { login } from '../services/backend';

interface LoginProps {
  onSuccessLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onSuccessLogin }) => {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setErrorMessage('Por favor ingrese la contraseña de acceso.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await login(password);
      if (res.success) {
        onSuccessLogin();
      } else {
        setErrorMessage(res.message || 'Contraseña incorrecta.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo verificar el acceso.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 selection:bg-emerald-200">
      <div className="w-full max-w-md bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header Institucional */}
        <div className="bg-emerald-900 text-white p-6 text-center border-b border-emerald-950">
          <div className="mx-auto w-12 h-12 rounded bg-emerald-800 flex items-center justify-center mb-3 shadow-inner border border-emerald-700">
            <ShieldCheck className="w-7 h-7 text-emerald-200" />
          </div>
          <h1 className="text-base sm:text-lg font-bold tracking-tight uppercase leading-snug">
            Registro de Garantía de Terrenos
          </h1>
          <p className="mt-1 text-xs font-semibold text-emerald-200 tracking-wide uppercase">
            ASOC. CIVIL "COLONIA CHIHUAHUA"
          </p>
        </div>

        {/* Formulario de Contraseña */}
        <div className="p-6 sm:p-8">
          <div className="mb-5 text-center">
            <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Acceso al Sistema
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Ingrese la contraseña autorizada para consultar y registrar garantías.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
              <div>
                <span className="font-semibold">Atención: </span>
                {errorMessage}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
              >
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese la contraseña..."
                  autoFocus
                  disabled={isLoading}
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700 transition"
                />
              </div>
              <p className="mt-1.5 text-[10px] text-slate-400">
                Acceso restringido para personal administrativo autorizado.
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-emerald-800 hover:bg-emerald-900 active:bg-emerald-950 text-white font-bold text-xs uppercase tracking-wider rounded transition flex items-center justify-center gap-2 shadow-xs cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verificando acceso...</span>
                </>
              ) : (
                <>
                  <span>Ingresar</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <p className="text-[10px] text-slate-400">
              Sistema Administrativo — Asoc. Civil "Colonia Chihuahua"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
