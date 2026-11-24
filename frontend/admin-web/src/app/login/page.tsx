'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { adminAuthApi } from '@/lib/api';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { Button } from '@/components/ui/Button';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  CheckCircle2,
  Cpu,
  ArrowRight,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAdminAuthStore();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
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
        setCustomError('Access denied. Candidate accounts must sign in via the Candidate Portal (port 3000).');
        return;
      }
      setAuth(user, accessToken);
      router.push('/dashboard');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError(null);
    if (!identifier.trim() || !password) return;
    loginMutation.mutate();
  };

  const errorMsg =
    customError ||
    (loginMutation.isError
      ? (loginMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Authentication failed. Please verify your credentials and try again.'
      : null);

  return (
    <div className="min-h-screen w-full flex bg-slate-50 selection:bg-[#3760F8] selection:text-white">
      {/* Left Enterprise Showcase Panel (hidden on mobile, visible on desktop) */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] xl:w-[540px] bg-[#0B0F19] p-12 relative overflow-hidden shrink-0 border-r border-slate-800/80">
        {/* Subtle Ambient Background Gradients */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#3760F8]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#D3FE4F]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#ffffff08_1px,transparent_0)] bg-[size:32px_32px] pointer-events-none" />

        {/* Top Header */}
        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-xl shadow-md border border-white/20">
              <img src="/logo.png" alt="HACKPRO" className="h-8 w-auto object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-white text-lg tracking-tight block">HACKPRO</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold block">
                Assessment Operating System
              </span>
            </div>
          </div>
        </div>

        {/* Middle Feature Content */}
        <div className="relative z-10 space-y-8 my-auto py-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300 text-xs font-medium">
              <Cpu className="w-3.5 h-3.5 text-[#3760F8]" />
              <span>Next-Gen Enterprise Evaluation</span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-tight">
              High-concurrency testing and automated proctoring.
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed max-w-md">
              Secure administrative hub to configure coding competitions, monitor live examinations, and orchestrate
              standardized multi-dimensional candidate evaluations.
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="p-2 rounded-xl bg-[#3760F8]/10 text-[#3760F8] shrink-0 mt-0.5">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-tight">Active Anti-Cheat Protocol</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Automated tab-switch tracking, fullscreen enforcement, and hardware inspection logs.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/[0.03] border border-white/5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white tracking-tight">Synchronized Real-Time Standings</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Sub-second automated grading against hidden test cases with dynamic leaderboard updates.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status / Footer */}
        <div className="relative z-10 pt-6 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Operational &bull; 99.98% System Uptime</span>
          </div>
          <span className="font-mono text-[11px] text-slate-500">v2.4 Enterprise</span>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 relative overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between pb-8">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="HACKPRO" className="h-8 w-auto object-contain" />
            <span className="font-bold text-slate-900 tracking-tight text-base">HACKPRO</span>
          </div>
          <span className="text-[10px] font-mono font-semibold bg-slate-200/80 px-2 py-0.5 rounded-md text-slate-700">
            Console
          </span>
        </div>

        <div className="w-full max-w-md mx-auto my-auto space-y-8 py-6">
          {/* Header */}
          <div className="space-y-2">
            <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-[#3760F8] mb-1">
              <span>HACKPRO Administrator Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Sign in to your account
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Enter your administrative credentials to access assessments and proctoring controls.
            </p>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium animate-in fade-in slide-in-from-top-1 duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold block mb-0.5">Authentication Error</span>
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="identifier" className="block text-xs font-semibold text-slate-700">
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="identifier"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="admin@hackpro.dev"
                  autoComplete="username"
                  autoFocus
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3760F8] focus:ring-4 focus:ring-[#3760F8]/10 transition-all shadow-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#3760F8] focus:ring-4 focus:ring-[#3760F8]/10 transition-all shadow-xs"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
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

              <a
                href="mailto:support@hackpro.dev"
                className="text-xs font-semibold text-[#3760F8] hover:text-[#254EDB] transition-colors"
              >
                Need assistance?
              </a>
            </div>

            <Button
              type="submit"
              className="w-full py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-[#3760F8] hover:bg-[#254EDB] active:bg-[#1D40B8] text-white shadow-sm hover:shadow-[0_4px_16px_rgba(55,96,248,0.35)] transition-all flex items-center justify-center gap-2"
              loading={loginMutation.isPending}
            >
              <span>Sign In to Console</span>
              {!loginMutation.isPending && <ArrowRight className="w-4 h-4" />}
            </Button>
          </form>
        </div>

        {/* Bottom Security Assurance Footer */}
        <div className="w-full max-w-md mx-auto pt-8 border-t border-slate-200/60 text-center text-[11px] text-slate-400 flex items-center justify-center gap-2">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span>Encrypted with TLS 1.3 &bull; Enterprise Compliance &bull; HACKPRO</span>
        </div>
      </div>
    </div>
  );
}
