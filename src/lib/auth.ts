/**
 * Security Module for LawTrack
 * - Admin creates users & sets their PINs
 * - Each user gets unique access code URL
 * - Per-user AES-256-GCM encrypted database
 * - Brute-force protection per-user (5 attempts, 60s lockout)
 */

const AUTH_DB = 'lawtrack_auth';
const USERS_KEY = 'users';
const LOCKOUT_PREFIX = 'lockout_';
const ATTEMPTS_PREFIX = 'attempts_';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60_000;

export interface UserProfile {
  id: string;
  name: string;
  pinHash: string;
  salt: string;
  accessCode: string;
  isAdmin: boolean;
  createdAt: number;
}

let _encryptionKey: CryptoKey | null = null;
let _currentUserId: string | null = null;
let _currentUserName: string | null = null;
let _currentIsAdmin: boolean = false;

// ============ IndexedDB ============

function openAuthDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AUTH_DB, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('auth')) db.createObjectStore('auth', { keyPath: 'key' });
    };
  });
}

async function getAuthValue(key: string): Promise<string> {
  try {
    if (typeof window === 'undefined') return '';
    const db = await openAuthDB();
    return new Promise((resolve) => {
      const tx = db.transaction('auth', 'readonly');
      const req = tx.objectStore('auth').get(key);
      req.onsuccess = () => resolve(req.result?.value ?? '');
      req.onerror = () => resolve('');
    });
  } catch { return ''; }
}

async function setAuthValue(key: string, value: string): Promise<boolean> {
  try {
    if (typeof window === 'undefined') return false;
    const db = await openAuthDB();
    return new Promise((resolve) => {
      const tx = db.transaction('auth', 'readwrite');
      tx.objectStore('auth').put({ key, value });
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch { return false; }
}

// ============ Crypto ============

function toBase64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf); let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function fromBase64(b64: string): ArrayBuffer {
  const s = atob(b64); const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b.buffer;
}

async function genSalt(): Promise<string> {
  return toBase64(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromBase64(salt), iterations: 100_000, hash: 'SHA-256' }, km, 256);
  return toBase64(bits);
}

async function deriveKey(pin: string, salt: string): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: fromBase64(salt), iterations: 100_000, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

// ============ Encrypt / Decrypt ============

export async function encryptData(plaintext: string): Promise<string> {
  if (!_encryptionKey) return plaintext;
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, _encryptionKey, new TextEncoder().encode(plaintext));
    const c = new Uint8Array(iv.length + enc.byteLength);
    c.set(iv, 0); c.set(new Uint8Array(enc), iv.length);
    return toBase64(c.buffer);
  } catch { return plaintext; }
}

export async function decryptData(ciphertext: string): Promise<string> {
  if (!_encryptionKey || !ciphertext || ciphertext.length < 24) return ciphertext;
  try {
    const c = new Uint8Array(fromBase64(ciphertext));
    const dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: c.slice(0, 12) }, _encryptionKey, c.slice(12));
    return new TextDecoder().decode(dec);
  } catch { return ciphertext; }
}

export function hasEncryptionKey(): boolean { return _encryptionKey !== null; }
export function getCurrentUserId(): string | null { return _currentUserId; }
export function getCurrentUserName(): string | null { return _currentUserName; }
export function isCurrentUserAdmin(): boolean { return _currentIsAdmin; }

// ============ User Management ============

export async function getUsers(): Promise<UserProfile[]> {
  try {
    const v = await getAuthValue(USERS_KEY);
    if (!v) return [];
    const p: UserProfile[] = JSON.parse(v);
    if (!Array.isArray(p)) return [];
    let migrated = false;
    for (let i = 0; i < p.length; i++) {
      const u = p[i];
      if (!u.accessCode) { u.accessCode = generateAccessCode(); migrated = true; }
      if (u.isAdmin === undefined) { u.isAdmin = (i === 0); migrated = true; }
    }
    // Ensure first user is always admin
    if (p.length > 0 && !p[0].isAdmin) { p[0].isAdmin = true; migrated = true; }
    if (migrated) await saveUsers(p);
    return p;
  } catch { return []; }
}

async function saveUsers(users: UserProfile[]): Promise<boolean> {
  return setAuthValue(USERS_KEY, JSON.stringify(users));
}

export async function hasAnyUser(): Promise<boolean> {
  const users = await getUsers();
  return users.length > 0;
}

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const arr = crypto.getRandomValues(new Uint8Array(6));
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[arr[i] % chars.length];
  return code;
}

// Admin creates their own account (first user)
export async function createAdmin(name: string, pin: string): Promise<UserProfile | null> {
  try {
    const users = await getUsers();
    if (users.length > 0) return null; // Admin already exists
    const salt = await genSalt();
    const hash = await hashPin(pin, salt);
    const code = generateAccessCode();
    const user: UserProfile = {
      id: crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: name.trim(),
      pinHash: hash, salt, accessCode: code, isAdmin: true, createdAt: Date.now(),
    };
    users.push(user);
    await saveUsers(users);
    _encryptionKey = await deriveKey(pin, salt);
    _currentUserId = user.id;
    _currentUserName = user.name;
    _currentIsAdmin = true;
    return user;
  } catch { return null; }
}

