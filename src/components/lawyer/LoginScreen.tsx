'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Shield, Lock, Eye, EyeOff, AlertTriangle, UserPlus, ArrowLeft } from 'lucide-react';

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

// ============ CREATE USER ============
function CreateUserScreen() {
  const { createUserAndLogin, error, users } = useAuthStore();
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
            createUserAndLogin(name.trim(), pin).then(ok => { if (!ok) { triggerShake(); setSaving(false); } });
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
            className="self-start absolute top-4 left-4 w-9 h-9 rounded-xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center">
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
  const { login, error, authStatus, checkAuth } = useAuthStore();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [tick, setTick] = useState(0);
  const tickRef = useRef(0);

  const lockMsg = authStatus === 'locked' && error ? error : '';

  // Extract lock seconds from error
  const lockSeconds = (() => {
    if (authStatus !== 'locked' || !error) return 0;
    const m = error.match(/(\d+)s/);
    return m ? parseInt(m[1]) : 0;
  })();
  const countdown = lockSeconds > 0 ? Math.max(0, lockSeconds - tick) : 0;

  useEffect(() => {
    if (lockSeconds <= 0) { tickRef.current = 0; return; }
    tickRef.current = 0;
    const t = setInterval(() => {
      tickRef.current++;
      setTick(tickRef.current);
      if (tickRef.current >= lockSeconds) { clearInterval(t); checkAuth(); }
    }, 1000);
    return () => clearInterval(t);
  }, [lockSeconds, checkAuth]);

  const triggerShake = useCallback(() => { setShake(true); setTimeout(() => setShake(false), 500); }, []);

  const handleDigit = useCallback((d: string) => {
    const p = pin + d;
    if (p.length <= 4) {
      setPin(p);
      if (p.length === 4) {
        login(p).then(ok => { if (!ok) { triggerShake(); setTimeout(() => setPin(''), 500); } });
      }
    }
  }, [pin, login, triggerShake]);

  const handleDelete = useCallback(() => setPin(p => p.slice(0, -1)), []);
  const isLocked = countdown > 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-20 h-20 rounded-3xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-violet-400" />
        </div>

        <h1 className="text-xl font-bold text-white mb-0.5">PIN Daalo</h1>
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

        {error && !isLocked && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[300px] w-full">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        )}

        {isLocked && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 max-w-[300px] w-full">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400 text-center">{lockMsg || `Locked. ${countdown}s baad try karo`}</p>
          </div>
        )}
      </div>

      <div className="pb-8 pt-4 px-6">
        <Numpad onDigit={handleDigit} onDelete={handleDelete} disabled={isLocked} />
      </div>

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

  if (authStatus === 'create-user') return <CreateUserScreen />;
  return <PinLoginScreen />;
}