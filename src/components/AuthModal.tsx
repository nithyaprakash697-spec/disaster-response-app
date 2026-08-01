import React, { useState } from 'react';
import { ShieldCheck, Users, ArrowRight, Lock, Mail, AlertCircle, Key, User, UserPlus } from 'lucide-react';
import { AuthUser, DEMO_ADMIN_ACCOUNT, DEMO_CITIZEN_ACCOUNT, loginWithDemoCredentials, signUpCitizen } from '../lib/auth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser | null;
  onLoginSuccess: (user: AuthUser) => void;
}

export const AuthModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFillCitizen = () => {
    setEmail(DEMO_CITIZEN_ACCOUNT.email);
    setPassword(DEMO_CITIZEN_ACCOUNT.password);
    setErrorMsg(null);
  };

  const handleFillAdmin = () => {
    setEmail(DEMO_ADMIN_ACCOUNT.email);
    setPassword(DEMO_ADMIN_ACCOUNT.password);
    setErrorMsg(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const res = await loginWithDemoCredentials(email, password);
    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.user) {
      onLoginSuccess(res.user);
      onClose();
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please try again.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    const res = await signUpCitizen(name, email, password);
    if (res.error) {
      setErrorMsg(res.error);
    } else if (res.user) {
      onLoginSuccess(res.user);
      onClose();
    }
  };

  const handleQuickLoginCitizen = async () => {
    handleFillCitizen();
    const res = await loginWithDemoCredentials(DEMO_CITIZEN_ACCOUNT.email, DEMO_CITIZEN_ACCOUNT.password);
    if (res.user) {
      onLoginSuccess(res.user);
      onClose();
    }
  };

  const handleQuickLoginAdmin = async () => {
    handleFillAdmin();
    const res = await loginWithDemoCredentials(DEMO_ADMIN_ACCOUNT.email, DEMO_ADMIN_ACCOUNT.password);
    if (res.user) {
      onLoginSuccess(res.user);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative overflow-y-auto max-h-[90vh]">
        
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2">
              {mode === 'signin' ? (
                <ShieldCheck className="w-6 h-6 text-red-500" />
              ) : (
                <UserPlus className="w-6 h-6 text-amber-400" />
              )}
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight font-display">
                {mode === 'signin' ? 'Portal Authentication' : 'Create Citizen Account'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {mode === 'signin'
                ? 'Sign in to access Citizen Emergency Portal or Authority Command Center.'
                : 'Register to request emergency aid, view active alerts, and access citizen features.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Current logged in status if any */}
        {currentUser && (
          <div className="mb-4 p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-center justify-between text-xs text-slate-300">
            <span className="truncate">Active: <strong className="text-white">{currentUser.email}</strong> ({currentUser.role})</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold uppercase text-[10px]">
              Active
            </span>
          </div>
        )}

        {/* Form Error Banner */}
        {errorMsg && (
          <div className="p-3 mb-3 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SIGN IN FORM */}
        {mode === 'signin' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4 my-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. demo.citizen@disasterhub.app"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs text-white focus:outline-none focus:border-red-500 min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs text-white focus:outline-none focus:border-red-500 min-h-[44px]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all min-h-[44px]"
            >
              <span>Sign In to Portal</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg(null);
                }}
                className="text-amber-400 hover:text-amber-300 font-medium text-xs hover:underline min-h-[44px] px-2"
              >
                New here? Create an account
              </button>
            </div>
          </form>
        ) : (
          /* SIGN UP FORM */
          <form onSubmit={handleSignUpSubmit} className="space-y-3 my-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jane Doe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. jane.doe@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-xs text-white focus:outline-none focus:border-amber-500 min-h-[44px]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all mt-2 min-h-[44px]"
            >
              <span>Sign Up as Citizen</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg(null);
                }}
                className="text-amber-400 hover:text-amber-300 font-medium text-xs hover:underline min-h-[44px] px-2"
              >
                Already have an account? Sign in
              </button>
            </div>
          </form>
        )}

        {/* PRE-CONFIGURED ACCOUNTS DISPLAY */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
            <Key className="w-3.5 h-3.5 text-amber-400" />
            <span>IN-BUILT SYSTEM ACCOUNTS</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {/* Citizen Account Box */}
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-amber-900/50 hover:border-amber-600 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-400 flex items-center gap-1 text-[11px]">
                  <Users className="w-3.5 h-3.5" /> Citizen Account
                </span>
                <span className="text-[9px] uppercase font-bold bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800">
                  Citizen
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono space-y-0.5 bg-slate-900 p-2 rounded-lg border border-slate-800">
                <p>Email: <span className="text-white select-all">demo.citizen@disasterhub.app</span></p>
                <p>Pass: <span className="text-amber-300 select-all">Citizen@123</span></p>
              </div>
              <button
                type="button"
                onClick={handleQuickLoginCitizen}
                className="w-full py-2.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 font-bold text-[11px] rounded-lg border border-amber-700/80 transition-all flex items-center justify-center gap-1 min-h-[44px]"
              >
                <span>Quick Sign-In (Citizen)</span>
              </button>
            </div>

            {/* Admin Account Box */}
            <div className="p-3 rounded-2xl bg-slate-950/90 border border-red-900/50 hover:border-red-600 transition-all space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-red-400 flex items-center gap-1 text-[11px]">
                  <ShieldCheck className="w-3.5 h-3.5" /> Authority Admin Account
                </span>
                <span className="text-[9px] uppercase font-bold bg-red-950 text-red-300 px-1.5 py-0.5 rounded border border-red-800">
                  Authority Admin
                </span>
              </div>
              <div className="text-[10px] text-slate-300 font-mono space-y-0.5 bg-slate-900 p-2 rounded-lg border border-slate-800">
                <p>Email: <span className="text-white select-all">demo.admin@disasterhub.app</span></p>
                <p>Pass: <span className="text-red-300 select-all">Admin@123</span></p>
              </div>
              <button
                type="button"
                onClick={handleQuickLoginAdmin}
                className="w-full py-2.5 bg-red-950/80 hover:bg-red-900 text-red-300 font-bold text-[11px] rounded-lg border border-red-700/80 transition-all flex items-center justify-center gap-1 min-h-[44px]"
              >
                <span>Quick Sign-In (Authority Admin)</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

