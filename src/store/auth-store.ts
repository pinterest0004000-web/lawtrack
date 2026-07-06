import { create } from 'zustand';
import { hasPin, verifyPin, setupPin, lockApp, isUnlocked } from '@/lib/auth';

type AuthStatus = 'checking' | 'no-pin' | 'locked' | 'unlocked';

interface AuthStore {
  authStatus: AuthStatus;
  remainingAttempts: number;
  lockoutRemaining: number;
  error: string;
  lastActivity: number;
  autoLockMinutes: number;

  checkAuth: () => Promise<void>;
  createPin: (pin: string) => Promise<boolean>;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
  recordActivity: () => void;
  checkAutoLock: () => boolean;
}

const AUTO_LOCK_MINUTES = 5;

export const useAuthStore = create<AuthStore>((set, get) => ({
  authStatus: 'checking',
  remainingAttempts: 5,
  lockoutRemaining: 0,
  error: '',
  lastActivity: Date.now(),
  autoLockMinutes: AUTO_LOCK_MINUTES,

  checkAuth: async () => {
    try {
      const pinExists = await hasPin();
      if (!pinExists) {
        set({ authStatus: 'no-pin' });
      } else if (isUnlocked()) {
        set({ authStatus: 'unlocked', lastActivity: Date.now() });
      } else {
        set({ authStatus: 'locked' });
      }
    } catch {
      set({ authStatus: 'no-pin' });
    }
  },

  createPin: async (pin: string) => {
    try {
      const success = await setupPin(pin);
      if (success) {
        set({ authStatus: 'unlocked', error: '', lastActivity: Date.now() });
        return true;
      }
      set({ error: 'PIN setup failed. Try again.' });
      return false;
    } catch {
      set({ error: 'PIN setup failed. Try again.' });
      return false;
    }
  },

  login: async (pin: string) => {
    try {
      const result = await verifyPin(pin);
      if (result.success) {
        set({
          authStatus: 'unlocked',
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
    lockApp();
    set({ authStatus: 'locked', error: '', remainingAttempts: 5, lockoutRemaining: 0 });
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
      set({ authStatus: 'locked', error: '', remainingAttempts: 5, lockoutRemaining: 0 });
      return true;
    }
    return false;
  },
}));