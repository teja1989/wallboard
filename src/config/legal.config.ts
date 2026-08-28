/**
 * The legal pages.
 *
 * Here rather than hardcoded in the pages for the usual reason — every string a visitor
 * reads lives in config — and for one specific to these: Google's OAuth consent screen
 * requires a privacy policy URL that actually resolves before it will let an app serve
 * anyone outside its test-user list. These pages are what makes production sign-in possible
 * at all, so the URLs need to be stable and the dates need to be honest.
 *
 * **Written to describe what the code actually does**, not what a template says. Marquee
 * holds photographs of people's weddings, the phone numbers of their guests, and notes
 * those guests wrote for the host alone. A policy that overstates or understates that is
 * worse than none, because people make decisions based on it.
 *
 * Not legal advice, and not a substitute for a lawyer reading it before this takes money at
 * scale. It is an accurate description of the system by someone who read the system.
 */

export const legalConfig = {
  /** Bump when the substance changes, not for a typo. */
  effectiveDate: '28 August 2026',

  /**
   * Whose law governs the terms.
   *
   * Left unset deliberately: guessing a jurisdiction is worse than admitting it is unset,
   * because the wrong one is unenforceable *and* misleading. Fill this in and the clause
   * appears; until then the terms say plainly that it is not yet settled.
   */
  governingLaw: '',

  /** Sub-processors. Anyone who can see user data has to be named. */
  processors: [
    {
      name: 'Google Cloud and Firebase',
      does: 'Hosting, the database, file storage, and sign-in. Data is stored in the United States (us-central1).',
    },
    {
      name: 'Resend',
      does: 'Delivers invitation and reminder emails. Sees the recipient address and the message.',
    },
  ],
} as const;
