# PR: Profile page, chat redesign, mobile fixes and AI integration

## Summary
Adds a complete profile page (edit, validation, avatar, authorization), a redesigned responsive chat, mobile keyboard/scroll fixes, idempotent message sending with sending/sent/failed/retry states, and a server-side AI assistant with per-user isolation.

## Test results (fill in after running)
- server `npm test`: 8/8 passing (verified in starter kit)
- client `npm test`: 4/4 passing; `npm run build`: passing
- Manual checklist (`docs/TEST_CHECKLIST.md`): ____
- Screenshots: ____ (desktop profile, desktop chat, mobile chat, mobile keyboard open)

## Blockers / needs credentials
- `GROQ_API_KEY` required for live AI replies
- MongoDB required for integration testing

## Remaining work
See `docs/AUDIT_REPORT.md` (known limitations).
