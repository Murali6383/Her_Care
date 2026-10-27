# Manual test checklist (none of these were run by me)

## Setup
- [ ] Server starts with MongoDB; `GET /api/health` returns ok
- [ ] Two accounts registered (A and B) in two different browsers

## Profile
- [ ] Edit name/bio/location/phone, Save, refresh: values persist
- [ ] Invalid input (1-char name, 301-char bio, "abc" phone) shows errors, nothing saved
- [ ] Cancel restores old values; leaving with unsaved edits warns
- [ ] Upload JPG/PNG/WebP < 2 MB works; .gif, .pdf and > 2 MB are rejected with a message; Remove photo works
- [ ] `PUT /api/profile` with `{"email":"x","role":"admin"}` changes nothing but allowed fields
- [ ] Without a token, `/api/profile` returns 401; user B cannot see A's email/phone via `/api/users/:id`

## Chat
- [ ] A starts a chat with B; both see messages instantly; order is correct
- [ ] Double-click Send / retry a failed message: exactly one message stored
- [ ] Stop the server mid-send: bubble shows "Not sent", Retry works after restart
- [ ] Kill network, reconnect: banner appears then clears; missed messages appear
- [ ] A conversation id belonging to others returns 404 ("not found" screen)
- [ ] Search finds messages; "Load older messages" keeps scroll position
- [ ] Very long unbroken text, emoji, Tamil text render without horizontal scroll
- [ ] Scrolled up while a message arrives: no jump, "New messages" button shown

## Mobile (real devices, iOS Safari + Android Chrome)
- [ ] Keyboard open: composer stays visible, header not pushed off-screen
- [ ] No horizontal scrolling on any page; Back button and list/thread switching work
- [ ] Rotate device; tablet widths (768-1024) show two panes

## AI
- [ ] Without key: clear "not configured" message, no retry button
- [ ] With key: reply appears, typing indicator shows, Send disabled while waiting
- [ ] Break the key: error + "Retry answer" works after fixing
- [ ] User A's AI context never includes B's messages (check server logs/DB)

## Accessibility
- [ ] Full keyboard use; focus always visible; screen reader announces new messages and errors