// Admin creates a user — does NOT switch to that user, admin stays logged in
export async function createUserAsAdmin(name: string, pin: string): Promise<UserProfile | null> {
  try {
    const users = await getUsers();
    if (users.length === 0) return null;
    const salt = await genSalt();
    const hash = await hashPin(pin, salt);
    const code = generateAccessCode();
    const user: UserProfile = {
      id: crypto.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      name: name.trim(),
      pinHash: hash, salt, accessCode: code, isAdmin: false, createdAt: Date.now(),
    };
    users.push(user);
    await saveUsers(users);
    return user; // Admin's session stays intact
  } catch { return null; }
}

// Admin changes a user's PIN
export async function updateUserPin(userId: string, newPin: string): Promise<boolean> {
  try {
    const users = await getUsers();
    const user = users.find(u => u.id === userId);
    if (!user || user.isAdmin) return false;
    const salt = await genSalt();
    const hash = await hashPin(newPin, salt);
    user.salt = salt;
    user.pinHash = hash;
    await saveUsers(users);
    return true;
  } catch { return false; }
}

export async function deleteUser(userId: string): Promise<boolean> {
  try {
    const users = await getUsers();
    const target = users.find(u => u.id === userId);
    if (!target || target.isAdmin) return false; // Can't delete admin
    const f = users.filter(u => u.id !== userId);
    await saveUsers(f);
    if (typeof window !== 'undefined') indexedDB.deleteDatabase(`lawtrack_${userId}`);
    return true;
  } catch { return false; }
}

// Verify PIN for a specific user
export async function verifyUserPin(userId: string, pin: string): Promise<{
  success: boolean; locked: boolean; remainingAttempts: number; lockoutRemaining: number; userName: string; isAdmin: boolean;
}> {
  const lv = await getAuthValue(`${LOCKOUT_PREFIX}${userId}`);
  if (lv) {
    const lt = parseInt(lv, 10);
    if (Date.now() < lt) {
      const users = await getUsers();
      const u = users.find(x => x.id === userId);
      return { success: false, locked: true, remainingAttempts: 0, lockoutRemaining: Math.ceil((lt - Date.now()) / 1000), userName: u?.name || '', isAdmin: u?.isAdmin || false };
    } else {
      await setAuthValue(`${LOCKOUT_PREFIX}${userId}`, '');
      await setAuthValue(`${ATTEMPTS_PREFIX}${userId}`, '0');
    }
  }

  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return { success: false, locked: false, remainingAttempts: 0, lockoutRemaining: 0, userName: '', isAdmin: false };

  const h = await hashPin(pin, user.salt);
  if (h === user.pinHash) {
    await setAuthValue(`${ATTEMPTS_PREFIX}${userId}`, '0');
    _encryptionKey = await deriveKey(pin, user.salt);
    _currentUserId = userId;
    _currentUserName = user.name;
    _currentIsAdmin = user.isAdmin;
    return { success: true, locked: false, remainingAttempts: MAX_ATTEMPTS, lockoutRemaining: 0, userName: user.name, isAdmin: user.isAdmin };
  }

  const aStr = await getAuthValue(`${ATTEMPTS_PREFIX}${userId}`);
  const a = (parseInt(aStr, 10) || 0) + 1;
  const rem = Math.max(0, MAX_ATTEMPTS - a);

  if (a >= MAX_ATTEMPTS) {
    const lu = Date.now() + LOCKOUT_DURATION;
    await setAuthValue(`${ATTEMPTS_PREFIX}${userId}`, String(a));
    await setAuthValue(`${LOCKOUT_PREFIX}${userId}`, String(lu));
    return { success: false, locked: true, remainingAttempts: 0, lockoutRemaining: Math.ceil(LOCKOUT_DURATION / 1000), userName: user.name, isAdmin: user.isAdmin };
  }

  await setAuthValue(`${ATTEMPTS_PREFIX}${userId}`, String(a));
  return { success: false, locked: false, remainingAttempts: rem, lockoutRemaining: 0, userName: user.name, isAdmin: user.isAdmin };
}

// ============ Access Code ============

export async function getUserByAccessCode(code: string): Promise<UserProfile | null> {
  const users = await getUsers();
  const upper = code.toUpperCase().trim();
  return users.find(u => u.accessCode === upper) || null;
}

export async function regenerateAccessCode(userId: string): Promise<string | null> {
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  user.accessCode = generateAccessCode();
  await saveUsers(users);
  return user.accessCode;
}

// ============ Session ============

export function lockApp(): void {
  _encryptionKey = null;
  _currentIsAdmin = false;
}
export function isUnlocked(): boolean { return _encryptionKey !== null; }