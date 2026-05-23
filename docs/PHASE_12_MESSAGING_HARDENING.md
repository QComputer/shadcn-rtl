# Phase 12 — Messaging and Conversation Hardening

Phase 12 hardens the conversation and message APIs so the messaging surface follows the same server-side security and production-readiness standards as the dashboard, order, media, and appointment phases.

## Scope

- `/api/conversations`
- `/api/conversations/[id]`
- `/api/conversations/[id]/messages`
- `lib/services/messaging.service.ts`
- deployed no-Playwright smoke coverage

## Changes

### API authorization

Conversation routes now use `requireAuthSession()` from `lib/api-guards.ts` instead of raw `auth()` calls. This keeps session typing consistent and prevents the recurring NextAuth overloaded middleware type problem.

### Validation and limits

- Conversation pagination now normalizes `page` and `pageSize` to positive integers.
- Conversation `pageSize` is capped at 50.
- Conversation creation requires at least one other participant.
- Conversation creation caps participants at 20.
- Participant IDs must be non-empty strings.
- Participants must be active, non-deleted users.
- Message content is trimmed.
- Empty messages are rejected.
- Message length is capped at 5,000 characters.

### Rate limiting

In-memory per-user/IP limits were added for:

- creating conversations
- sending messages

These are protective defaults for the current single-instance deployment. For multi-instance deployment, replace this with Redis or another shared rate-limit store.

### Conversation correctness

Direct conversation reuse now verifies that the conversation contains exactly the same two users before returning it. The previous implementation could return a conversation too loosely while iterating participant records.

### Consistent errors

The routes now use `jsonError()` and `ApiError` so user/business errors return appropriate HTTP statuses instead of defaulting to `500`.

## Deployed smoke test

Run after deployment:

```powershell
$env:DEPLOYED_URL="https://zc0.runflare.run"; npm run e2e:deployed:phase12
```

The test verifies:

- homepage is reachable
- unauthenticated conversation list is blocked
- unauthenticated conversation create is blocked
- unauthenticated conversation detail is blocked
- unauthenticated message send is blocked
- health endpoint remains reachable

## Notes

Messaging is now safer for production, but future phases can still improve it further by adding:

- organization-scoped messaging policies
- order-scoped conversation creation rules
- read receipt endpoints
- notification fan-out for new messages
- WebSocket/SSE live updates
- Redis-backed rate limiting
