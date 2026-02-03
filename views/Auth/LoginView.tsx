import React, { useState } from 'react';
import { User, Mail, Key, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { BRAND_ASSETS } from '../../constants';
import Notification from '../../components/common/Notification';

interface LoginViewProps {
  email: string;
  password: string;
  name: string;
  isSignUp: boolean;
  authError: string;
  notif: { msg: string; type: 'success' | 'error' } | null;
  onEmailChange: (email: string) => void;
  onPasswordChange: (password: string) => void;
  onNameChange: (name: string) => void;
  onToggleSignUp: () => void;
  onAuth: () => void;
  onCloseNotif: () => void;
}

export default function LoginView({
  email,
  password,
  name,
  isSignUp,
  authError,
  notif,
  onEmailChange,
  onPasswordChange,
  onNameChange,
  onToggleSignUp,
  onAuth,
  onCloseNotif,
}: LoginViewProps) {
  /* State for password capability */
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-ferty-beige p-6 font-sans relative overflow-hidden">
      {notif && <Notification message={notif.msg} type={notif.type} onClose={onCloseNotif} />}

      {/* Background decorations */}
      <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-ferty-rose/10 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-ferty-coral/10 rounded-full blur-3xl"></div>

      <div className="bg-white/80 backdrop-blur-lg p-8 rounded-[2rem] shadow-xl w-full max-w-sm border border-white relative z-10">
        <div className="flex flex-col items-center mb-8">
          <img src={BRAND_ASSETS.logo} alt="FertyFit" className="h-20 object-contain mb-2" />
          <p className="text-[10px] uppercase tracking-[0.3em] text-ferty-coral font-medium text-center">
            Function • Food • Flora • Flow
          </p>
        </div>

        <div className="space-y-4">
          {isSignUp && (
            <div className="relative group animate-in slide-in-from-top duration-300">
              <User className="absolute left-4 top-4 text-ferty-coral group-focus-within:text-ferty-rose transition-colors" size={20} />
              <input
                type="text"
                placeholder="Tu Nombre"
                className="w-full bg-ferty-beige border-transparent focus:bg-white border focus:border-ferty-rose rounded-2xl py-4 pl-12 pr-4 text-sm outline-none transition-all text-ferty-dark"
                value={name}
                onChange={e => onNameChange(e.target.value)}
              />
            </div>
          )}
          <div className="relative group">
            <Mail className="absolute left-4 top-4 text-ferty-coral group-focus-within:text-ferty-rose transition-colors" size={20} />
            <input
              type="email"
              placeholder="Tu Email"
              className="w-full bg-ferty-beige border-transparent focus:bg-white border focus:border-ferty-rose rounded-2xl py-4 pl-12 pr-4 text-sm outline-none transition-all text-ferty-dark"
              value={email}
              onChange={e => onEmailChange(e.target.value)}
            />
          </div>
          <div className="relative group">
            <Key className="absolute left-4 top-4 text-ferty-coral group-focus-within:text-ferty-rose transition-colors" size={20} />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Tu Contraseña"
              className="w-full bg-ferty-beige border-transparent focus:bg-white border focus:border-ferty-rose rounded-2xl py-4 pl-12 pr-12 text-sm outline-none transition-all text-ferty-dark"
              value={password}
              onChange={e => onPasswordChange(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-4 text-ferty-coral hover:text-ferty-rose transition-colors focus:outline-none"
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {authError && (
          <div className="bg-rose-50 text-rose-600 text-xs p-4 rounded-xl mt-4 flex items-start gap-2 border border-rose-100">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <button
          onClick={onAuth}
          disabled={!email || !password || (isSignUp && !name)}
          className="w-full bg-gradient-to-r from-ferty-rose to-ferty-coral text-white py-4 rounded-2xl font-bold shadow-lg shadow-rose-200/50 mt-6 hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isSignUp ? 'Crear Cuenta Gratis' : 'Iniciar Sesión'}
        </button>

        <div className="text-center mt-8 pt-6 border-t border-ferty-beige">
          <p className="text-xs text-ferty-gray mb-2">
            {isSignUp ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'}
          </p>
          <button onClick={onToggleSignUp} className="text-ferty-rose font-bold text-sm hover:underline">
            {isSignUp ? 'Entra aquí' : 'Regístrate ahora'}
          </button>
        </div>

        {isSignUp && (
          <div className="bg-blue-50 text-blue-600 text-[10px] p-3 rounded-xl mt-4 flex gap-2 items-center">
            <Mail size={14} />
            <span>Importante: Te enviaremos un email de confirmación.</span>
          </div>
        )}
      </div>
    </div>
  );
}

