# Her Care — Profile, Chat & AI Starter Kit

**Read this first:** this is a *standalone starter kit*, not a patch to your Her Care repository. I never had access to the real repo, so nothing here audits or fixes your existing code. It implements the Day 1/Day 2 features on an assumed stack so you can run it, review it, and port the parts you need. See `docs/INTEGRATION.md`.

Assumed stack: React 18 + Vite (JavaScript), Express 5, MongoDB/Mongoose, JWT auth, Socket.io, Groq (server-side).

## Run it
```bash
# terminal 1
cd server && cp .env.example .env     # set MONGODB_URI, JWT_SECRET, optionally GROQ_API_KEY
npm install && npm run dev
# terminal 2
cd client && npm install && npm run dev   # http://localhost:5173
```
Windows PowerShell: use `copy .env.example .env` instead of `cp`.

## What is in it
- **Profile** (`client/src/pages/Profile.jsx`, `server/src/routes/profile.js`): view/edit, client + server validation, save/cancel, loading/error states, avatar upload/remove (JPG/PNG/WebP, 2 MB), data re-read from the server on load. Edit endpoint has **no user id parameter**: you can only edit yourself, and only whitelisted fields. Email/phone are returned only to the owner; other users see public fields only.
- **Chat UI** (`client/src/pages/Chat.jsx`, `components/*`): conversation list (filter, unread badges, new chat), thread with day separators, avatars, timestamps, long text/emoji wrapping, skeletons, empty and error states, in-thread search, "load older".
- **Mobile**: layout height follows `visualViewport` (keyboard does not cover the composer), 16px inputs (no iOS zoom), 44px touch targets, single-pane navigation with Back, no horizontal overflow, auto-scroll only when the reader is at the bottom (otherwise a "New messages" button), scroll position kept when older messages load.
- **Reliability**: client-generated `clientId` + unique DB index = no duplicate messages on retry/double-click; states sending / sent / failed + Retry; socket + HTTP duplicates merged; refetch after reconnect; offline banner.
- **AI** (`server/src/utils/ai.js`): key stays on the server; one private AI conversation per user; the model only ever sees that conversation's messages; one in-flight request per conversation and one AI reply per user message; clear "not configured" / retry states.
- **Accessibility**: skip link, labelled controls, `role="log"` message list, live regions for status/errors, visible focus, reduced-motion support.

## Checks that were actually run
| Check | Result |
|---|---|
| `server`: `npm test` (validators, AI history builder) | 8/8 pass |
| `server`: `node --check` on all source files | pass |
| `client`: `npm test` (message dedupe/order helpers) | 4/4 pass |
| `client`: `npm run build` | pass |

Everything else is **unverified**; see `docs/TEST_CHECKLIST.md` and `docs/AUDIT_REPORT.md`.
