'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@codeathon/shared';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Loader2, User, Lock, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [serverError, setServerError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setServerError('');
    try {
      const result = await authApi.login(data.identifier, data.password);
      if (result.user.role !== 'student') {
        // Staff/Admin/Proctor user logged in on student portal
        // Auto-redirect to the Admin Console on port 3001
        const adminUrl = `http://localhost:3001/login?autoToken=${encodeURIComponent(result.accessToken)}&userData=${encodeURIComponent(JSON.stringify(result.user))}`;
        window.location.href = adminUrl;
        return;
      }
      setAuth(result.user, result.accessToken);
      router.replace('/dashboard');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error?.message ??
        'Authentication failed. Please verify your roll number and password.';
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-gradient-to-b from-slate-50 via-white to-slate-100 p-4 sm:p-6 font-sans relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f018_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f018_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#3760F8]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#D3FE4F]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar / Brand */}
      <div className="w-full max-w-5xl flex items-center justify-between py-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-xl border border-slate-200/80 shadow-2xs">
            <img src="/logo.png" alt="HACKPRO" className="h-7 w-auto object-contain" />
          </div>
          <div>
            <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base block">HACKPRO</span>
            <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">Candidate Arena</span>
          </div>
        </div>

        <a
          href="http://localhost:3001/login"
          className="text-xs font-semibold text-slate-600 hover:text-[#3760F8] bg-white border border-slate-200/80 px-3.5 py-1.5 rounded-full shadow-2xs hover:border-[#3760F8]/40 transition-all flex items-center gap-1.5"
        >
          <span>Staff / Admin Console</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Center Login Card */}
      <div className="w-full max-w-md relative z-10 my-auto py-8">
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-[0_16px_48px_-12px_rgba(11,15,25,0.08)] p-8 sm:p-10 space-y-7">
          {/* Header */}
          <div className="space-y-1.5 text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Candidate Sign In
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Enter your Roll Number or Email to access your assigned tests.
            </p>
          </div>

          {/* Error Alert */}
          {serverError && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Sign In Failed</span>
                <span>{serverError}</span>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Identifier */}
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="block text-xs font-semibold text-slate-700 tracking-tight">
                Roll Number / Registered Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="identifier"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  {...register('identifier')}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#3760F8] focus:ring-4 focus:ring-[#3760F8]/10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all shadow-xs"
                  placeholder="e.g. CS2026001"
                />
              </div>
              {errors.identifier && (
                <p className="text-xs font-medium text-rose-600 mt-1">{errors.identifier.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 tracking-tight">
                Assessment Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full min-h-[44px] pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#3760F8] focus:ring-4 focus:ring-[#3760F8]/10 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 transition-all shadow-xs"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-rose-600 mt-1">{errors.password.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#3760F8] focus:ring-[#3760F8]/30 accent-[#3760F8]"
                />
                <span className="text-xs text-slate-600 font-medium">Keep me signed in</span>
              </label>

              <span className="text-xs text-slate-400 font-medium">
                Provided by proctor
              </span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] bg-[#3760F8] hover:bg-[#254EDB] active:bg-[#1D40B8] text-white rounded-xl text-xs sm:text-sm font-semibold tracking-tight shadow-sm hover:shadow-[0_4px_16px_rgba(55,96,248,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Session…</span>
                </>
              ) : (
                <>
                  <span>Sign In to Assessment</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="w-full max-w-5xl py-4 relative z-10 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2 border-t border-slate-200/60">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
          <span>Encrypted Assessment Session &bull; Automated Anti-Cheat Verification</span>
        </div>
        <span>&copy; {new Date().getFullYear()} HACKPRO Platform. All rights reserved.</span>
      </div>
    </div>
  );
}
