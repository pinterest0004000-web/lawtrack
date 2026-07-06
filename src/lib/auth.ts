/**
 * Multi-User Security Module for LawTrack
 * - Multiple user profiles, each with own PIN + encrypted data
 * - Per-user AES-256-GCM encryption via Web Crypto API
 * - Brute-force protection (5 attempts, 60s lockout) per user
 * - In-memory encryption key (never persisted)
 */

const AUTH_DB = 'lawtrack_auth';
const USERS_KEY = 'users';
const LOCKOUT_PREFIX = 'lockout_';

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 60_000;

export interface UserProfile {
  id: string;
  name: string;
  pinHash: string;
  salt: string;
  createdAt: number;
}

let _encryptionKey: CryptoKey | null = null;
let _currentUserId: string | null = null;

// ============ IndexedDB Helper ============

function openAuthDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(AUTH_DB, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('auth')) {
        db.createObjectStore('auth', { keyPath: 'key' });
      }
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

// ============ Crypto Helpers ============

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function generateSalt(): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(salt.buffer);
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64ToArrayBuffer(salt), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return arrayBufferToBase64(bits);
}

async function deriveEncryptionKey(pin: string, salt: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ToArrayBuffer(salt), iterations: 100_000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

// ============ Encryption / Decryption ============

export async function encryptData(plaintext: string): Promise<string> {
  if (!_encryptionKey) return plaintext;
  try {
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, _encryptionKey, encoder.encode(plaintext));
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    return arrayBufferToBase64(combined.buffer);
  } catch { return plaintext; }
}

export async function decryptData(ciphertext: string): Promise<string> {
  if (!_encryptionKey) return ciphertext;
  if (!ciphertext || ciphertext.length < 24) return ciphertext;
  try {
    const combined = new Uint8Array(base64ToArrayBuffer(ciphertext));
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, _encryptionKey, data);
    return new TextDecoder().decode(decrypted);
  } catch { return ciphertext; }
}

export function hasEncryptionKey(): boolean {
  return _encryptionKey !== null;
}

export function getCurrentUserId(): string | null {
  return _currentUserId;
}

// ============ User Management ============

export async function getUsers(): Promise<UserProfile[]> {
  try {
    const val = await getAuthValue(USERS_KEY);
    if (!val) return [];
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

async function saveUsers(users: UserProfile[]): Promise<boolean> {
  return setAuthValue(USERS_KEY, JSON.stringify(users));
}

export async function createUser(name: string, pin: string): Promise<UserProfile | null> {
  try {
    const users = await getUsers();
    const salt = await generateSalt();
    const hash = await hashPin(pin, salt);
    const user: UserProfile = {
      id: crypto.randomUUID?.() ?? String(Date.now()) + String(Math.random()).slice(2, 8),
      name: name.trim(),
      pinHash: hash,
      salt,
      createdAt: Date.now(),
    };
    users.push(user);
    await saveUsers(users);
    return user;
  } catch { return null; }
}

export async function deleteUser(userId: string): Promise<boolean> {
  try {
    const users = await getUsers();
    const filtered = users.filter(u => u.id !== userId);
    if (filtered.length === users.length) return false;
    await saveUsers(filtered);
    // Also delete the user's database
    if (typeof window !== 'undefined') {
      indexedDB.deleteDatabase(`lawtrack_${userId}`);
    }
    return true;
  } catch { return false; }
}

export async function verifyUserPin(userId: string, pin: string): Promise<{
  success: boolean; locked: boolean; remainingAttempts: number; lockoutRemaining: number; userName: string;
}> {
  // Check per-user lockout
  const lockoutVal = await getAuthValue(`${LOCKOUT_PREFIX}${userId}`);
  if (lockoutVal) {
    const lockTime = parseInt(lockoutVal, 10);
    if (Date.now() < lockTime) {
      return { success: false, locked: true, remainingAttempts: 0, lockoutRemaining: Math.ceil((lockTime - Date.now()) / 1000), userName: '' };
    } else {
      await setAuthValue(`${LOCKOUT_PREFIX}${userId}`, '');
      await setAuthValue(`attempts_${userId}`, '0');
    }
  }

  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return { success: false, locked: false, remainingAttempts: 0, lockoutRemaining: 0, userName: '' };

  const hash = await hashPin(pin, user.salt);

  if (hash === user.pinHash) {
    await setAuthValue(`attempts_${userId}`, '0');
    _encryptionKey = await deriveEncryptionKey(pin, user.salt);
    _currentUserId = userId;
    return { success: true, locked: false, remainingAttempts: MAX_ATTEMPTS, lockoutRemaining: 0, userName: user.name };
  }

  // Wrong PIN
  const attemptsStr = await getAuthValue(`attempts_${userId}`);
  const attempts = (parseInt(attemptsStr, 10) || 0) + 1;
  const remaining = Math.max(0, MAX_ATTEMPTS - attempts);

  if (attempts >= MAX_ATTEMPTS) {
    const lockUntil = Date.now() + LOCKOUT_DURATION;
    await setAuthValue(`attempts_${userId}`, String(attempts));
    await setAuthValue(`${LOCKOUT_PREFIX}${userId}`, String(lockUntil));
    return { success: false, locked: true, remainingAttempts: 0, lockoutRemaining: Math.ceil(LOCKOUT_DURATION / 1000), userName: user.name };
  }

  await setAuthValue(`attempts_${userId}`, String(attempts));
  return { success: false, locked: false, remainingAttempts: remaining, lockoutRemaining: 0, userName: user.name };
}

export async function setupFirstUserAndLogin(name: string, pin: string): Promise<UserProfile | null> {
  const user = await createUser(name, pin);
  if (!user) return null;
  _encryptionKey = await deriveEncryptionKey(pin, user.salt);
  _currentUserId = user.id;
  return user;
}

// ============ Session Management ============

export function lockApp(): void {
  _encryptionKey = null;
  // Keep _currentUserId so we know which user to show on re-login
}

export function isUnlocked(): boolean {
  return _encryptionKey !== null;
}