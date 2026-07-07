---
Task ID: 1
Agent: Main
Task: Add security - PIN authentication, AES-256-GCM data encryption, auto-lock, brute-force protection

Work Log:
- Created `/src/lib/auth.ts` with PIN hashing (PBKDF2/SHA-256), AES-256-GCM encryption via Web Crypto API, brute-force protection (5 attempts, 60s lockout)
- Created `/src/store/auth-store.ts` with Zustand auth state management (checking/no-pin/locked/unlocked)
- Created `/src/components/lawyer/LoginScreen.tsx` with dark-themed 4-digit PIN entry numpad, setup mode (enter + confirm), login mode, shake animation on wrong PIN, lockout countdown
- Rewrote `/src/lib/storage.ts` - all cases and expenses are now encrypted with AES-256-GCM before storing in IndexedDB. Each record stored as `{ caseId/id, _d: encrypted_string }`. Legacy unencrypted data is handled gracefully on read.
- Updated `/src/app/page.tsx` - added auth gate (shows LoginScreen when locked), auto-lock after 5 minutes of inactivity, Lock button in header, one-time re-encryption of legacy data after login
- Fixed pre-existing lint errors in CaseDetail.tsx (ref-during-render)
- Added pin shake animation CSS to globals.css
- Verified full flow: PIN setup → confirm → unlock → home screen → lock → re-enter PIN → wrong PIN error

Stage Summary:
- Security system fully implemented: 4-digit PIN auth, AES-256-GCM encryption for all IndexedDB data, auto-lock after 5 min inactivity, brute-force lockout after 5 failed attempts (60s cooldown)
- Encryption key is only held in memory (never persisted) - cleared on lock/logout
- Legacy unencrypted data is auto-migrated (re-encrypted) after first successful login
- All lint checks pass, browser verification successful
---
Task ID: 1
Agent: Main Agent
Task: Replace broken @firebase/crashlytics with Sentry for error reporting

Work Log:
- User provided Sentry DSN: https://0dcfdc1193d2305fe838dae0892e0414@o4511690752262144.ingest.us.sentry.io/4511690809344000
- Created `/src/lib/sentry.ts` — Sentry init with DSN, `initSentry()` and `captureError()` exports
- Updated `/src/lib/firebase.ts` — `reportError()` now uses dynamic import of `captureError` from sentry.ts (replaces broken Crashlytics)
- Created `/src/components/SentryInit.tsx` — client component that calls `initSentry()` on mount
- Updated `/src/app/layout.tsx` — added `<SentryInit />` component
- Verified: lint clean, dev log all 200s, zero console errors, `window.__SENTRY__` confirmed in browser
- `@firebase/crashlytics` already removed from package.json and no remaining imports

Stage Summary:
- Sentry fully integrated replacing broken Crashlytics
- DSN configured, error reporting active
- Local fallback (last 50 errors in localStorage) still works
- App runs clean with zero errors

---
Task ID: 2
Agent: Main
Task: Final quality audit and bug fixes

Work Log:
- Ran comprehensive code review (20 files reviewed)
- Fixed CRITICAL: Wrong Toaster component — layout.tsx imported shadcn `toaster` instead of sonner `Toaster`, making ALL toasts invisible
- Fixed: Moved `pauseCloudForUndo` from page.tsx (architectural anti-pattern) to cloud-backup.ts utility
- Fixed: Delete case now also removes associated expenses from Zustand store (prevented orphaned expenses)
- Fixed: Removed duplicate `initSentry()` call with PLACEHOLDER DSN in page.tsx
- Fixed: Removed invalid `enablePerformanceMonitoring` Sentry option
- Fixed: Cleaned unused imports — `Undo2` (DeleteCaseScreen), `resetKey`/`innerKey` (CaseDetail), `getAnalytics`/`isSupported`/`initAnalytics` (firebase.ts)
- Fixed: Removed Prisma `log: ['query']` that was logging all sensitive data to console
- Fixed: Incorrect comment "20s" → "10s" in autoBackup

Stage Summary:
- 10 issues fixed (1 critical, 4 high, 5 medium/low)
- Zero lint errors, zero console errors, zero dev log errors
- App verified in browser: renders correctly, 4-digit PIN, sonner toasts active
- Architecture improved: no more cross-page imports for utility functions
