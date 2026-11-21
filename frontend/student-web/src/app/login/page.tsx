'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@codeathon/shared';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Loader2, Code2, Sparkles, ShieldCheck } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
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
      setAuth(result.user, result.accessToken);
      router.replace('/dashboard');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.response?.data?.error?.message ??
        'Login failed. Please check your credentials.';
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 font-sans relative overflow-hidden">
      {/* Background accents */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f020_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f020_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-[#3760F8]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-[#D3FE4F]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo & Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-[#3760F8] rounded-2xl flex items-center justify-center mb-4 shadow-[0_6px_25px_rgba(55,96,248,0.35)] relative group">
            <Code2 className="text-white w-7 h-7" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#D3FE4F] rounded-full border-2 border-white shadow-xs" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Portal</h1>
          <p className="text-xs text-slate-500 mt-1">Sign in with your roll number to access your contests</p>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-slate-200/80 shadow-[0_12px_40px_-10px_rgba(11,15,25,0.08)] p-8 sm:p-10">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Identifier */}
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="block text-xs font-semibold text-slate-700 tracking-tight">
                Roll Number / Email
              </label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                autoFocus
                {...register('identifier')}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#3760F8] focus:ring-2 focus:ring-[#3760F8]/20 text-sm text-slate-900 placeholder:text-slate-400 transition-all shadow-xs"
                placeholder="e.g. CS2026001"
              />
              {errors.identifier && (
                <p className="text-xs font-medium text-rose-600">{errors.identifier.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 tracking-tight">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full min-h-[44px] px-3.5 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#3760F8] focus:ring-2 focus:ring-[#3760F8]/20 text-sm text-slate-900 placeholder:text-slate-400 transition-all shadow-xs"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-medium text-rose-600">{errors.password.message}</p>
              )}
            </div>

            {/* Server Error */}
            {serverError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3.5 py-2.5 rounded-xl font-medium">
                {serverError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full min-h-[44px] mt-2 bg-[#3760F8] hover:bg-[#254EDB] active:bg-[#1D40B8] text-white rounded-xl text-sm font-medium tracking-tight shadow-sm hover:shadow-[0_4px_16px_rgba(55,96,248,0.35)] disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in…</span>
                </>
              ) : (
                <span>Sign In to Contest Portal</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#3760F8]" />
            <span>Encrypted Session &bull; Fast Auto-Reconnect</span>
          </div>
        </div>
      </div>
    </div>
  );
}
