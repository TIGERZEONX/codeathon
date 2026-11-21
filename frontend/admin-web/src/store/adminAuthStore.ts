import { create } from 'zustand';
import type { UserSession } from '@codeathon/shared';

interface AdminAuthState {
  user: UserSession | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAuth: (user: UserSession, accessToken: string) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission: string) => boolean;
  isSuperAdmin: () => boolean;
}

export const useAdminAuthStore = create<AdminAuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  isAuthenticated: false,

  setAuth: (user, accessToken) => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('admin_access_token', accessToken);
    }
    set({ user, accessToken, isAuthenticated: true, isLoading: false });
  },

  clearAuth: () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('admin_access_token');
    }
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (loading) => set({ isLoading: loading }),

  hasPermission: (permission) => {
    const { user } = get();
    if (!user) return false;
    if (user.isSuperAdmin) return true;
    return (user.permissions ?? []).includes(permission as any);
  },

  isSuperAdmin: () => {
    const { user } = get();
    return user?.isSuperAdmin === true || user?.role === 'super_admin';
  },
}));
