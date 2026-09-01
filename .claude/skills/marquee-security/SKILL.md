---
name: marquee-security
description: Security review checklist for Marquee. Use before merging anything that touches authorization, plan entitlements, Firestore or Storage rules, session handling, join codes, RSVPs, uploads, rate limits, the audit log, or the CSP — and whenever adding an API route or a new collection.
---

# Security review

Marquee holds two things people care about: photos of their friends, and a guest list with
notes their guests wrote for the host alone. The threat model is not a nation state; it is
someone who found a code, someone guessing codes, another guest reading a note that was not
for them, and someone who was removed from an event and wants back in.

Work the sections that your change touches. Each item names what it actually prevents.

## The invariants

Break any of these and the review fails, whatever else is true:

1. **No client writes to Firestore.** Every mutation goes through a Route Handler.
2. **`can()` is the only place a permission is decided.** No ad-hoc `role === 'host'`.
3. **`admin:*` is unreachable from an event role.** A host is ordinary outside their event.
4. **The join code plaintext never leaves `private/joinCode` except via the audited API.**
5. **Uploads are re-validated against the object that landed**, not the client's claim.
6. **Media URLs are minted per request and expire.** No URL is ever stored in a document.
7. **Every privileged action writes an audit entry** — including the failures.
8. **RSVP notes never leave `rsvpNotes/`.** Answers and headcounts are public to the guest
   list; the note and the custom answer are for the host only, and the split is structural
   because Firestore rules cannot restrict a field.
9. **Entitlements are not permissions.** `can()` answers who you are, `entitlementsFor()`
   answers what was paid for. Neither may stand in for the other.
10. **A permission that is enforced must be reachable, or explicitly parked.** Five `admin:*`
    permissions were declared, checked by `can()`, and had no route — `admin:suspendUser`
    among them, so every write in the product was gated on a field nothing could set. Each
    layer looked complete alone. `tests/unit/admin-console.test.ts` now fails on any
    `admin:*` that is neither wired to a console section nor named as deliberately unreachable.

## If you added an API route

- [ ] Wrapped in `route()` — otherwise an unmapped exception leaks a stack trace
- [ ] Body parsed by a Zod schema; bounds come from `src/config`, not literals
- [ ] `requireIdentifiedActor()`, not `requireActor()`, if anonymous callers must not reach it
- [ ] Authorization via `can()` / `assertCan()`, with `eventAuthzContext()` for event scope
- [ ] Rate-limited — per IP if it works pre-session, per user otherwise
- [ ] Audit entry for anything privileged
- [ ] Not-found vs forbidden chosen deliberately: **404 when the existence of the resource is
      itself information.** `/api/events/[id]` returns 404 to non-members for this reason
- [ ] Error messages reveal nothing about _why_ — compare the join endpoint, where every
      failure mode returns one message so it cannot be used as an oracle

## If you touched authorization

- [ ] New permission added to `PERMISSIONS`, and to `platformOnlyPermissions` if `admin:*`
- [ ] Tests assert the **refusals**, not just the grants
- [ ] Anonymous path considered — does `ANONYMOUS_PERMISSIONS` need to change? (Almost always
      no; prefer a call-site flag like `anonymousPostingAllowed`)
- [ ] Suspended-account path considered — writes must stay refused at every role. Note that
      **`requireActor()` refuses a suspended caller before `can()` is consulted**, so the API
      is a full lockout including reads; `can()`'s read carve-out is defence in depth, not the
      observable behaviour. Do not "fix" one to match the other without deciding which is right
- [ ] UI and API both read the same `can()` result, so a button cannot promise what the API
      refuses
- [ ] If it is an `admin:*`, it is reachable from the console or listed in that test's parked
      set with a reason

## If you touched the operator console

`/admin` is the one surface that reads other people's data by design, so the questions are
different from everywhere else.

- [ ] The route re-checks the permission itself. A page gate is not authorization: every
      screen renders for anybody and the API is what refuses
- [ ] Rate-limited despite being staff-only. An operator account is the most valuable one to
      steal, and a stolen session must not enumerate the user table at machine speed
- [ ] Nothing new is rendered that the job does not need. IP and user agent are stored on every
      audit entry and deliberately not shown — those are for an investigation somebody decided
      to run, not for idle scrolling
- [ ] A write here cannot disable the console. Suspension refuses the caller themselves and
      anyone at or above their own platform rank; without both, one misclick or two operators
      can lock everybody out of the screen that lifts it
- [ ] Reading the audit log still writes `admin.auditViewed`. It is the only read in the
      product that audits itself, and that is deliberate
