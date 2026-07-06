/**
 * Cloud Backup Module for LawTrack
 * - Encrypted backup to Firebase Firestore
 * - Auto-backup on every data change
 * - Restore from cloud on new phone
 * - Data stays encrypted in cloud (AES-256-GCM)
 */

import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, default as firebaseApp } from './firebase';
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
  if (!db || !firebaseApp) return false;
  try {
    const opts = firebaseApp.options;
    if (!opts) return false;
    const key = opts.apiKey || '';
    // Placeholder detection
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
  if (!isFirebaseReady()) { console.warn('[CloudBackup] Firebase not ready'); return false; }
  try {
    const json = JSON.stringify({ cases, expenses });
    const encrypted = await encryptData(json);
    console.log('[CloudBackup] Saving to Firestore...', userId, cases.length, 'cases');
    await setDoc(doc(db!, 'backups', userId), {
      d: encrypted,
      t: Date.now(),
      c: cases.length,
      e: expenses.length,
    }, { merge: true });
    console.log('[CloudBackup] Save SUCCESS');
    return true;
  } catch (e) {
    console.error('[CloudBackup] Save FAILED:', e);
    return false;
  }
}

/** Load and decrypt data from Firestore */
export async function loadFromCloud(
  userId: string
): Promise<{ cases: unknown[]; expenses: unknown[] } | null> {
  if (!isFirebaseReady()) return null;
  try {
    const snap = await getDoc(doc(db!, 'backups', userId));
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
  if (!isFirebaseReady()) {
    return { exists: false, timestamp: null, caseCount: 0, expenseCount: 0, configured: false };
  }
  try {
    const snap = await getDoc(doc(db!, 'backups', userId));
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