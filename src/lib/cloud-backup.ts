/**
 * Cloud Backup Module for LawTrack
 * - Encrypted backup to Firebase Firestore
 * - Auto-backup on every data change
 * - Restore from cloud on new phone
 * - Data stays encrypted in cloud (AES-256-GCM)
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth, getFirebaseApp } from './firebase';
import { encryptData, decryptData } from './auth';

export interface CloudBackupInfo {
  exists: boolean;
  timestamp: number | null;
  caseCount: number;
  expenseCount: number;
  configured: boolean;
}

// Check if Firebase has real (non-placeholder) config
function isFirebaseReady(): boolean {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth) return false;
  if (!auth.currentUser) return false;
  try {
    const app = getFirebaseApp();
    const opts = app?.options;
    if (!opts) return false;
    const key = opts.apiKey || '';
    if (key.includes('placeholder') || key.includes('000000') || key.length < 20) return false;
    return true;
  } catch {
    return false;
  }
}

/** Save encrypted data to Firestore */
export async function saveToCloud(
  userId: string,
  cases: unknown[],
  expenses: unknown[]
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!isFirebaseReady() || !db) return false;
  try {
    const json = JSON.stringify({ cases, expenses });
    const encrypted = await encryptData(json);
    await setDoc(doc(db, 'backups', userId), {
      d: encrypted,
      t: Date.now(),
      c: cases.length,
      e: expenses.length,
    }, { merge: true });
    return true;
  } catch {
    return false;
  }
}

/** Load and decrypt data from Firestore */
export async function loadFromCloud(
  userId: string
): Promise<{ cases: unknown[]; expenses: unknown[] } | null> {
  const db = getFirebaseDb();
  if (!isFirebaseReady() || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'backups', userId));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (!data?.d) return null;
    const decrypted = await decryptData(data.d);
    const parsed = JSON.parse(decrypted);
    if (!Array.isArray(parsed.cases)) return null;
    return {
      cases: parsed.cases,
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
    };
  } catch {
    return null;
  }
}

/** Get backup metadata without decrypting */
export async function getCloudInfo(userId: string): Promise<CloudBackupInfo> {
  const db = getFirebaseDb();
  if (!isFirebaseReady() || !db) {
    return { exists: false, timestamp: null, caseCount: 0, expenseCount: 0, configured: false };
  }
  try {
    const snap = await getDoc(doc(db, 'backups', userId));
    if (!snap.exists()) {
      return { exists: false, timestamp: null, caseCount: 0, expenseCount: 0, configured: true };
    }
    const d = snap.data();
    return {
      exists: true,
      timestamp: d?.t || null,
      caseCount: d?.c || 0,
      expenseCount: d?.e || 0,
      configured: true,
    };
  } catch {
    return { exists: false, timestamp: null, caseCount: 0, expenseCount: 0, configured: true };
  }
}

export function isCloudReady(): boolean {
  return isFirebaseReady();
}

// ============ UNDO-PAUSE STATE ============
// When a case is deleted with undo, cloud backup is paused for 10s
// so the deleted case isn't immediately backed up to cloud
let _undoPaused = false;
let _undoTimer: ReturnType<typeof setTimeout> | null = null;

/** Pause cloud backup for 10 seconds (called before case delete) */
export function pauseCloudForUndo(): void {
  _undoPaused = true;
  if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; }
  _undoTimer = setTimeout(() => { _undoPaused = false; }, 10000);
}

/** Check if cloud backup is currently paused for undo */
export function isUndoPaused(): boolean {
  return _undoPaused;
}

/** Clear the cloud timer (called by autoBackup before setting a new one) */
export function clearCloudUndoTimer(): void {
  if (_undoTimer) { clearTimeout(_undoTimer); _undoTimer = null; }
}

/** Get raw (encrypted) backup data + metadata — for admin download */
export async function getRawBackup(userId: string): Promise<{
  encrypted: string;
  timestamp: number;
  caseCount: number;
  expenseCount: number;
} | null> {
  const db = getFirebaseDb();
  if (!isFirebaseReady() || !db) return null;
  try {
    const snap = await getDoc(doc(db, 'backups', userId));
    if (!snap.exists()) return null;
    const d = snap.data();
    if (!d?.d) return null;
    return {
      encrypted: d.d,
      timestamp: d.t || 0,
      caseCount: d.c || 0,
      expenseCount: d.e || 0,
    };
  } catch {
    return null;
  }
}