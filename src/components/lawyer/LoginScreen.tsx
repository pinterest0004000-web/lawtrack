'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { regenerateAccessCode } from '@/lib/auth';
import { Shield, Lock, Eye, EyeOff, AlertTriangle, UserPlus, ArrowLeft, Copy, RefreshCw, Trash2, Key, Users, ChevronRight } from 'lucide-react';

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

// ============ USER SELECT SCREEN ============
function UserSelectScreen() {
  const { users, selectUserAndLogin, goToCreateUser, logout: removeUser } = useAuthStore();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCodes, setShowCodes] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleDelete = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    if (users.length <= 1) return;
    setDeleting(userId);
    const { deleteUser } = await import('@/lib/auth');
    await deleteUser(userId);
    const remaining = await import('@/lib/auth').then(m => m.getUsers());
    useAuthStore.setState({ users: remaining });
    if (remaining.length <= 1) {
      useAuthStore.setState({ authStatus: 'login', selectedUser: remaining[0] || null });
    }
    setDeleting(null);
  };

  const handleCopy = async (e: React.MouseEvent, userId: string, code: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?code=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(userId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      setCopiedId(userId);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  const handleRegenerate = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    const newCode = await regenerateAccessCode(userId);
    if (newCode) {
      const updated = await import('@/lib/auth').then(m => m.getUsers());
      useAuthStore.setState({ users: updated });
    }
  };

  const toggleCode = (userId: string) => {
    setShowCodes(prev => ({ ...prev, [userId]: !prev[userId] }));
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-6">
          <Users className="w-10 h-10 text-violet-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Apna Account Chuno</h1>
        <p className="text-sm text-zinc-400 mb-6">Jo user select karo uska PIN daalo</p>

        <div className="w-full max-w-[320px] space-y-2.5">
          {users.map(user => (
            <div key={user.id} className="relative">
              <button
                onClick={() => selectUserAndLogin(user.id)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 active:bg-zinc-700/40 transition-colors text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-violet-600/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-bold text-violet-300">
                    {user.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-zinc-500">Tap karke PIN daalo</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
              </button>

              {/* Access code reveal row */}
              <div className="flex items-center gap-1 mt-1.5 ml-14">
                <button
                  onClick={() => toggleCode(user.id)}
                  className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  <Key className="w-2.5 h-2.5" />
                  {showCodes[user.id] ? 'Chhupo' : 'Access Code'}
                </button>

                {showCodes[user.id] && (
                  <>
                    <span className="text-[11px] font-mono font-bold text-emerald-400 tracking-wider ml-1">
                      {user.accessCode}
                    </span>
                    <button onClick={(e) => handleCopy(e, user.id, user.accessCode)}
                      className="p-0.5 rounded text-zinc-500 hover:text-violet-400 transition-colors" title="Copy link">
                      <Copy className="w-2.5 h-2.5" />
                    </button>
                    <button onClick={(e) => handleRegenerate(e, user.id)}
                      className="p-0.5 rounded text-zinc-500 hover:text-amber-400 transition-colors" title="New code generate karo">
                      <RefreshCw className="w-2.5 h-2.5" />
                    </button>
                    {copiedId === user.id && (
                      <span className="text-[9px] text-emerald-400">Copied!</span>
                    )}
                  </>
                )}
              </div>

              {/* Delete button */}
              {users.length > 1 && (
                <button
                  onClick={(e) => handleDelete(e, user.id)}
                  disabled={deleting === user.id}
                  className="absolute top-3.5 right-3.5 p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                  title="User delete karo"
                >
                  {deleting === user.id ? (
                    <div className="w-3.5 h-3.5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={goToCreateUser}
          className="mt-5 flex items-center gap-2 px-5 py-3 rounded-2xl bg-violet-600/15 border border-violet-500/20 text-sm font-semibold text-violet-300 active:bg-violet-600/25 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Naya User Banao
        </button>
      </div>

      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}

// ============ SHOW ACCESS CODE ============
function ShowCodeScreen() {
  const { selectedUser, currentUserName } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const code = selectedUser?.accessCode || '';
  const name = currentUserName || selectedUser?.name || '';

  const handleCopy = async () => {
    const url = `${window.location.origin}${window.location.pathname}?code=${code}`;
    try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!code) return null;
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-emerald-600/15 border border-emerald-500/20 flex items-center justify-center mb-6">
          <Shield className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-xl font-bold text-white mb-1">Account Ban Gaya! ✅</h1>
        <p className="text-sm text-zinc-400 mb-6">{name}, tera account ready hai</p>

        <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-2xl p-4 max-w-[300px] w-full mb-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Tera Access Code</p>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-mono font-bold text-emerald-400 tracking-[0.3em]">{code}</span>
            <button onClick={handleCopy} className="p-2 rounded-xl bg-zinc-700/50 text-zinc-400 hover:text-white transition-colors">
              {copied ? <span className="text-[11px] text-emerald-400">Copied!</span> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 leading-relaxed">
            Ye code is user ko do — ye link open karke directly PIN screen aayega
          </p>
        </div>

        <button onClick={() => useAuthStore.setState({ authStatus: 'unlocked' })}
          className="w-full max-w-[300px] py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm active:bg-violet-700 transition-colors">
          Shuru Karo
        </button>
      </div>
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}

// ============ CREATE USER ============
function CreateUserScreen() {
  const { createUserAndLogin, error, users, goToSelectUser } = useAuthStore();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'name' | 'pin' | 'confirm'>('name');
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const triggerShake = useCallback(() => { setShake(true); setTimeout(() => setShake(false), 500); }, []);

  const submitName = useCallback(() => {
    if (name.trim().length < 2) return;
    if (users.some(u => u.name.toLowerCase() === name.trim().toLowerCase())) {
      useAuthStore.setState({ error: 'Ye naam pehle se hai. Dusra naam daalo.' });
      return;
    }
    useAuthStore.setState({ error: '' });
    setStep('pin');
  }, [name, users]);

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
            createUserAndLogin(name.trim(), pin).then(res => {
              if (!res.ok) { triggerShake(); setSaving(false); }
              // Store handles show-code status automatically
            });
          } else {
            triggerShake();
            setTimeout(() => { setStep('pin'); setPin(''); setConfirmPin(''); useAuthStore.setState({ error: 'PIN match nahi hua. Dobara daalo.' }); }, 500);
          }
        }
      }
    }
  }, [step, pin, confirmPin, name, createUserAndLogin, triggerShake]);

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

        <div className="w-20 h-20 rounded-3xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-6">
          <UserPlus className="w-10 h-10 text-violet-400" />
        </div>

        {step === 'name' ? (
          <>
            <h1 className="text-xl font-bold text-white mb-1">Apna Naam Daalo</h1>
            <p className="text-sm text-zinc-400 mb-6">Naya user banane ke liye naam aur PIN chahiye</p>
            <div className="max-w-[300px] w-full">
              <input type="text" value={name} onChange={e => { setName(e.target.value); useAuthStore.setState({ error: '' }); }}
                onKeyDown={e => e.key === 'Enter' && submitName()} placeholder="Naam likho"
                className="w-full px-4 py-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-white text-base placeholder-zinc-500 outline-none focus:border-violet-500/40 transition-colors mb-3"
                maxLength={20} autoFocus />
              {users.length > 0 && (
                <button onClick={goToSelectUser}
                  className="w-full py-2.5 rounded-xl text-sm text-zinc-400 hover:text-white transition-colors mb-2">
                  ← Wapas Jaao
                </button>
              )}
              <button onClick={submitName} disabled={name.trim().length < 2}
                className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-40 active:bg-violet-700 transition-colors">
                Aage Badho
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-0.5">{step === 'pin' ? `${name.trim()}, Apna PIN Set Karo` : 'PIN Confirm Karo'}</h1>
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

// ============ PIN LOGIN ============
function PinLoginScreen() {
  const { loginWithPin, error, authStatus, selectedUser, goToSelectUser, goToCreateUser, checkAuth, lockoutRemaining } = useAuthStore();
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

  // Show wrong lock message with remaining time
  const lockMsg = isLockedOut && error ? error : '';

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {selectedUser && (
          <button onClick={goToSelectUser}
            className="absolute top-4 left-4 w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center z-10">
            <ArrowLeft className="w-4 h-4 text-zinc-400" />
          </button>
        )}

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
        <p className="text-sm text-zinc-400 mb-3">Apna 4-digit PIN enter karo</p>

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
              {lockMsg || `Locked. ${Math.max(0, lockoutRemaining - tick)}s baad try karo`}
            </p>
          </div>
        )}
      </div>

      <div className="pb-4 pt-4 px-6">
        <Numpad onDigit={handleDigit} onDelete={handleDelete} disabled={isLockedOut} />
      </div>

      {selectedUser && (
        <div className="px-6 pb-2">
          <button onClick={() => {
            if (typeof window !== 'undefined' && window.location.search.includes('code=')) {
              window.history.replaceState({}, '', window.location.pathname);
            }
            goToSelectUser();
          }} className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            ← Sab Users Dekho
          </button>
        </div>
      )}
      {!selectedUser && (
        <div className="px-6 pb-2">
          <button onClick={goToCreateUser} className="w-full py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            Naya User Banao
          </button>
        </div>
      )}

      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}

// ============ MAIN ============
export default function LoginScreen() {
  const { authStatus, checkAuth } = useAuthStore();
  useEffect(() => { checkAuth(); }, [checkAuth]);

  if (authStatus === 'checking') return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f]">
      <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  if (authStatus === 'show-code') return <ShowCodeScreen />;
  if (authStatus === 'create-user') return <CreateUserScreen />;
  if (authStatus === 'select-user') return <UserSelectScreen />;
  // login, code-login, locked — all show PIN screen
  return <PinLoginScreen />;
}