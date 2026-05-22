import React, { useState, useEffect } from "react";
import { Eye, EyeOff, LogIn, Sun, Moon, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import LoadingIndicator from "../components/LoadingIndicator";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    // Preserve tag from URL if present
    const params = new URLSearchParams(window.location.search);
    const tag = params.get("tag");
    if (tag) {
      localStorage.setItem("pending_tag", tag);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin) {
      setIsLoading(true);
      const success = await login(pin, email);
      setIsLoading(false);
      if (success) {
        window.location.href = "/client-selector";
      } else {
        alert("PIN o correo inválido");
      }
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-300 ${isDarkMode ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-xl shadow-blue-600/20 mb-6">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">CMMS HVAC </h1>
          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Entornos Eficientes & Agil </p>
        </div>

        <form onSubmit={handleLogin} className={`p-8 rounded-3xl border shadow-2xl space-y-6 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="space-y-4 text-left font-sans">
            <div>
              <label className={`text-xs font-bold uppercase tracking-widest mb-1.5 block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>USER : Correo Electrónico </label>
              <input
                type="email"
                required
                className={`w-full px-4 py-3 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-blue-500/20 font-medium ${
                  isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                }`}
                placeholder="ejemplo@eecol.cl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className={`text-xs font-bold uppercase tracking-widest mb-1.5 block ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>PIN Numérico</label>
              <div className="relative">
                <input
                  type={showPin ? "text" : "password"}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  className={`w-full px-4 py-3 rounded-xl border outline-none transition-all focus:ring-2 focus:ring-blue-500/20 font-medium tracking-widest ${
                    isDarkMode ? 'bg-slate-950 border-slate-800 text-white focus:border-blue-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'
                  }`}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-blue-500"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-600/30 flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <LoadingIndicator size="sm" color="text-white" label="Validando..." className="flex-row gap-2" />
            ) : (
              <>INGRESAR <LogIn className="w-4 h-4" /></>
            )}
          </button>
        </form>

        <div className="flex justify-center gap-6">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-colors ${isDarkMode ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
          </button>
        </div>
      </div>
    </div>
  );
}
