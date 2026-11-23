'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { adminAuthApi } from '@/lib/api';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Code2, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAdminAuthStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  // Check for auto-redirect from Student Portal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const autoToken = params.get('autoToken');
      const userData = params.get('userData');
      if (autoToken && userData) {
        try {
          const user = JSON.parse(decodeURIComponent(userData));
          setAuth(user, autoToken);
          router.replace('/dashboard');
        } catch (e) {
          // ignore parsing error
        }
      }
    }
  }, [setAuth, router]);

  const loginMutation = useMutation({
    mutationFn: () => adminAuthApi.login(identifier, password),
    onSuccess: (data) => {
      const { user, accessToken } = data as { user: Parameters<typeof setAuth>[0]; accessToken: string };
      if (user.role === 'student') {
        setCustomError('Access denied. Student accounts must sign in via the Student Portal (http://localhost:3000).');
        return;
      }
      setAuth(user, accessToken);
      router.push('/dashboard');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);
    if (!identifier || !password) return;
    loginMutation.mutate();
  };

  const errorMsg =
    customError ||
    (loginMutation.isError
      ? (loginMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Login failed'
      : null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 flex items-center justify-center p-4">
      {/* Decorative background grid and accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f015_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f015_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#3760F8]/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative bg-white/90 backdrop-blur-md rounded-3xl shadow-[0_12px_40px_-10px_rgba(11,15,25,0.08)] border border-slate-200/80 w-full max-w-md p-8 sm:p-10 space-y-7">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#3760F8] rounded-2xl shadow-[0_4px_20px_rgba(55,96,248,0.35)] relative group">
            <Code2 className="w-7 h-7 text-white" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#D3FE4F] rounded-full border-2 border-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">HirePro Admin Console</h1>
            <p className="text-xs text-slate-500 mt-1">Assessment Management &amp; Proctoring Platform</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email or Username"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="admin@hirepro.dev"
            autoComplete="username"
            required
          />
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="absolute right-3.5 top-8 text-slate-400 hover:text-slate-600 transition-colors"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-rose-700 font-medium">
              {errorMsg}
            </div>
          )}

          <Button type="submit" className="w-full mt-2" loading={loginMutation.isPending}>
            Sign In to Dashboard
          </Button>
        </form>

        <div className="pt-2 text-center border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-3.5 h-3.5 text-[#3760F8]" />
          <span>Role-based Access &amp; Session Authenticated</span>
        </div>
      </div>
    </div>
  );
}
