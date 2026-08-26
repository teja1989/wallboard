# Brand

## The name

**Marquee.** It means three things at once, and the product is all three:

- the lit sign that **announces** an event — the invitation
- the tent the event **happens under** — the gathering
- the scrolling display that carries **messages** through the night — the live wall

That is unusually lucky for a name. It also sets a register: a marquee is a bit grand, a
bit theatrical, and unmistakably _for an occasion_. It works for a six-year-old's birthday
and a forty-thousand-pound wedding without changing its voice, which a name like Confetti
could not have done.

It replaced **Wallboard**, which described a feature rather than naming a product, and
described the least interesting one.

### Where it sits

Evite is the incumbent, and it feels like it: cluttered, ad-heavy, dated. Paperless Post is
beautiful and expensive and stops at the invitation. Marquee's wedge is that the invitation
does not die at RSVP — the same link becomes the wall the night lives on.

So the brand has to signal _quality_, because "nicer than Evite" is the pitch, and _warmth_,
because the product is used for the happiest days of people's lives. Elegant, not cold.

## Voice

Write like a well-organised friend, not a platform.

| Do                                                | Don't                                                  |
| ------------------------------------------------- | ------------------------------------------------------ |
| "Can you make it?"                                | "Please submit your RSVP response"                     |
| "That code did not work. Check it and try again." | "ERROR: INVALID_JOIN_CODE"                             |
| "Wonderful — you are on the list."                | "RSVP recorded successfully"                           |
| "Replies have closed"                             | "This event is no longer accepting RSVPs at this time" |

Rules that follow from that:

- **Second person, active voice.** "You will get a code to share", not "A code will be
  generated".
- **Say the thing.** "The photos are deleted for real" beats "content is removed in
  accordance with our retention policy".
- **No exclamation marks in the interface.** The occasion is exciting; the software should
  not be.
- **Never celebrate at the user.** A memorial and a birthday use the same components and
  different words — that is what `occasions.config.ts` is for.
- **Refuse gracefully.** A limit message names what was hit and what fixes it. Never just
  "upgrade to continue".

Copy a guest reads lives in `branding.config.ts` or `occasions.config.ts`, never inline in
a component. Wording is product, and product belongs in config.

## Look

**Soft pastel and glass, warm.** Rounded corners, frosted overlays, generous whitespace,
gentle springs rather than duration-based easing. The design should feel like good
stationery rather than a dashboard.

- Colour is defined once in `globals.css` as tokens on `:root`, then redefined for dark.
  Nothing gets its only definition inside a media query.
- OKLCH throughout, so the pastel ramp steps evenly by _perceived_ lightness.
- Motion is springs (`branding.config.ts`), and every animation respects
  `prefers-reduced-motion`.
- Ten invitation themes, four free and six paid. The free set is deliberately good — nobody
  upgrades to escape something ugly, they upgrade to reach something better.

## Naming things inside the product

| Say          | Not                   |
| ------------ | --------------------- |
| invitation   | event page            |
| the wall     | the feed, the gallery |
| guests       | users, attendees      |
| host         | owner, admin          |
| reply / RSVP | response              |
| code         | passcode, PIN, token  |

"Event" is fine in code and in the data model. In front of a guest, it is an invitation.

## What the brand will not do

- **No fake urgency.** No countdown timers on pricing, no "3 people are viewing this".
- **No dark patterns in the paywall.** Locked features are visible and labelled; nothing is
  hidden to manufacture a discovery moment, and nothing is unlocked-then-taken-away.
- **No claiming to charge when we do not.** While `features.billing` is off, the pricing page
  says so plainly.
- **No advertising against guest content.** See `ADS_MARKETING.md` — event content is never
  an input to targeting, because the product's whole promise is that it disappears.
