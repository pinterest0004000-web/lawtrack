'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

interface ToastItem {
  id: string;
  message: string;
  description?: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration: number;
  action?: { label: string; onClick: () => void };
  actionButtonStyle?: React.CSSProperties;
}

let listeners: Set<(t: ToastItem) => void> = new Set();
let toastQueue: ToastItem[] = [];

function emitToast(t: ToastItem) {
  toastQueue.push(t);
  listeners.forEach(l => l(t));
}

// Global toast API — compatible with sonner's toast function
export const toast = {
  success: (message: string, opts?: { description?: string; duration?: number }) => {
    emitToast({ id: Math.random().toString(36).slice(2), message, type: 'success', duration: opts?.duration || 3000, description: opts?.description });
  },
  error: (message: string, opts?: { description?: string; duration?: number }) => {
    emitToast({ id: Math.random().toString(36).slice(2), message, type: 'error', duration: opts?.duration || 4000, description: opts?.description });
  },
  info: (message: string, opts?: { description?: string; duration?: number }) => {
    emitToast({ id: Math.random().toString(36).slice(2), message, type: 'info', duration: opts?.duration || 3000, description: opts?.description });
  },
  warning: (message: string, opts?: { description?: string; duration?: number }) => {
    emitToast({ id: Math.random().toString(36).slice(2), message, type: 'warning', duration: opts?.duration || 4000, description: opts?.description });
  },
  // Overload: toast(message, options) for custom toasts (like delete undo)
  default: (message: string, opts?: { description?: string; duration?: number; action?: { label: string; onClick: () => void }; actionButtonStyle?: React.CSSProperties }) => {
    emitToast({ id: Math.random().toString(36).slice(2), message, type: 'info', duration: opts?.duration || 3000, description: opts?.description, action: opts?.action, actionButtonStyle: opts?.actionButtonStyle });
  },
};

const COLORS = {
  success: 'bg-emerald-600 border-emerald-500/50',
  error: 'bg-red-600 border-red-500/50',
  info: 'bg-zinc-800 border-zinc-700/50',
  warning: 'bg-amber-600 border-amber-500/50',
};

const ICONS = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

export default function AppToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (t: ToastItem) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => {
        setToasts(prev => prev.filter(x => x.id !== t.id));
      }, t.duration);
    };
    listeners.add(handler);
    // Replay any toasts that fired before mount
    toastQueue.forEach(handler);
    toastQueue = [];
    return () => { listeners.delete(handler); };
  }, []);

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[999999] flex flex-col items-center gap-2 pointer-events-none" style={{ maxWidth: '90vw' }}>
      {toasts.map(t => (
        <div
          key={t.id}
          className={`${COLORS[t.type]} border rounded-xl px-4 py-3 shadow-2xl shadow-black/50 flex flex-col gap-1 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200`}
          style={{ minWidth: 240, maxWidth: 380 }}
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold">{ICONS[t.type]}</span>
            <span className="text-sm font-semibold text-white flex-1">{t.message}</span>
          </div>
          {t.description && (
            <p className="text-xs text-zinc-300 pl-6">{t.description}</p>
          )}
          {t.action && (
            <button
              onClick={t.action.onClick}
              className="mt-1 ml-auto text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
              style={t.actionButtonStyle || { backgroundColor: '#7c3aed' }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}