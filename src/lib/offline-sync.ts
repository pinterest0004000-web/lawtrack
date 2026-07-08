/**
 * Offline Sync Module for INSAF
 * - Tracks online/offline status
 * - Queues cloud sync when offline
 * - Auto-syncs to Firebase when internet returns
 */

export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'offline' | 'error';

let _online = typeof navigator !== 'undefined' ? navigator.onLine : true;
let _syncStatus: SyncStatus = 'synced';
let _syncCallback: ((cases: unknown[], expenses: unknown[]) => Promise<boolean>) | null = null;
let _getCurrentData: (() => { cases: unknown[]; expenses: unknown[] }) | null = null;
let _hasPendingSync = false;
let _syncTimer: ReturnType<typeof setTimeout> | null = null;
let _listeners: Set<(status: SyncStatus, online: boolean) => void> = new Set();

// Detect initial state
if (typeof window !== 'undefined') {
  _online = navigator.onLine;
  if (!_online) _syncStatus = 'offline';
}

/** Subscribe to sync status changes */
export function onSyncStatusChange(listener: (status: SyncStatus, online: boolean) => void): () => void {
  _listeners.add(listener);
  return () => { _listeners.delete(listener); };
}

function notifyListeners() {
  for (const fn of _listeners) {
    try { fn(_syncStatus, _online); } catch { /* silent */ }
  }
}

function setSyncStatus(status: SyncStatus) {
  if (_syncStatus === status) return;
  _syncStatus = status;
  notifyListeners();
}

/** Check if currently online */
export function isOnline(): boolean {
  return _online;
}

/** Get current sync status */
export function getSyncStatus(): SyncStatus {
  return _syncStatus;
}

/** Check if there's a pending sync waiting for internet */
export function hasPendingSync(): boolean {
  return _hasPendingSync;
}

/**
 * Initialize the offline sync system.
 * Call this after user logs in.
 *
 * @param syncFn - Function to call that syncs data to cloud (e.g. saveToCloud)
 * @param getDataFn - Function that returns current cases & expenses from store
 */
export function initAutoSync(
  syncFn: (cases: unknown[], expenses: unknown[]) => Promise<boolean>,
  getDataFn: () => { cases: unknown[]; expenses: unknown[] }
): void {
  _syncCallback = syncFn;
  _getCurrentData = getDataFn;

  // Listen for online/offline events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }
}

/** Clean up listeners (call on logout) */
export function destroyAutoSync(): void {
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  }
  _syncCallback = null;
  _getCurrentData = null;
  _hasPendingSync = false;
  if (_syncTimer) { clearTimeout(_syncTimer); _syncTimer = null; }
  setSyncStatus('synced');
}

/** Request a sync - will queue if offline, execute if online */
export function requestSync(): void {
  if (!_syncCallback || !_getCurrentData) return;

  if (!_online) {
    // Mark as pending - will sync when online
    _hasPendingSync = true;
    setSyncStatus('offline');
    return;
  }

  // Online - sync now
  performSync();
}

/** Manually mark that data has changed and needs sync */
export function markDirty(): void {
  if (!_syncCallback || !_getCurrentData) return;

  if (!_online) {
    _hasPendingSync = true;
    setSyncStatus('offline');
    return;
  }

  // Debounce sync by 3 seconds (to avoid rapid syncs)
  if (_syncTimer) clearTimeout(_syncTimer);
  _syncTimer = setTimeout(() => {
    performSync();
  }, 3000);
}

// ============ Internal ============

function handleOnline() {
  _online = true;
  if (_hasPendingSync) {
    // There's data waiting to be synced - do it now
    _hasPendingSync = false;
    // Small delay to let network stabilize
    setTimeout(() => {
      performSync();
    }, 1000);
  } else {
    setSyncStatus('synced');
  }
}

function handleOffline() {
  _online = false;
  setSyncStatus('offline');
}

async function performSync() {
  if (!_syncCallback || !_getCurrentData || !_online) return;

  // Don't sync if there's already a sync in progress
  if (_syncStatus === 'syncing') {
    _hasPendingSync = true; // Re-sync when current one finishes
    return;
  }

  setSyncStatus('syncing');

  try {
    const { cases, expenses } = _getCurrentData();
    const success = await _syncCallback(cases, expenses);

    if (success) {
      setSyncStatus('synced');
      _hasPendingSync = false;
    } else {
      // Sync failed (network issue, auth issue, etc.)
      _hasPendingSync = true;
      if (_online) {
        setSyncStatus('error');
        // Retry after 15 seconds
        setTimeout(() => {
          if (_online && _hasPendingSync) performSync();
        }, 15_000);
      } else {
        setSyncStatus('offline');
      }
    }
  } catch {
    _hasPendingSync = true;
    setSyncStatus('error');
    // Retry after 15 seconds
    setTimeout(() => {
      if (_online && _hasPendingSync) performSync();
    }, 15_000);
  }

  // If another sync was requested while we were syncing
  if (_hasPendingSync && _online) {
    setTimeout(() => performSync(), 3000);
  }
}