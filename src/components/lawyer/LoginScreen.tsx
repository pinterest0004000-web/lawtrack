'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { regenerateAccessCode, updateUserPin } from '@/lib/auth';
import { Shield, Lock, Eye, EyeOff, AlertTriangle, ArrowLeft, Copy, RefreshCw, Trash2, Key, Users, UserPlus, X, Pencil, Check, Crown, CloudDownload } from 'lucide-react';
import { getRawBackup, isCloudReady } from '@/lib/cloud-backup';

function PinDots({ filled, shake }: { filled: number; shake: boolean }) {
  return (
    <div className={`flex justify-center gap-4 mb-6 ${shake ? 'animate-pin-shake' : ''}`}>
      {[0,1,2,3].map(i => (
        <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
          i < filled ? 'bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.5)] scale-110' : 'bg-zinc-700 border border-zinc-600'
        }`} />
      ))}
    </div>
  );
}

function Numpad({ onDigit, onDelete, disabled }: { onDigit: (d: string) => void; onDelete: () => void; disabled: boolean }) {
  const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];
  return (
    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
      {keys.map((key, i) => {
        if (key === '') return <div key={`e-${i}`} />;
        if (key === 'del') return (
          <button key="del" onClick={onDelete} disabled={disabled}
            className="h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center active:bg-zinc-700/60 transition-colors disabled:opacity-40" aria-label="Delete">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/>
            </svg>
          </button>
        );
        return (
          <button key={key} onClick={() => onDigit(key)} disabled={disabled}
            className="h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-xl font-semibold text-white active:bg-violet-600/20 active:border-violet-500/30 transition-colors disabled:opacity-40">
            {key}
          </button>
        );
      })}
    </div>
  );
}

// ============ ADMIN SETUP (first time) ============
function AdminSetupScreen() {
  const { setupAdmin, error } = useAuthStore();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'name' | 'pin' | 'confirm'>('name');
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const triggerShake = useCallback(() => { setShake(true); setTimeout(() => setShake(false), 500); }, []);

  const submitName = () => {
    if (name.trim().length < 2) return;
    useAuthStore.setState({ error: '' });
    setStep('pin');
  };

  const handleDigit = useCallback((d: string) => {
    if (step === 'pin') {
      const p = pin + d;
      if (p.length <= 4) { setPin(p); if (p.length === 4) { setStep('confirm'); setConfirmPin(''); } }
    } else {
      const c = confirmPin + d;
      if (c.length <= 4) {
        setConfirmPin(c);
        if (c.length === 4) {
          if (c === pin) {
            setSaving(true);
            setupAdmin(name.trim(), pin).then(res => { if (!res.ok) { triggerShake(); setSaving(false); } });
          } else {
            triggerShake();
            setTimeout(() => { setStep('pin'); setPin(''); setConfirmPin(''); useAuthStore.setState({ error: 'PIN match nahi hua. Dobara daalo.' }); }, 500);
          }
        }
      }
    }
  }, [step, pin, confirmPin, name, setupAdmin, triggerShake]);

  const handleDelete = useCallback(() => {
    if (step === 'confirm') setConfirmPin(p => p.slice(0, -1));
    else setPin(p => p.slice(0, -1));
  }, [step]);

  const len = step === 'confirm' ? confirmPin.length : pin.length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {step !== 'name' && (
          <button onClick={() => { setStep(step === 'confirm' ? 'pin' : 'name'); useAuthStore.setState({ error: '' }); }}
            className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center z-10">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
        )}

        <div className="w-20 h-20 rounded-3xl bg-amber-600/15 border border-amber-500/20 flex items-center justify-center mb-6">
          <Crown className="w-10 h-10 text-amber-400" />
        </div>

        {step === 'name' ? (
          <>
            <h1 className="text-xl font-bold text-white mb-1">Admin Setup</h1>
            <p className="text-sm text-zinc-400 mb-6">Apna naam aur PIN set karo — yeh tumhari app hai</p>
            <div className="max-w-[300px] w-full">
              <input type="text" value={name} onChange={e => { setName(e.target.value); useAuthStore.setState({ error: '' }); }}
                onKeyDown={e => e.key === 'Enter' && submitName()} placeholder="Apna naam likho"
                className="w-full px-4 py-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-white text-base placeholder-zinc-500 outline-none focus:border-violet-500/40 transition-colors"
                maxLength={20} autoFocus />
              <button onClick={submitName} disabled={name.trim().length < 2}
                className="w-full mt-3 py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-40 active:bg-violet-700 transition-colors">
                Aage Badho
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-0.5">{step === 'pin' ? 'Apna PIN Set Karo' : 'PIN Confirm Karo'}</h1>
            <p className="text-sm text-zinc-400 mb-3">{step === 'pin' ? '4-digit PIN daalo' : 'Wahi PIN dobara daalo'}</p>
            <button onClick={() => setShowPin(p => !p)} className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4">
              {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPin ? 'Chhupo' : 'Dikhao'}
            </button>
            {showPin ? (
              <div className={`flex justify-center gap-4 mb-6 font-mono text-2xl tracking-[0.5em] text-white ${shake ? 'animate-pin-shake' : ''}`}>
                {(step === 'confirm' ? confirmPin : pin).padEnd(4, '·')}
              </div>
            ) : <PinDots filled={len} shake={shake} />}
            {error && (
              <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[300px] w-full">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400 text-center">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
      {step !== 'name' && (
        <div className="pb-8 pt-4 px-6">
          <Numpad onDigit={handleDigit} onDelete={handleDelete} disabled={saving} />
        </div>
      )}
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}

// ============ PIN LOGIN (admin or user via code) ============
function PinLoginScreen() {
  const { loginWithPin, error, selectedUser, lockoutRemaining, checkAuth } = useAuthStore();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);
  const userName = selectedUser?.name || '';

  const isLockedOut = lockoutRemaining > 0 && tick < lockoutRemaining;

  useEffect(() => {
    if (lockoutRemaining <= 0) { tickRef.current = 0; return; }
    tickRef.current = 0;
    const t = setInterval(() => {
      tickRef.current++;
      setTick(tickRef.current);
      if (tickRef.current >= lockoutRemaining) { clearInterval(t); checkAuth(); }
    }, 1000);
    return () => clearInterval(t);
  }, [lockoutRemaining, checkAuth]);

  const triggerShake = useCallback(() => { setShake(true); setTimeout(() => setShake(false), 500); }, []);

  const handleDigit = useCallback((d: string) => {
    if (isLockedOut) return;
    const p = pin + d;
    if (p.length <= 4) {
      setPin(p);
      if (p.length === 4) {
        loginWithPin(p).then(ok => { if (!ok) { triggerShake(); setTimeout(() => setPin(''), 500); } });
      }
    }
  }, [pin, loginWithPin, triggerShake, isLockedOut]);

  const handleDelete = useCallback(() => { if (!isLockedOut) setPin(p => p.slice(0, -1)); }, [isLockedOut]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {userName ? (
          <div className="w-20 h-20 rounded-3xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-violet-300">{userName.slice(0, 2).toUpperCase()}</span>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-3xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-6">
            <Lock className="w-10 h-10 text-violet-400" />
          </div>
        )}

        <h1 className="text-xl font-bold text-white mb-0.5">
          {userName ? `${userName}, PIN Daalo` : 'PIN Daalo'}
        </h1>
        <p className="text-sm text-zinc-400 mb-3">4-digit PIN enter karo</p>

        <button onClick={() => setShowPin(p => !p)} className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4">
          {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showPin ? 'Chhupo' : 'Dikhao'}
        </button>

        {showPin ? (
          <div className={`flex justify-center gap-4 mb-6 font-mono text-2xl tracking-[0.5em] text-white ${shake ? 'animate-pin-shake' : ''}`}>
            {pin.padEnd(4, '·')}
          </div>
        ) : <PinDots filled={pin.length} shake={shake} />}

        {error && !isLockedOut && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[300px] w-full">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        )}

        {isLockedOut && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 max-w-[300px] w-full">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400 text-center">
              {error || `Locked. ${Math.max(0, lockoutRemaining - tick)}s baad try karo`}
            </p>
          </div>
        )}
      </div>

      <div className="pb-4 pt-4 px-6">
        <Numpad onDigit={handleDigit} onDelete={handleDelete} disabled={isLockedOut} />
      </div>

      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}

// ============ ADD USER (admin sets name + PIN) ============
function AddUserScreen() {
  const { addUserAsAdmin, error, dismissManageUsers } = useAuthStore();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [step, setStep] = useState<'name' | 'pin'>('name');
  const [shake, setShake] = useState(false);
  const [saving, setSaving] = useState(false);

  const submitName = () => {
    if (name.trim().length < 2) return;
    useAuthStore.setState({ error: '' });
    setStep('pin');
  };

  const handleDigit = useCallback((d: string) => {
    const p = pin + d;
    if (p.length <= 4) {
      setPin(p);
      if (p.length === 4) {
        setSaving(true);
        addUserAsAdmin(name.trim(), p).then(res => {
          if (!res.ok) { setShake(true); setTimeout(() => setShake(false), 500); setSaving(false); setPin(''); }
          // On success, store handles transition to user-created
        });
      }
    }
  }, [pin, name, addUserAsAdmin]);

  const handleDelete = useCallback(() => setPin(p => p.slice(0, -1)), []);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <button onClick={dismissManageUsers}
          className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center z-10">
          <X className="w-4 h-4 text-zinc-400" />
        </button>

        <div className="w-20 h-20 rounded-3xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-6">
          <UserPlus className="w-10 h-10 text-violet-400" />
        </div>

        {step === 'name' ? (
          <>
            <h1 className="text-xl font-bold text-white mb-1">User Ka Naam</h1>
            <p className="text-sm text-zinc-400 mb-6">Jis user ko add karna hai uska naam</p>
            <div className="max-w-[300px] w-full">
              <input type="text" value={name} onChange={e => { setName(e.target.value); useAuthStore.setState({ error: '' }); }}
                onKeyDown={e => e.key === 'Enter' && submitName()} placeholder="User ka naam"
                className="w-full px-4 py-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-white text-base placeholder-zinc-500 outline-none focus:border-violet-500/40 transition-colors"
                maxLength={20} autoFocus />
              <button onClick={submitName} disabled={name.trim().length < 2}
                className="w-full mt-3 py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-40 active:bg-violet-700 transition-colors">
                Aage Badho — PIN Set Karo
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-0.5">{name.trim()} Ka PIN</h1>
            <p className="text-sm text-zinc-400 mb-3">Is user ke liye 4-digit PIN set karo</p>
            <PinDots filled={pin.length} shake={shake} />
            {error && (
              <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[300px] w-full">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-400 text-center">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
      {step === 'pin' && (
        <div className="pb-8 pt-4 px-6">
          <Numpad onDigit={handleDigit} onDelete={handleDelete} disabled={saving} />
        </div>
      )}
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}

// ============ USER CREATED — show code+PIN to admin ============
function UserCreatedScreen() {
  const { lastCreatedUser, dismissManageUsers } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const code = lastCreatedUser?.accessCode || '';
  const name = lastCreatedUser?.name || '';

  const handleCopy = async () => {
    const url = `${window.location.origin}${window.location.pathname}?code=${code}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!lastCreatedUser) return null;
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-1">User Ban Gaya! ✅</h1>
        <p className="text-sm text-zinc-400 mb-6">{name} ka account ready hai</p>

        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-2xl p-4 max-w-[320px] w-full mb-4 space-y-4">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Access Code (Link)</p>
            <div className="flex items-center justify-between">
              <span className="text-lg font-mono font-bold text-emerald-400 tracking-[0.3em]">{code}</span>
              <button onClick={handleCopy} className="p-2 rounded-xl bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors">
                {copied ? <span className="text-[11px] text-emerald-400">Copied!</span> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="border-t border-zinc-700/50 pt-3">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">PIN</p>
            <p className="text-xs text-zinc-300">Is user ko link + PIN dono do</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 max-w-[320px] w-full">
          <button onClick={() => { useAuthStore.setState({ authStatus: 'add-user', lastCreatedUser: null }); }}
            className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm active:bg-violet-700 transition-colors">
            Aur User Add Karo
          </button>
          <button onClick={dismissManageUsers}
            className="w-full py-3 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-sm text-zinc-300 active:bg-zinc-700/40 transition-colors">
            Wapas Jaao
          </button>
        </div>
      </div>
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}

// ============ MANAGE USERS (admin only, overlay) ============
function ManageUsersOverlay() {
  const { users, removeUser, regenerateCode, refreshUsers, dismissManageUsers, addUserAsAdmin } = useAuthStore();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingPin, setEditingPin] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const regularUsers = users.filter(u => !u.isAdmin);

  const handleDelete = async (userId: string) => {
    setDeleting(userId);
    await removeUser(userId);
    setDeleting(null);
  };

  const handleCopy = async (code: string, userId: string) => {
    const url = `${window.location.origin}${window.location.pathname}?code=${code}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopiedId(userId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleRegenerate = async (userId: string) => {
    await regenerateCode(userId);
    await refreshUsers();
  };

  const handleSavePin = async (userId: string) => {
    if (newPin.length !== 4) return;
    setPinSaving(true);
    await useAuthStore.getState().changeUserPin(userId, newPin);
    setPinSaving(false);
    setEditingPin(null);
    setNewPin('');
  };

  const handleAddUser = () => {
    useAuthStore.setState({ authStatus: 'add-user' });
  };

  const handleDownloadBackup = async (userId: string, userName: string) => {
    if (!isCloudReady()) return;
    setDownloading(userId);
    try {
      const raw = await getRawBackup(userId);
      if (!raw) { setDownloading(null); return; }
      // Download as encrypted JSON file
      const fileData = JSON.stringify({ _type: 'lawtrack_backup', _user: userName, _downloaded: Date.now(), encrypted: raw.encrypted, timestamp: raw.timestamp, caseCount: raw.caseCount, expenseCount: raw.expenseCount }, null, 2);
      const blob = new Blob([fileData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `LawTrack_Backup_${userName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* silent */ }
    setDownloading(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="w-full max-w-[400px] max-h-[85vh] bg-[#0f0f18] border border-zinc-800 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-violet-400" />
            <h2 className="text-base font-bold text-white">Users Manage Karo</h2>
          </div>
          <button onClick={dismissManageUsers} className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {regularUsers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-10 h-10 text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">Koi user nahi hai</p>
              <p className="text-xs text-zinc-600 mt-1">Naye users add karo neeche button se</p>
            </div>
          ) : (
            regularUsers.map(user => (
              <div key={user.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl p-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-violet-300">{user.name.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                    <button onClick={() => setShowCodes(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                      className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors mt-0.5">
                      <Key className="w-2.5 h-2.5" />
                      {showCodes[user.id] ? 'Chhupo' : 'Code + Link Dekho'}
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleDownloadBackup(user.id, user.name)} disabled={downloading === user.id || !isCloudReady()}
                      className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center text-zinc-500 hover:text-sky-400 transition-colors disabled:opacity-30" title="Cloud Backup Download">
                      {downloading === user.id ? <div className="w-3.5 h-3.5 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" /> : <CloudDownload className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => { setEditingPin(user.id); setNewPin(''); }}
                      className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center text-zinc-500 hover:text-amber-400 transition-colors" title="PIN Badlo">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleRegenerate(user.id)}
                      className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center text-zinc-500 hover:text-violet-400 transition-colors" title="Naya Code">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(user.id)} disabled={deleting === user.id}
                      className="w-8 h-8 rounded-lg bg-zinc-700/50 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-40" title="Delete">
                      {deleting === user.id ? <div className="w-3.5 h-3.5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Show code + copy */}
                {showCodes[user.id] && (
                  <div className="mt-3 pt-3 border-t border-zinc-700/50 flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-emerald-400 tracking-wider">{user.accessCode}</span>
                      {copiedId === user.id && <span className="text-[9px] text-emerald-400 ml-2">Copied!</span>}
                    </div>
                    <button onClick={() => handleCopy(user.accessCode, user.id)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400 font-medium">
                      Copy Link
                    </button>
                  </div>
                )}

                {/* Edit PIN inline */}
                {editingPin === user.id && (
                  <div className="mt-3 pt-3 border-t border-zinc-700/50">
                    <p className="text-[10px] text-zinc-500 mb-2">Naya PIN (4-digit):</p>
                    <div className="flex items-center gap-2">
                      <input type="text" inputMode="numeric" maxLength={4} value={newPin}
                        onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                        placeholder="••••"
                        className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-white text-sm font-mono tracking-widest text-center outline-none focus:border-violet-500/40" />
                      <button onClick={() => handleSavePin(user.id)} disabled={newPin.length !== 4 || pinSaving}
                        className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center disabled:opacity-40">
                        {pinSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-4 h-4 text-white" />}
                      </button>
                      <button onClick={() => { setEditingPin(null); setNewPin(''); }}
                        className="w-9 h-9 rounded-lg bg-zinc-700/50 flex items-center justify-center">
                        <X className="w-4 h-4 text-zinc-400" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Add user button */}
        <div className="p-4 border-t border-zinc-800 flex-shrink-0">
          <button onClick={handleAddUser}
            className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm active:bg-violet-700 transition-colors flex items-center justify-center gap-2">
            <UserPlus className="w-4 h-4" />
            Naya User Add Karo
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ ADD USER (full screen, triggered from manage overlay) ============
// Reuses AddUserScreen above

// ============ MAIN ============
const OVERLAY = new Set(['manage-users', 'add-user', 'user-created']);

export default function LoginScreen() {
  const { authStatus, checkAuth } = useAuthStore();
  useEffect(() => {
    // Don't re-check auth when showing as overlay (admin is still unlocked)
    if (!OVERLAY.has(authStatus)) checkAuth();
  }, [checkAuth, authStatus]);

  if (authStatus === 'checking') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f]">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  if (authStatus === 'setup-admin') return <AdminSetupScreen />;
  if (authStatus === 'add-user') return <AddUserScreen />;
  if (authStatus === 'user-created') return <UserCreatedScreen />;
  if (authStatus === 'manage-users') return <ManageUsersOverlay />;
  // admin-login, code-login, locked — all show PIN screen
  return <PinLoginScreen />;
}