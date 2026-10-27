# Porting into the real Her Care repo

Do this before copying anything. The task brief says to inspect first and not to rewrite working features.
1. Read the real README, `package.json` files, router, auth middleware, existing profile/chat/AI code and models.
2. Compare to this kit's assumptions: JS vs TS, REST vs Firebase, Mongo vs SQL, cookie vs bearer token, Socket.io vs other.
3. Keep the real API contracts. Port only: the validation rules, the `clientId` idempotency pattern (add a unique index on conversation + clientId), `lib/messages.js`, the `MessageList` scroll logic, the `visualViewport` hook, and the CSS patterns.
4. Replace this kit's models/routes with calls to the existing ones; never replace real data with mock data.
5. Put brand tokens into `:root` in `styles.css` (or your existing theme).
6. Work on a dedicated branch (e.g. `feature/profile-chat-ai`), commit in small steps, then open the PR using `docs/PR_DESCRIPTION.md`.
