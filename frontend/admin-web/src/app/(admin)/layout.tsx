'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/adminAuthStore';
import { adminAuthApi } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import {
  LayoutDashboard,
  Trophy,
  Users,
  Network,
  ClipboardCheck,
  SendHorizontal,
  UserCog,
  ShieldCheck,
  ScrollText,
  LogOut,
  Code2,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/contests', label: 'Contests', icon: Trophy },
  { href: '/participants', label: 'Participants', icon: Users },
  { href: '/teams', label: 'Teams', icon: Network },
  { href: '/rubrics', label: 'Rubrics', icon: ClipboardCheck },
  { href: '/submissions', label: 'Submissions', icon: SendHorizontal },
  { href: '/users', label: 'Users', icon: UserCog, superAdminOnly: true },
  { href: '/roles', label: 'Roles', icon: ShieldCheck, superAdminOnly: true },
  { href: '/audit-logs', label: 'Audit Logs', icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, user, clearAuth, isSuperAdmin } = useAdminAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  const logoutMutation = useMutation({
    mutationFn: () => adminAuthApi.logout(),
    onSettled: () => {
      clearAuth();
      router.push('/login');
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const superAdmin = isSuperAdmin();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col flex-shrink-0 shadow-xs">
        {/* Brand Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#3760F8] rounded-xl flex items-center justify-center shadow-[0_2px_10px_rgba(55,96,248,0.35)] relative overflow-hidden group">
              <Code2 className="w-5 h-5 text-white" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#D3FE4F] rounded-full border-2 border-[#3760F8]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 tracking-tight text-base">Codeathon</span>
                <span className="w-2 h-2 rounded-full bg-[#D3FE4F]" />
              </div>
              <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                Admin Console
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.filter((item) => !item.superAdminOnly || superAdmin).map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#EEF2FF] text-[#3760F8] font-semibold shadow-xs'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-[#3760F8]' : 'text-slate-600 group-hover:text-slate-600'
                  }`}
                />
                <span className="tracking-tight">{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#3760F8]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Card */}
        <div className="border-t border-slate-100 p-3 bg-slate-50/50">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white border border-slate-200/60 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-[#3760F8] flex items-center justify-center text-white font-semibold text-xs shadow-xs">
              {user?.name?.[0]?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate tracking-tight">{user?.name || 'Administrator'}</p>
              <p className="text-[11px] text-slate-600 truncate">{user?.email || 'admin@codeathon.dev'}</p>
            </div>
          </div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-500 hover:text-rose-600 hover:bg-rose-50/80 rounded-lg transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50">
        {children}
      </main>
    </div>
  );
}
