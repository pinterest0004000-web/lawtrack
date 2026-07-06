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