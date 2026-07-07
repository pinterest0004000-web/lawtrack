import { create } from 'zustand';
import { hasAnyUser, createAdmin, createUserAsAdmin, verifyUserPin, getUserByAccessCode, lockApp, isUnlocked, getCurrentUserId, getCurrentUserName, isCurrentUserAdmin, getUsers, deleteUser, regenerateAccessCode, updateUserPin, type UserProfile } from '@/lib/auth';
import { firebaseAnonSignIn, firebaseSignOut } from '@/lib/firebase';

type AuthStatus = 'checking' | 'setup-admin' | 'admin-login' | 'code-login' | 'user-created' | 'manage-users' | 'locked' | 'unlocked';

interface AuthStore {
  authStatus: AuthStatus;
  currentUserId: string | null;
  currentUserName: string;
  isAdmin: boolean;
  selectedUser: UserProfile | null;
  users: UserProfile[];
  error: string;
  lastActivity: number;
  lockoutRemaining: number;
  lastCreatedUser: UserProfile | null;

  checkAuth: () => Promise<void>;
  setupAdmin: (name: string, pin: string) => Promise<{ ok: boolean; user?: UserProfile }>;
  loginWithPin: (pin: string) => Promise<boolean>;
  addUserAsAdmin: (name: string, pin: string) => Promise<{ ok: boolean; user?: UserProfile }>;
  removeUser: (userId: string) => Promise<boolean>;
  changeUserPin: (userId: string, newPin: string) => Promise<boolean>;
  refreshUsers: () => Promise<void>;
  regenerateCode: (userId: string) => Promise<string | null>;
  showManageUsers: () => void;
  dismissManageUsers: () => void;
  logout: () => void;
  recordActivity: () => void;
  checkAutoLock: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  authStatus: 'checking',
  currentUserId: null,
  currentUserName: '',
  isAdmin: false,
  selectedUser: null,
  users: [],
  error: '',
  lastActivity: Date.now(),
  lockoutRemaining: 0,
  lastCreatedUser: null,

  checkAuth: async () => {
    try {
      if (isUnlocked()) {
        set({
          authStatus: 'unlocked',
          currentUserId: getCurrentUserId(),
          currentUserName: getCurrentUserName() || '',
          isAdmin: isCurrentUserAdmin(),
          lastActivity: Date.now(),
        });
        return;
      }
      const anyUser = await hasAnyUser();
      if (!anyUser) {
        set({ authStatus: 'setup-admin' });
        return;
      }

      const users = await getUsers();

      // Check URL for access code (regular user direct link)
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        if (code) {
          const user = await getUserByAccessCode(code);
          if (user && !user.isAdmin) {
            set({ authStatus: 'code-login', selectedUser: user, users, error: '' });
            return;
          }
        }
      }

      // No code → admin login (don't reveal name for security)
      const admin = users.find(u => u.isAdmin) || users[0];
      set({ authStatus: 'admin-login', selectedUser: { ...admin, name: '' }, users, error: '' });
    } catch { set({ authStatus: 'setup-admin' }); }
  },

  setupAdmin: async (name: string, pin: string) => {
    try {
      const user = await createAdmin(name, pin);
      if (user) {
        const users = await getUsers();
        set({
          authStatus: 'unlocked',
          currentUserId: user.id,
          currentUserName: user.name,
          isAdmin: true,
          users,
          error: '',
          lastActivity: Date.now(),
        });
        firebaseAnonSignIn(user.id).catch(() => {});
        return { ok: true, user };
      }
      set({ error: 'Failed. Try again.' });
      return { ok: false };
    } catch { set({ error: 'Failed.' }); return { ok: false }; }
  },

  loginWithPin: async (pin: string) => {
    const { selectedUser } = get();
    if (!selectedUser) return false;
    try {
      const result = await verifyUserPin(selectedUser.id, pin);
      if (result.success) {
        const users = await getUsers();
        set({
          authStatus: 'unlocked',
          currentUserId: selectedUser.id,
          currentUserName: result.userName,
          isAdmin: result.isAdmin,
          users,
          error: '',
          lastActivity: Date.now(),
          selectedUser: null,
          lockoutRemaining: 0,
        });
        firebaseAnonSignIn(selectedUser.id).catch(() => {});
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

  addUserAsAdmin: async (name: string, pin: string) => {
    try {
      const user = await createUserAsAdmin(name, pin);
      if (user) {
        const users = await getUsers();
        set({ users, lastCreatedUser: user, authStatus: 'user-created', error: '' });
        return { ok: true, user };
      }
      set({ error: 'Failed. Try again.' });
      return { ok: false };
    } catch { set({ error: 'Failed.' }); return { ok: false }; }
  },

  removeUser: async (userId: string) => {
    const ok = await deleteUser(userId);
    if (ok) {
      const users = await getUsers();
      set({ users });
    }
    return ok;
  },

  changeUserPin: async (userId: string, newPin: string) => {
    return updateUserPin(userId, newPin);
  },

  refreshUsers: async () => {
    const users = await getUsers();
    set({ users });
  },

  regenerateCode: async (userId: string) => {
    return regenerateAccessCode(userId);
  },

  showManageUsers: () => {
    get().refreshUsers();
    set({ authStatus: 'manage-users', lastCreatedUser: null, error: '' });
  },

  dismissManageUsers: () => {
    set({ authStatus: 'unlocked', lastCreatedUser: null, error: '' });
  },

  logout: () => {
    lockApp();
    firebaseSignOut().catch(() => {});
    if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    const users = get().users;
    const admin = users.find(u => u.isAdmin) || users[0];
    set({ authStatus: 'admin-login', currentUserId: null, error: '', lastActivity: Date.now(), selectedUser: { ...admin, name: '' }, lockoutRemaining: 0, isAdmin: false });
  },

  recordActivity: () => set({ lastActivity: Date.now() }),

  checkAutoLock: () => {
    const s = get();
    if (s.authStatus !== 'unlocked') return false;
    if (Date.now() - s.lastActivity >= 5 * 60 * 1000) {
      lockApp();
      firebaseSignOut().catch(() => {});
      if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      const users = s.users;
      const admin = users.find(u => u.isAdmin) || users[0];
      set({ authStatus: 'admin-login', error: '', selectedUser: { ...admin, name: '' }, lockoutRemaining: 0, isAdmin: false });
      return true;
    }
    return false;
  },
}));