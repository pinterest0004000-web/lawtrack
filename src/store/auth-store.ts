import { create } from 'zustand';
import { hasAnyUser, createUser, verifyUserPin, getUserByAccessCode, lockApp, isUnlocked, getCurrentUserId, getCurrentUserName, getUsers, type UserProfile } from '@/lib/auth';

type AuthStatus = 'checking' | 'create-user' | 'select-user' | 'login' | 'code-login' | 'show-code' | 'locked' | 'unlocked';

interface AuthStore {
  authStatus: AuthStatus;
  currentUserId: string | null;
  currentUserName: string;
  selectedUser: UserProfile | null; // for code-based direct login
  users: UserProfile[];
  error: string;
  lastActivity: number;
  lockoutRemaining: number;

  checkAuth: () => Promise<void>;
  selectUserAndLogin: (userId: string) => void;
  goToCreateUser: () => void;
  goToSelectUser: () => void;
  createUserAndLogin: (name: string, pin: string) => Promise<{ ok: boolean; accessCode?: string }>;
  loginWithPin: (pin: string) => Promise<boolean>;
  loginForUser: (userId: string, pin: string) => Promise<boolean>;
  logout: () => void;
  recordActivity: () => void;
  checkAutoLock: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  authStatus: 'checking',
  currentUserId: null,
  currentUserName: '',
  selectedUser: null,
  users: [],
  error: '',
  lastActivity: Date.now(),
  lockoutRemaining: 0,

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
      if (!anyUser) {
        set({ authStatus: 'create-user' });
        return;
      }

      const users = await getUsers();

      // Check URL for access code
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const user = await getUserByAccessCode(code);
          if (user) {
            // Found user by code — go straight to their PIN screen
            set({ authStatus: 'code-login', selectedUser: user, users, error: '' });
            return;
          }
          // Invalid code — show user select
        }
      }

      // If only 1 user, go straight to PIN login
      if (users.length === 1) {
        set({ authStatus: 'login', users, error: '' });
        return;
      }

      // Multiple users — show select screen
      set({ authStatus: 'select-user', users, error: '' });
    } catch { set({ authStatus: 'create-user' }); }
  },

  selectUserAndLogin: (userId: string) => {
    const users = get().users;
    const user = users.find(u => u.id === userId);
    if (user) {
      set({ authStatus: 'login', selectedUser: user, error: '', lockoutRemaining: 0 });
    }
  },

  goToCreateUser: () => set({ authStatus: 'create-user', error: '', selectedUser: null }),

  goToSelectUser: () => {
    const users = get().users;
    if (users.length <= 1) {
      set({ authStatus: 'login', selectedUser: null, error: '' });
    } else {
      set({ authStatus: 'select-user', selectedUser: null, error: '' });
    }
  },

  createUserAndLogin: async (name: string, pin: string) => {
    try {
      const user = await createUser(name, pin);
      if (user) {
        const users = await getUsers();
        // Show the access code screen instead of going straight to unlocked
        set({
          authStatus: 'show-code',
          currentUserId: user.id,
          currentUserName: user.name,
          users,
          error: '',
          lastActivity: Date.now(),
          selectedUser: user,
        });
        return { ok: true, accessCode: user.accessCode };
      }
      set({ error: 'Failed. Try again.' });
      return { ok: false };
    } catch { set({ error: 'Failed. Try again.' }); return { ok: false }; }
  },

  loginWithPin: async (pin: string) => {
    const { selectedUser, users } = get();
    // If a user is selected (from code-login or select-user), login for that specific user
    if (selectedUser) {
      return get().loginForUser(selectedUser.id, pin);
    }
    // Legacy: try all users (shouldn't happen anymore with multi-user flow)
    // But for single-user case (no select-user screen), try all
    for (const u of users) {
      const result = await verifyUserPin(u.id, pin);
      if (result.success) {
        set({
          authStatus: 'unlocked',
          currentUserId: u.id,
          currentUserName: u.name,
          error: '',
          lastActivity: Date.now(),
          selectedUser: null,
          lockoutRemaining: 0,
        });
        return true;
      }
    }
    set({ error: 'Wrong PIN' });
    return false;
  },

  loginForUser: async (userId: string, pin: string) => {
    try {
      const result = await verifyUserPin(userId, pin);
      if (result.success) {
        const users = await getUsers();
        set({
          authStatus: 'unlocked',
          currentUserId: userId,
          currentUserName: result.userName,
          users,
          error: '',
          lastActivity: Date.now(),
          selectedUser: null,
          lockoutRemaining: 0,
        });
        return true;
      }
      if (result.locked) {
        set({ authStatus: 'locked', error: `Bahut try kar liya. ${result.lockoutRemaining}s baad try karo`, lockoutRemaining: result.lockoutRemaining });
      } else {
        set({ error: 'Wrong PIN' });
      }
      return false;
    } catch { set({ error: 'Login failed' }); return false; }
  },

  logout: () => {
    lockApp();
    // Clear code param so user doesn't get redirected to same user's PIN
    if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    const users = get().users;
    if (users.length > 1) {
      set({ authStatus: 'select-user', currentUserId: null, error: '', lastActivity: Date.now(), selectedUser: null, lockoutRemaining: 0 });
    } else {
      set({ authStatus: 'login', currentUserId: null, error: '', lastActivity: Date.now(), selectedUser: null, lockoutRemaining: 0 });
    }
  },

  recordActivity: () => set({ lastActivity: Date.now() }),

  checkAutoLock: () => {
    const s = get();
    if (s.authStatus !== 'unlocked') return false;
    if (Date.now() - s.lastActivity >= 5 * 60 * 1000) {
      lockApp();
      const users = s.users;
      // Clear code param on auto-lock too
      if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      if (users.length > 1) {
        set({ authStatus: 'select-user', error: '', selectedUser: null, lockoutRemaining: 0 });
      } else {
        set({ authStatus: 'login', error: '', selectedUser: null, lockoutRemaining: 0 });
      }
      return true;
    }
    return false;
  },
}));