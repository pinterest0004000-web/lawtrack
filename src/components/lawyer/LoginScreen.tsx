'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { Shield, Lock, Eye, EyeOff, AlertTriangle } from 'lucide-react';

function PinDots({ length, filled, shake }: { length: number; filled: number; shake: boolean }) {
  return (
    <div className={`flex justify-center gap-4 mb-6 ${shake ? 'animate-pin-shake' : ''}`}>
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={`w-4 h-4 rounded-full transition-all duration-200 ${
            i < filled
              ? 'bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.5)] scale-110'
              : 'bg-zinc-700 border border-zinc-600'
          }`}
        />
      ))}
    </div>
  );
}

function Numpad({
  onDigit,
  onDelete,
  disabled,
}: {
  onDigit: (d: string) => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
      {keys.map((key, i) => {
        if (key === '') {
          return <div key={`empty-${i}`} />;
        }
        if (key === 'del') {
          return (
            <button
              key="del"
              onClick={onDelete}
              disabled={disabled}
              className="h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center active:bg-zinc-700/60 transition-colors disabled:opacity-40"
              aria-label="Delete"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-zinc-400">
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                <line x1="18" y1="9" x2="12" y2="15" />
                <line x1="12" y1="9" x2="18" y2="15" />
              </svg>
            </button>
          );
        }
        return (
          <button
            key={key}
            onClick={() => onDigit(key)}
            disabled={disabled}
            className="h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-xl font-semibold text-white active:bg-violet-600/20 active:border-violet-500/30 transition-colors disabled:opacity-40"
          >
            {key}
          </button>
        );
      })}
    </div>
  );
}

export default function LoginScreen() {
  const { authStatus, remainingAttempts, lockoutRemaining, error, createPin, login, checkAuth } = useAuthStore();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter-pin' | 'confirm-pin'>('enter-pin');
  const [shake, setShake] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [countdown, setCountdown] = useState(lockoutRemaining);
  const pinInputRef = useRef<HTMLInputElement>(null);

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Lockout countdown
  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          checkAuth();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining, checkAuth]);

  const triggerShake = useCallback(() => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  }, []);

  const handleDigit = useCallback((digit: string) => {
    if (authStatus === 'no-pin') {
      // Setup mode
      if (step === 'enter-pin') {
        const newPin = pin + digit;
        if (newPin.length <= 4) {
          setPin(newPin);
          if (newPin.length === 4) {
            setStep('confirm-pin');
            setConfirmPin('');
          }
        }
      } else {
        // Confirm step
        const newConfirm = confirmPin + digit;
        if (newConfirm.length <= 4) {
          setConfirmPin(newConfirm);
          if (newConfirm.length === 4) {
            if (newConfirm === pin) {
              createPin(pin);
            } else {
              triggerShake();
              setTimeout(() => {
                setStep('enter-pin');
                setPin('');
                setConfirmPin('');
                useAuthStore.setState({ error: 'PINs did not match. Try again.' });
              }, 500);
            }
          }
        }
      }
    } else {
      // Login mode
      const newPin = pin + digit;
      if (newPin.length <= 4) {
        setPin(newPin);
        if (newPin.length === 4) {
          login(newPin).then(success => {
            if (!success) {
              triggerShake();
              setTimeout(() => setPin(''), 500);
            }
          });
        }
      }
    }
  }, [authStatus, step, pin, confirmPin, createPin, login, triggerShake]);

  const handleDelete = useCallback(() => {
    if (step === 'confirm-pin') {
      setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
  }, [step]);

  const isLockedOut = countdown > 0;
  const currentPinLength = step === 'confirm-pin' ? confirmPin.length : pin.length;

  // If checking, show loading
  if (authStatus === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0f] px-6">
        <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      {/* Hidden input for keyboard accessibility */}
      <input
        ref={pinInputRef}
        type={showPin ? 'text' : 'password'}
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        className="sr-only"
        aria-label="PIN input"
        value={step === 'confirm-pin' ? confirmPin : pin}
        onChange={(e) => {
          const val = e.target.value.replace(/\D/g, '');
          if (val.length === 1) handleDigit(val);
        }}
      />

      {/* Top Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        {/* Icon */}
        <div className="w-20 h-20 rounded-3xl bg-violet-600/15 border border-violet-500/20 flex items-center justify-center mb-6">
          {authStatus === 'no-pin' ? (
            <Shield className="w-10 h-10 text-violet-400" />
          ) : (
            <Lock className="w-10 h-10 text-violet-400" />
          )}
        </div>

        {/* Title */}
        {authStatus === 'no-pin' ? (
          <>
            <h1 className="text-xl font-bold text-white mb-1">Create Your PIN</h1>
            <p className="text-sm text-zinc-400 mb-1">Set a 4-digit PIN to secure your data</p>
            {step === 'confirm-pin' && (
              <p className="text-sm text-amber-400/80 font-medium mb-0">Confirm your PIN</p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-1">Enter PIN</h1>
            <p className="text-sm text-zinc-400">Unlock to access LawTrack</p>
          </>
        )}

        {/* Show/Hide toggle */}
        <button
          onClick={() => setShowPin(prev => !prev)}
          className="flex items-center gap-1.5 text-xs text-zinc-500 mt-3 mb-4 active:text-zinc-400 transition-colors"
        >
          {showPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showPin ? 'Hide' : 'Show'} PIN
        </button>

        {/* PIN Dots or Numbers */}
        {showPin ? (
          <div className={`flex justify-center gap-4 mb-6 font-mono text-2xl tracking-[0.5em] text-white ${shake ? 'animate-pin-shake' : ''}`}>
            {step === 'confirm-pin' ? confirmPin.padEnd(4, '·') : pin.padEnd(4, '·')}
          </div>
        ) : (
          <PinDots length={4} filled={currentPinLength} shake={shake} />
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 max-w-[300px] w-full">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-xs text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* Lockout Message */}
        {isLockedOut && countdown > 0 && (
          <div className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 max-w-[300px] w-full">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400 text-center">
              Locked. Try again in <span className="font-bold">{countdown}s</span>
            </p>
          </div>
        )}
      </div>

      {/* Numpad */}
      <div className="pb-8 pt-4 px-6">
        <Numpad onDigit={handleDigit} onDelete={handleDelete} disabled={isLockedOut} />
      </div>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-white/5 px-4 py-2 mt-auto">
        <p className="text-[10px] text-zinc-700 text-center">LawTrack • Secured with AES-256 Encryption</p>
      </footer>
    </div>
  );
}