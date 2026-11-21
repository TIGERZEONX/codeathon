'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@codeathon/shared';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Eye, EyeOff, Loader2, Code2 } from 'lucide-react';

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
        err?.response?.data?.error?.message ?? 'Login failed. Please check your credentials.';
      setServerError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper-subtle px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 bg-base rounded-xl flex items-center justify-center mb-3 shadow-card">
            <Code2 className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-ink-primary">Codeathon</h1>
          <p className="text-sm text-ink-muted mt-1">Student Portal — Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-paper rounded-xl border border-line shadow-card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Identifier */}
            <div>
              <label htmlFor="identifier" className="block text-sm font-medium text-ink-secondary mb-1.5">
                Roll Number / Email
              </label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                autoFocus
                {...register('identifier')}
                className="w-full h-10 px-3 rounded-md border border-line focus:outline-none focus:border-line-focus focus:ring-2 focus:ring-base/20 text-sm text-ink-primary placeholder:text-ink-disabled transition-colors"
                placeholder="e.g. CS2026001 or email@university.edu"
              />
              {errors.identifier && (
                <p className="mt-1 text-xs text-danger">{errors.identifier.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-ink-secondary mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  {...register('password')}
                  className="w-full h-10 px-3 pr-10 rounded-md border border-line focus:outline-none focus:border-line-focus focus:ring-2 focus:ring-base/20 text-sm text-ink-primary placeholder:text-ink-disabled transition-colors"
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-secondary"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-danger">{errors.password.message}</p>
              )}
            </div>

            {/* Server Error */}
            {serverError && (
              <div className="bg-danger-50 border border-danger-100 text-danger text-sm px-3 py-2.5 rounded-md">
                {serverError}
              </div>
            )}

            {/* Forgot password link */}
            <div className="text-right">
              <a href="/forgot-password" className="text-xs text-base hover:underline">
                Forgot password?
              </a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 bg-base text-white rounded-md text-sm font-medium hover:bg-base-600 active:bg-base-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-ink-muted mt-6">
          © {new Date().getFullYear()} Codeathon Platform. All rights reserved.
        </p>
      </div>
    </div>
  );
}
