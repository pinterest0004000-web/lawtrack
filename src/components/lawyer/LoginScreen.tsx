'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Shield, Lock, Eye, EyeOff, AlertTriangle, UserPlus, Users, ChevronRight, Trash2, ArrowLeft } from 'lucide-react';

function PinDots({ length, filled, shake }: { length: number; filled: number; shake: boolean }) {
  return (
    <div className={`flex justify-center gap-4 mb-6 ${shake ? 'animate-pin-shake' : ''}`}>
      {Array.from({ length }).map((_, i) => (
        <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
          i < filled ? 'bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.5)] scale-110' : 'bg-zinc-700 border border-zinc-600'
        }`} />
      ))}
    </div>
  );
}

function Numpad({ onDigit, onDelete, disabled }: { onDigit: (d: string) => void; onDelete: () => void; disabled: boolean }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
      {keys.map((key, i) => {
        if (key === '') return <div key={`empty-${i}`} />;
        if (key === 'del') return (
          <button key="del" onClick={onDelete} disabled={disabled}
            className="h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center active:bg-zinc-700/60 transition-colors disabled:opacity-40" aria-label="Delete">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
              <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
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
  const { users, selectUser, goToCreateUser, removeUser } = useAuthStore();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col px-4 pt-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Select User</h1>
          <p className="text-sm text-zinc-400">Choose your profile to continue</p>
        </div>

        <div className="flex flex-col gap-2 mb-4 max-w-[360px] w-full mx-auto">
          {users.map(user => (
            <div key={user.id} className="flex items-center gap-3">
              <button onClick={() => selectUser(user.id)}
                className="feature-box flex-1 glass-card rounded-xl p-3.5 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-bold text-violet-300">{user.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-zinc-500">Tap to unlock</p>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
              </button>
              {confirmDelete === user.id ? (
                <button onClick={async () => { await removeUser(user.id); setConfirmDelete(null); }}
                  className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              ) : (
                <button onClick={() => setConfirmDelete(user.id)} onDoubleClick={() => setConfirmDelete(null)}
                  className="w-10 h-10 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center flex-shrink-0 opacity-40">
                  <Trash2 className="w-4 h-4 text-zinc-500" />
                </button>
              )}
            </div>
          ))}
        </div>

        <button onClick={goToCreateUser}
          className="feature-box max-w-[360px] w-full mx-auto glass-card rounded-xl p-3.5 flex items-center justify-center gap-2 border border-violet-500/20">
          <UserPlus className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-medium text-violet-300">Add New User</span>
        </button>
      </div>

      <div className="pb-8 pt-4" />
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}

// ============ ADD USER SCREEN ============
function AddUserScreen() {
  const { createUserAndLogin, goToSelectUser, error, users } = useAuthStore();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'name' | 'enter-pin' | 'confirm-pin'>('name');
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleNameSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (trimmed.length < 2) return;
    if (users.some(u => u.name.toLowerCase() === trimmed.toLowerCase())) {
      useAuthStore.setState({ error: 'This name already exists.' });
      return;
    }
    useAuthStore.setState({ error: '' });
    setStep('enter-pin');
  }, [name, users]);

  const handleDigit = useCallback((digit: string) => {
    if (step === 'enter-pin') {
      const newPin = pin + digit;
      if (newPin.length <= 4) {
        setPin(newPin);
        if (newPin.length === 4) { setStep('confirm-pin'); setConfirmPin(''); }
      }
    } else if (step === 'confirm-pin') {
      const newConfirm = confirmPin + digit;
      if (newConfirm.length <= 4) {
        setConfirmPin(newConfirm);
        if (newConfirm.length === 4) {
          if (newConfirm === pin) {
            setSaving(true);
            createUserAndLogin(name.trim(), pin).then(ok => {
              if (!ok) { triggerShake(); setSaving(false); }
            });
          } else {
            triggerShake();
            setTimeout(() => { setStep('enter-pin'); setPin(''); setConfirmPin(''); useAuthStore.setState({ error: 'PINs did not match. Try again.' }); }, 500);
          }
        }
      }
    }
  }, [step, pin, confirmPin, name, createUserAndLogin, triggerShake]);

  const handleDelete = useCallback(() => {
    if (step === 'confirm-pin') setConfirmPin(prev => prev.slice(0, -1));
    else if (step === 'enter-pin') setPin(prev => prev.slice(0, -1));
  }, [step]);

  const currentPinLength = step === 'confirm-pin' ? confirmPin.length : pin.length;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col px-4 pt-6">
        {/* Back button */}
        <button onClick={() => { if (step === 'name') goToSelectUser(); else { setStep(step === 'confirm-pin' ? 'enter-pin' : 'name'); useAuthStore.setState({ error: '' }); } }}
          className="self-start mb-4 w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>

        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-4">
            <UserPlus className="w-8 h-8 text-violet-400" />
          </div>
          <h1 className="text-xl font-bold text-white mb-1">
            {step === 'name' ? 'New User' : step === 'enter-pin' ? `Welcome, ${name.trim()}` : 'Confirm PIN'}
          </h1>
          <p className="text-sm text-zinc-400 text-center">
            {step === 'name' ? 'Enter your name to get started' : step === 'enter-pin' ? 'Set a 4-digit PIN' : 'Re-enter your PIN to confirm'}
          </p>
        </div>

        {step === 'name' ? (
          <div className="max-w-[300px] w-full mx-auto">
            <input type="text" value={name} onChange={e => { setName(e.target.value); useAuthStore.setState({ error: '' }); }}
              onKeyDown={e => e.key === 'Enter' && handleNameSubmit()} placeholder="Your name"
              className="w-full px-4 py-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50 text-white text-base placeholder-zinc-500 outline-none focus:border-violet-500/40 transition-colors mb-4"
              maxLength={20} autoFocus />
            <button onClick={handleNameSubmit} disabled={name.trim().length < 2 || saving}
              className="w-full py-3.5 rounded-xl bg-violet-600 text-white font-semibold text-sm disabled:opacity-40 active:bg-violet-700 transition-colors">
              Continue
            </button>
          </div>
        ) : (
          <>
            <button onClick={() => setShowPin(p => !p)} className="flex items-center gap-1.5 text-xs text-zinc-500 mt-3 mb-4">
              {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPin ? 'Hide' : 'Show'} PIN
            </button>
            {showPin ? (
              <div className={`flex justify-center gap-4 mb-6 font-mono text-2xl tracking-[0.5em] text-white ${shake ? 'animate-pin-shake' : ''}`}>
                {(step === 'confirm-pin' ? confirmPin : pin).padEnd(4, '·')}
              </div>
            ) : (
              <PinDots length={4} filled={currentPinLength} shake={shake} />
            )}
            {error && (
              <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[300px] w-full mx-auto">
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

// ============ PIN LOGIN SCREEN ============
function PinLoginScreen() {
  const { login, error, remainingAttempts, lockoutRemaining, currentUserId, users, goToSelectUser } = useAuthStore();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [countdown, setCountdown] = useState(lockoutRemaining);
  const userName = users.find(u => u.id === currentUserId)?.name || '';

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => { if (prev <= 1) { clearInterval(timer); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const triggerShake = useCallback(() => { setShake(true); setTimeout(() => setShake(false), 500); }, []);

  const handleDigit = useCallback((digit: string) => {
    const newPin = pin + digit;
    if (newPin.length <= 4) {
      setPin(newPin);
      if (newPin.length === 4) {
        login(newPin).then(ok => { if (!ok) { triggerShake(); setTimeout(() => setPin(''), 500); } });
      }
    }
  }, [pin, login, triggerShake]);

  const handleDelete = useCallback(() => setPin(p => p.slice(0, -1)), []);
  const isLockedOut = countdown > 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <button onClick={goToSelectUser}
          className="self-start absolute top-4 left-4 w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-zinc-400" />
        </button>

        <div className="w-20 h-20 rounded-3xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-violet-600/30 flex items-center justify-center">
            <span className="text-lg font-bold text-violet-300">{userName.charAt(0).toUpperCase()}</span>
          </div>
        </div>

        <h1 className="text-xl font-bold text-white mb-0.5">Welcome, {userName}</h1>
        <p className="text-sm text-zinc-400 mb-3">Enter your PIN to unlock</p>

        <button onClick={() => setShowPin(p => !p)} className="flex items-center gap-1.5 text-xs text-zinc-500 mb-4">
          {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showPin ? 'Hide' : 'Show'} PIN
        </button>

        {showPin ? (
          <div className={`flex justify-center gap-4 mb-6 font-mono text-2xl tracking-[0.5em] text-white ${shake ? 'animate-pin-shake' : ''}`}>
            {pin.padEnd(4, '·')}
          </div>
        ) : (
          <PinDots length={4} filled={pin.length} shake={shake} />
        )}

        {error && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[300px] w-full">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        )}

        {isLockedOut && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 max-w-[300px] w-full">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400 text-center">Locked. Try again in <span className="font-bold">{countdown}s</span></p>
          </div>
        )}
      </div>

      <div className="pb-8 pt-4 px-6">
        <Numpad onDigit={handleDigit} onDelete={handleDelete} disabled={isLockedOut} />
      </div>

      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}

// ============ MAIN LOGIN SCREEN (ROUTER) ============
export default function LoginScreen() {
  const { authStatus, checkAuth, goToCreateUser } = useAuthStore();

  useEffect(() => { checkAuth(); }, [checkAuth]);

  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] px-6">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (authStatus === 'no-users') {
    return <AddUserScreen />;
  }

  if (authStatus === 'add-user') {
    return <AddUserScreen />;
  }

  if (authStatus === 'select-user') {
    return <UserSelectScreen />;
  }

  // login or locked
  return <PinLoginScreen />;
}