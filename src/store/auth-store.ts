import { create } from 'zustand';
import { hasAnyUser, createUser, verifyAndLogin, lockApp, isUnlocked, getCurrentUserId, getCurrentUserName, type UserProfile } from '@/lib/auth';

type AuthStatus = 'checking' | 'create-user' | 'login' | 'locked' | 'unlocked';

interface AuthStore {
  authStatus: AuthStatus;
  currentUserId: string | null;
  currentUserName: string;
  users: UserProfile[];
  error: string;
  lastActivity: number;

  checkAuth: () => Promise<void>;
  createUserAndLogin: (name: string, pin: string) => Promise<boolean>;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  recordActivity: () => void;
  checkAutoLock: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  authStatus: 'checking',
  currentUserId: null,
  currentUserName: '',
  users: [],
  error: '',
  lastActivity: Date.now(),

  checkAuth: async () => {
    try {
      if (isUnlocked()) {
        set({
          authStatus: 'unlocked',
          currentUserId: getCurrentUserId(),
          currentUserName: getCurrentUserName() || '',
          lastActivity: Date.now(),
        });
        return;
      }
      const anyUser = await hasAnyUser();
      set({ authStatus: anyUser ? 'login' : 'create-user' });
    } catch { set({ authStatus: 'create-user' }); }
  },

  createUserAndLogin: async (name: string, pin: string) => {
    try {
      const user = await createUser(name, pin);
      if (user) {
        const { getUsers } = await import('@/lib/auth');
        set({ authStatus: 'unlocked', currentUserId: user.id, currentUserName: user.name, users: await getUsers(), error: '', lastActivity: Date.now() });
        return true;
      }
      set({ error: 'Failed. Try again.' });
      return false;
    } catch { set({ error: 'Failed. Try again.' }); return false; }
  },

  login: async (pin: string) => {
    try {
      const result = await verifyAndLogin(pin);
      if (result.success) {
        const { getUsers } = await import('@/lib/auth');
        set({ authStatus: 'unlocked', currentUserId: result.userId, currentUserName: result.userName, users: await getUsers(), error: '', lastActivity: Date.now() });
        return true;
      }
      if (result.locked) {
        set({ authStatus: 'locked', error: `Too many attempts for ${result.userName}. Try again in ${result.lockoutRemaining}s`, lockoutRemaining: result.lockoutRemaining });
      } else {
        set({ error: 'Wrong PIN' });
      }
      return false;
    } catch { set({ error: 'Login failed' }); return false; }
  },

  logout: () => {
    lockApp();
    set({ authStatus: 'login', currentUserId: null, error: '', lastActivity: Date.now() });
  },

  recordActivity: () => set({ lastActivity: Date.now() }),

  checkAutoLock: () => {
    const s = get();
    if (s.authStatus !== 'unlocked') return false;
    if (Date.now() - s.lastActivity >= 5 * 60 * 1000) {
      lockApp();
      set({ authStatus: 'login', error: '' });
      return true;
    }
    return false;
  },
}));