- [ ] **Reads over a collection tolerate a document that is not there.** Firestore lists
      phantom parents — a deleted event whose `funnel` subcollection survives — and `.data()`
      on one is `undefined`. A console is the tool you reach for when the data is wrong
- [ ] Smoke asserts the refusal at signed-out, code-only guest, and host, not just the grant

## If you touched Firestore or Storage rules

- [ ] Deny-by-default catch-all still last in the file
- [ ] A rules test for each new path, asserting the **denials**
- [ ] Cross-event isolation still holds — membership in one event must not read another
- [ ] Field-level restrictions expressed as a subcollection; Firestore rules cannot restrict
      a field
- [ ] Any new collection is unreadable by clients unless it genuinely needs a live listener
- [ ] `npm run test:rules` passes

## If you touched sessions or auth

- [ ] Cookie stays `httpOnly`, `Secure`, `SameSite=Lax`, `__Host-` prefixed
- [ ] `verifySessionCookie(..., true)` — dropping `checkRevoked` means suspension takes hours
      to take effect instead of one request
- [ ] ID tokens are never persisted client-side
- [ ] Role read from the custom claim, never from the Firestore mirror
- [ ] Guest upgrade still uses `link*`, not a fresh sign-in — otherwise the uid changes and
      the guest silently loses their membership and their posts
- [ ] Anything consuming a one-time code is guarded against double invocation

## If you touched RSVPs or the guest list

- [ ] `includePrivate` derived from the caller's permissions, never from a request
      parameter — and the notes are _not fetched at all_ when it is false, so there is no
      field left in the response to leak
- [ ] Party size re-checked against the host's own `maxPartySize`, not just the schema
      maximum; the schema cannot know which event it is for
- [ ] Tally deltas computed from the stored member document, never from a client-supplied
      previous value, so a guest cannot inflate the headcount by replaying a request
- [ ] Anonymous guests can still reply — that is deliberate; requiring an account to say
      "yes, I'll be there" loses replies for no security benefit
- [ ] A rules test covering: a guest reading someone else's note, a guest writing their own
      RSVP directly, and a guest answering on another person's behalf

## If you touched plans or entitlements

- [ ] Server-side gate present, not only a disabled button
- [ ] Gate reads `entitlementsFor(event.plan)`, so the event's own plan decides — not the
      viewer's, which would let a Pro guest unlock a free host's event
- [ ] Refusal names the specific thing and the cheapest plan that fixes it
      (`upgradeForFlag` / `upgradeForLimit`), rather than a generic upgrade wall
- [ ] Behaviour verified with `features.billing` both on and off; the preview path is what
      runs in production today and the gated path is what runs after launch

## If you touched uploads or media

- [ ] Server re-`stat`s the object and re-checks size and content type at finalize
- [ ] Content type validated against the per-kind allowlist, not the filename
- [ ] Pending object deleted on every path, success and failure alike
- [ ] Read URLs still short-lived; no URL persisted in a document
- [ ] Object paths built from `storagePaths` — a user-controlled string in a path is a
      traversal waiting to happen
- [ ] Event storage quota still enforced before a target is issued

## If you touched rate limits

- [ ] Limits in `limits.config.ts`, not inline
- [ ] Per-IP limit on anything reachable before a session exists
- [ ] Join-attempt limits still tight — they, not the code space, are what bound guessing
- [ ] `tests/unit/config.test.ts` still passes; it guards the join limit deliberately

## If you touched headers or the CSP

- [ ] No `'unsafe-inline'` in `script-src`; the nonce path still works
- [ ] `frame-ancestors 'none'` intact
- [ ] New external origin? Justify it — each one widens what an injected script can reach
- [ ] `npm run smoke` still passes its header assertions

## Always

- [ ] No secret in a client component, a log line, or an error message
- [ ] No `console.log` of a token, code, or session
- [ ] `npm audit` clean
- [ ] New env var parsed in `env.config.ts` with a sensible minimum
- [ ] `docs/SECURITY.md` updated if the guarantee changed
- [ ] If you introduced a gap on purpose, it is written down under **Known gaps** rather than
      left for someone to discover

## Quick checks

```bash
npm run test:rules    # the boundary a browser cannot cross
npm run smoke         # access model + headers, end to end
npm test              # policy matrix, code generation, validation
npm audit
```

## Reasoning about a finding

Ask, in order:

1. **Who can reach this?** Signed out, anonymous, member, moderator, host, staff.
2. **What do they learn?** Existence of a resource is information. So is a timing difference
   between "no such code" and "expired code".
3. **What do they change?** And is there an audit entry for it?
4. **What survives?** Ephemerality is a product promise. A path that leaves bytes behind
   after expiry is a security bug here, not just a cleanup bug.
