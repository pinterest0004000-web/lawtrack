import { create } from 'zustand';
import { getUsers, verifyUserPin, setupFirstUserAndLogin, lockApp, isUnlocked, getCurrentUserId, type UserProfile } from '@/lib/auth';

type AuthStatus = 'checking' | 'no-users' | 'select-user' | 'add-user' | 'login' | 'locked' | 'unlocked';

interface AuthStore {
  authStatus: AuthStatus;
  users: UserProfile[];
  currentUserId: string | null;
  currentUserName: string;
  remainingAttempts: number;
  lockoutRemaining: number;
  error: string;
  lastActivity: number;
  autoLockMinutes: number;

  checkAuth: () => Promise<void>;
  selectUser: (userId: string) => void;
  goToCreateUser: () => void;
  goToSelectUser: () => void;
  createUserAndLogin: (name: string, pin: string) => Promise<boolean>;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  recordActivity: () => void;
  checkAutoLock: () => boolean;
  removeUser: (userId: string) => Promise<void>;
}

const AUTO_LOCK_MINUTES = 5;

export const useAuthStore = create<AuthStore>((set, get) => ({
  authStatus: 'checking',
  users: [],
  currentUserId: null,
  currentUserName: '',
  remainingAttempts: 5,
  lockoutRemaining: 0,
  error: '',
  lastActivity: Date.now(),
  autoLockMinutes: AUTO_LOCK_MINUTES,

  checkAuth: async () => {
    try {
      const users = await getUsers();
      if (users.length === 0) {
        set({ authStatus: 'no-users', users: [] });
      } else if (isUnlocked()) {
        const uid = getCurrentUserId();
        const user = users.find(u => u.id === uid);
        set({
          authStatus: 'unlocked',
          users,
          currentUserId: uid,
          currentUserName: user?.name || '',
          lastActivity: Date.now(),
        });
      } else {
        const uid = getCurrentUserId();
        set({ authStatus: uid ? 'login' : 'select-user', users, currentUserId: uid });
      }
    } catch {
      set({ authStatus: 'no-users' });
    }
  },

  selectUser: (userId: string) => {
    set({ authStatus: 'login', currentUserId: userId, error: '', pin: '' });
  },

  goToCreateUser: () => {
    set({ authStatus: 'add-user', error: '' });
  },

  goToSelectUser: () => {
    lockApp();
    set({ authStatus: 'select-user', currentUserId: null, error: '', remainingAttempts: 5, lockoutRemaining: 0 });
  },

  createUserAndLogin: async (name: string, pin: string) => {
    try {
      const user = await setupFirstUserAndLogin(name, pin);
      if (user) {
        const users = await getUsers();
        set({
          authStatus: 'unlocked',
          users,
          currentUserId: user.id,
          currentUserName: user.name,
          error: '',
          lastActivity: Date.now(),
        });
        return true;
      }
      set({ error: 'User creation failed. Try again.' });
      return false;
    } catch {
      set({ error: 'User creation failed. Try again.' });
      return false;
    }
  },

  login: async (pin: string) => {
    const state = get();
    if (!state.currentUserId) return false;
    try {
      const result = await verifyUserPin(state.currentUserId, pin);
      if (result.success) {
        const users = await getUsers();
        set({
          authStatus: 'unlocked',
          users,
          currentUserName: result.userName,
          error: '',
          remainingAttempts: 5,
          lockoutRemaining: 0,
          lastActivity: Date.now(),
        });
        return true;
      }
      if (result.locked) {
        set({
          authStatus: 'locked',
          error: `Too many attempts. Try again in ${result.lockoutRemaining}s`,
          lockoutRemaining: result.lockoutRemaining,
          remainingAttempts: 0,
        });
      } else {
        set({
          error: `Wrong PIN. ${result.remainingAttempts} attempt${result.remainingAttempts !== 1 ? 's' : ''} left`,
          remainingAttempts: result.remainingAttempts,
        });
      }
      return false;
    } catch {
      set({ error: 'Login failed. Try again.' });
      return false;
    }
  },

  logout: () => {
    const userId = get().currentUserId;
    lockApp();
    const users = get().users;
    if (users.length === 0 || !userId) {
      set({ authStatus: 'no-users', currentUserId: null, error: '', remainingAttempts: 5, lockoutRemaining: 0 });
    } else {
      set({ authStatus: 'select-user', currentUserId: null, error: '', remainingAttempts: 5, lockoutRemaining: 0 });
    }
  },

  recordActivity: () => {
    set({ lastActivity: Date.now() });
  },

  checkAutoLock: () => {
    const state = get();
    if (state.authStatus !== 'unlocked') return false;
    const elapsed = Date.now() - state.lastActivity;
    if (elapsed >= state.autoLockMinutes * 60 * 1000) {
      lockApp();
      set({ authStatus: 'login', error: '', remainingAttempts: 5, lockoutRemaining: 0 });
      return true;
    }
    return false;
  },

  removeUser: async (userId: string) => {
    const { deleteUser } = await import('@/lib/auth');
    await deleteUser(userId);
    const users = await getUsers();
    set({ users });
    if (users.length === 0) {
      set({ authStatus: 'no-users', currentUserId: null });
    }
  },
}));