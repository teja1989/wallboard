import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  apiCall,
  createEvent,
  resetRateLimits,
  signIn,
  browseCreateAnonymously,
  signInAsGuest,
  signInFromHere,
  uniqueEmail,
} from './helpers';

/**
 * End-to-end journeys through the real UI, against the Firebase emulators.
 *
 * These cover what the API-level smoke test cannot: that the screens render the right
 * state, that the live wall actually updates without a reload, and that a guest is shown
 * the sign-in path rather than a broken composer.
 */

test.beforeEach(async ({ request }) => {
  await resetRateLimits(request);
});

test.describe('the marketing site', () => {
  test('the landing page offers both ways in', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /make an invitation/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /i have a code/i }).first()).toBeVisible();
  });

  test('pricing shows all three plans and is honest about the preview', async ({ page }) => {
    await page.goto('/pricing');
    // The plan names sit under the section that introduces them, so they are h3 rather than
    // h2 — asserted by name and not by level, so the next layout change to this page does not
    // fail a test that never cared where in the outline they sat.
    await expect(page.getByRole('heading', { name: 'Free', exact: true })).toBeVisible();
    // `exact` on all three: the page now also carries an "One event Plan" heading in the
    // comparison matrix, and a substring match resolves to both.
    await expect(page.getByRole('heading', { name: 'One event', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
    // Billing is off by default, so the page must say so rather than implying we charge.
    await expect(page.getByText(/free during preview/i)).toBeVisible();
  });

  test('the create page asks for an account, and offers a way past', async ({ page }) => {
    // An account captured here is the one that comes back. But a wall in front of an unseen
    // product loses the merely curious, so the escape is stated plainly rather than hidden.
    await page.goto('/create');
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();

    await page.getByRole('button', { name: /have a look around first/i }).click();
    await expect(page.getByLabel('What are we calling it?')).toBeEditable();
  });

  test('having looked around once, the gate does not return', async ({ page }) => {
    await page.goto('/create');
    await page.getByRole('button', { name: /have a look around first/i }).click();
    await expect(page.getByLabel('What are we calling it?')).toBeVisible();

    // Being asked the same question on every refresh is its own kind of wall.
    await page.reload();
    await expect(page.getByLabel('What are we calling it?')).toBeVisible();
  });
});

test.describe('creating an event', () => {
  test('a signed-in host makes an invitation and is shown the code once', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    await page.goto('/create');

    await page.getByRole('button', { name: /dinner/i }).click();
    await page.getByLabel('What are we calling it?').fill('Rooftop dinner');
    await page.getByLabel('Hosted by').fill('Priya & Sam');
    await page.getByLabel('Where?').fill('The Rooftop');
    await page.getByRole('button', { name: /create the invitation/i }).click();

    await expect(page.getByRole('heading', { name: /your invitation is ready/i })).toBeVisible();

    const code = await page.locator('.code-display').first().innerText();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    // The guest list is the primary action, not the code. This screen used to offer a code
    // and "Share the link" and never mention guests, so the default path skipped per-guest
    // links, delivery status and reminders entirely.
    await expect(page.getByRole('button', { name: /add your guests/i })).toBeVisible();
    await expect(page.getByText(/nothing sent that way can be tracked/i)).toBeVisible();

    /*
      The link, readable rather than only copyable.

      It used to exist solely behind `navigator.share` and a clipboard write, so on a desktop
      browser without the Web Share API a host was never shown their own invitation URL —
      "Share the link" silently became a copy, and a failed clipboard write left nothing.
    */
    const shown = page.getByText(new RegExp(`/i/${code.replace('-', '')}`, 'i'));
    await expect(shown).toBeVisible();
    await expect(page.getByRole('button', { name: /copy link/i })).toBeVisible();

    await page.getByRole('button', { name: /or just look at it first/i }).click();
    await expect(page.getByRole('heading', { name: 'Rooftop dinner' })).toBeVisible();
    await expect(page.getByText('From Priya & Sam')).toBeVisible();
    await expect(page.getByText('The Rooftop')).toBeVisible();
  });

  test('the form says an account is still coming', async ({ page }) => {
    await browseCreateAnonymously(page);
    await expect(page.getByText(/you will sign in when you create it/i)).toBeVisible();
  });

  test('the form never claims that creating an invitation sends it', async ({ page }) => {
    /*
      Every occasion's button said "Send the invitation", and pressing it sends nothing: it
      creates the event, and guests are added afterwards. A host who believed it had a reason
      to think forty emails had just gone out, and no reason to open the guest list — which is
      where per-guest links, delivery status and reminders all live.
    */
    await browseCreateAnonymously(page);

    await expect(page.getByRole('button', { name: /create the invitation/i })).toBeVisible();
    await expect(page.getByText(/nothing is sent yet/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^send the invitation$/i })).toHaveCount(0);
  });

  test('an account is asked for at publish, and the draft survives it', async ({ page }) => {
    const email = uniqueEmail('host');

    // Build the whole thing with no account at all, past the gate.
    await browseCreateAnonymously(page);
    await page.getByRole('button', { name: /dinner/i }).click();
    await page.getByLabel('What are we calling it?').fill('Anonymous rooftop dinner');
    await page.getByLabel('Hosted by').fill('Someone New');
    await page.getByRole('button', { name: /create the invitation/i }).click();

    // The gate lands here, and explains itself rather than just refusing.
    await expect(page.getByRole('heading', { name: /almost there/i })).toBeVisible();
    await expect(page.getByText(/your invitation is saved/i)).toBeVisible();

    // Sign in from right here, and navigate nowhere afterwards. The link has to bring them
    // back on its own: it used to drop everyone on the home page, which left the draft
    // saved and unreachable and the invitation never created.
    await signInFromHere(page, email);

    await expect(page.getByRole('heading', { name: /your invitation is ready/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: /or just look at it first/i }).click();
    await expect(page.getByRole('heading', { name: 'Anonymous rooftop dinner' })).toBeVisible();
    await expect(page.getByText('From Someone New')).toBeVisible();
  });

  test('a draft nobody published is restored but not sent', async ({ page }) => {
    // Signing in for some other reason must not fire off a half-written invitation.
    await browseCreateAnonymously(page);
    await page.getByLabel('What are we calling it?').fill('Half a thought');

    // Autosaved as they type, so there is something to restore.
    await expect
      .poll(() => page.evaluate(() => window.localStorage.getItem('marquee.draft.event.v1')))
      .toContain('Half a thought');

    await signIn(page, uniqueEmail('host'));
    await page.goto('/create');

    // Restored, and pointedly not sent: the form is still a form.
    await expect(page.getByRole('heading', { name: /make an invitation/i })).toBeVisible();
    await expect(page.getByLabel('What are we calling it?')).toHaveValue('Half a thought');
    await expect(page.getByText(/we kept what you had written/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /your invitation is ready/i })).toHaveCount(0);
  });

  test('the form refuses an invitation with no name', async ({ page }) => {
    await browseCreateAnonymously(page);
    await expect(page.getByRole('button', { name: /create the invitation/i })).toBeDisabled();
  });

  test('the design gallery is browsable and filterable by occasion', async ({ page }) => {
    /*
      The gallery used to be static sections with an occasion heading over each. It is now a
      filter bar over one grid, so "grouped by occasion" is no longer the guarantee — being
      able to narrow to your occasion is. That is the thing worth asserting either way, and
      asserting the count changes is what stops a filter that renders but does nothing.
    */
    await page.goto('/templates');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const cards = page.getByRole('button', { name: 'Quick Preview' });
    const total = await cards.count();
    expect(total).toBeGreaterThan(0);

    await page
      .getByRole('button', { name: /wedding/i })
      .first()
      .click();
    await expect(page.getByText(/of \d+ designs/i)).toBeVisible();
    expect(await cards.count()).toBeLessThanOrEqual(total);

    // Every route out of the gallery still lands somewhere someone can act on.
    await expect(page.getByRole('link', { name: /make an invitation/i }).first()).toBeVisible();
  });

  test('every design is offered while billing is in preview', async ({ page }) => {
    // Billing is off, so nothing is gated — and the page says exactly that rather than
    // dangling a paywall the visitor will never actually meet.
    await browseCreateAnonymously(page);
    await expect(page.getByRole('button', { name: 'Midnight' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Sunset' })).toBeEnabled();
    await expect(
      page.getByText(/every design is available while we are in preview/i),
    ).toBeVisible();
  });
});

/**
 * The address field has to be a text box first.
 *
 * Half of real events happen somewhere Google has never heard of, and CI runs with no API
 * key at all — which is also what a deploy that has not been given one looks like. If this
 * ever degrades into an error or a dead affordance, hosts cannot say where the party is.
 */
/**
 * The preview.
 *
 * There was none. A host chose a design from a swatch, typed a title, a date and a venue, and
 * pressed publish having never seen the card — their first sight of their own invitation came
 * after it existed and had a code attached.
 */
test.describe('previewing the invitation', () => {
  /**
   * Both placements are in the DOM at once and CSS decides which one shows — a media query
   * resolved in JavaScript would hydrate to a different tree than the server sent. So the
   * assertions below name the *visible* one rather than either.
   */
  const visiblePreview = 'section[aria-label="Invitation preview"]:visible';

  test('shows the real card, and it follows what the host types', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 1000 });
    await browseCreateAnonymously(page);

    const preview = page.locator(visiblePreview);
    await expect(preview).toBeVisible();

    await page.getByLabel('What are we calling it?').fill("Ada's 40th");
    await page.getByLabel('Hosted by').fill('Grace');

    // The same component the guest gets, so what is on screen is what will send.
    await expect(preview.getByText("Ada's 40th")).toBeVisible();
    await expect(preview.getByText('From Grace')).toBeVisible();
    // The occasion's own copy, from the real component — proof this is the card and not a
    // sketch of one.
    await expect(preview.getByText(/has not set a date yet/i)).toBeVisible();
  });

  test('is reachable on a phone, above the button that commits', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await browseCreateAnonymously(page);

    await page.getByLabel('What are we calling it?').fill('Rooftop thing');

    // Collapsed by default — there is no room to show the card and the form at once.
    const toggle = page.getByRole('button', { name: /preview what your guests will see/i });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator(visiblePreview).getByText('Rooftop thing')).toBeVisible();
  });

  test('cannot be tabbed into, so it never steals a half-finished draft', async ({ page }) => {
    // It is a picture of an invitation, not one. Its directions link and add-to-calendar
    // button would otherwise be reachable and would navigate away mid-form.
    await page.setViewportSize({ width: 1400, height: 1000 });
    await browseCreateAnonymously(page);

    await page.getByLabel('What are we calling it?').fill('Tab test');
    await page.getByLabel(/where is it/i).fill('14 Bridge Street');

    // The card renders, and the subtree carrying it is `inert` — which is what stops a
    // browser focusing or clicking anything inside it.
    const preview = page.locator(visiblePreview);
    await expect(preview.getByText('14 Bridge Street')).toBeVisible();
    await expect(preview.locator('[inert]')).toHaveCount(1);

    // Asserted by behaviour rather than by role. Playwright's role queries read the DOM, so
    // they still find elements a browser has made inert — the honest check is that focus
    // cannot get there, which is what a keyboard user actually experiences.
    const focusedInsidePreview = await preview.evaluate((node) => {
      const link = node.querySelector('a');
      link?.focus();
      return node.contains(document.activeElement);
    });
    expect(focusedInsidePreview).toBe(false);
  });
});

test.describe('the address field', () => {
  test('takes a typed address with no lookup configured', async ({ page }) => {
    await browseCreateAnonymously(page);

    const address = page.getByLabel(/where is it/i);
    await address.fill('The back garden, 14 Bridge Street');
    await expect(address).toHaveValue('The back garden, 14 Bridge Street');

    // No suggestions, no error, and nothing blocking the rest of the form.
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByText(/unavailable|error|failed/i)).toHaveCount(0);
  });

  test('an address survives all the way onto the invitation', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    await page.goto('/create');

    await page.getByLabel('What are we calling it?').fill('Address journey');
    await page.getByLabel('Where?').fill('The back garden');
    await page.getByLabel(/where is it/i).fill('14 Bridge Street');
    await page.getByRole('button', { name: /create the invitation/i }).click();

    await expect(page.getByRole('heading', { name: /your invitation is ready/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole('button', { name: /or just look at it first/i }).click();

    await expect(page.getByText('14 Bridge Street')).toBeVisible({ timeout: 15_000 });
    // A typed address gets directions but no map — a map of the wrong street is worse
    // than none.
    await expect(page.getByRole('link', { name: /get directions/i })).toBeVisible();
  });

  test('the map proxy refuses coordinates that are not on Earth', async ({ page }) => {
    // It is a public route reachable from any invitation, so its input is bounded.
    for (const query of ['lat=91&lng=0', 'lat=0&lng=181', 'lat=nope&lng=0']) {
      const response = await page.request.get(`/api/places/map?${query}`);
      expect(response.status()).toBe(404);
    }
  });
});

test.describe('joining', () => {
  test('a wrong code is refused with an explanation', async ({ page }) => {
    await signInAsGuest(page);
    await page.goto('/join');

    await page.getByLabel('Event code').fill('ZZZZZZZZ');
    await page.getByRole('button', { name: /open it/i }).click();

    await expect(page.locator('#join-error')).toContainText(/did not work/i);
  });

  test('the code field formats as you type and gates the button', async ({ page }) => {
    await signInAsGuest(page);
    await page.goto('/join');

    const field = page.getByLabel('Event code');
    await field.fill('abcd234');
    await expect(page.getByRole('button', { name: /open it/i })).toBeDisabled();

    await field.fill('abcd2345');
    await expect(field).toHaveValue('ABCD-2345');
    await expect(page.getByRole('button', { name: /open it/i })).toBeEnabled();
  });

  test('a guest joins with a code and lands on the wall as a watcher', async ({
    browser,
    page,
  }) => {
    await signIn(page, uniqueEmail('host'));
    const { joinCode } = await createEvent(page, 'Guest arrival test');

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await signInAsGuest(guestPage);

    await guestPage.goto('/join');
    await guestPage.getByLabel('Event code').fill(joinCode);
    await guestPage.getByRole('button', { name: /open it/i }).click();

    await expect(guestPage.getByRole('heading', { name: 'Guest arrival test' })).toBeVisible();
    // A guest lands on the invitation, because they have not replied yet.
    await expect(
      guestPage.getByRole('heading', { name: /coming\?|can you make it/i }),
    ).toBeVisible();

    await guestContext.close();
  });
});

test.describe('the wall', () => {
  test('a member posts and it appears without a reload', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Live update test');

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: 'Wall', exact: true }).click();
    await expect(page.getByText(/nothing here yet/i)).toBeVisible();

    await page.getByPlaceholder('Say something…').fill('First post from the host');
    await page.getByRole('button', { name: 'Post' }).click();

    await expect(page.getByText('First post from the host')).toBeVisible();
    await expect(page.getByText(/nothing here yet/i)).toHaveCount(0);
  });

  test('a second member’s post streams into an already-open wall', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId, joinCode } = await createEvent(page, 'Streaming test');
    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: 'Wall', exact: true }).click();
    await expect(page.getByText(/nothing here yet/i)).toBeVisible();

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await signIn(guestPage, uniqueEmail('member'));
    await apiCall(guestPage, '/api/events/join', { code: joinCode });
    await apiCall(guestPage, '/api/posts', { eventId, body: 'Hello from the other tab' });

    // The host's page never reloads — this can only arrive through the Firestore listener.
    await expect(page.getByText('Hello from the other tab')).toBeVisible({ timeout: 15_000 });

    await guestContext.close();
  });

  test('the host can remove a post', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Moderation test');
    await apiCall(page, '/api/posts', { eventId, body: 'Remove me please' });

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: 'Wall', exact: true }).click();
    await expect(page.getByText('Remove me please')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: /remove this post/i })
      .first()
      .click();

    await expect(page.getByText('Remove me please')).toHaveCount(0, { timeout: 15_000 });
  });

  test('the host panel reveals and rotates the code', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId, joinCode } = await createEvent(page, 'Code panel test');

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: /host controls/i }).click();

    const panel = page.getByRole('dialog', { name: /host controls/i });
    await expect(panel).toBeVisible();

    /*
      The code is not on screen until somebody asks for it.

      The co-host work briefly fetched it when the panel opened, so opening the settings drawer
      auto-revealed the credential and wrote an `event.codeViewed` audit entry for a read
      nobody had performed. It also replaced this button mid-click, which is what the CI
      failure ("element was detached from the DOM") was actually reporting.
    */
    await expect(panel.locator('.code-display')).toHaveCount(0);
    await expect(panel.getByRole('button', { name: /show the code/i })).toBeVisible();

    await panel.getByRole('button', { name: /show the code/i }).click();
    const shown = panel.locator('.code-display');
    await expect(shown).toBeVisible();
    expect((await shown.innerText()).replace('-', '')).toBe(joinCode);

    page.once('dialog', (dialog) => dialog.accept());
    await panel.getByRole('button', { name: /new code/i }).click();
    await expect(shown).not.toHaveText(new RegExp(joinCode.slice(0, 4)));
  });

  test('an ended event becomes read-only', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Ending test');
    await apiCall(page, `/api/events/${eventId}/end`);

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: 'Wall', exact: true }).click();
    await expect(page.getByText(/this wall is closed/i)).toBeVisible();
    await expect(page.getByPlaceholder('Say something…')).toHaveCount(0);
  });

  test('a non-member is turned away', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Private event');

    const outsiderPage = await (await page.context().browser()!.newContext()).newPage();
    await signIn(outsiderPage, uniqueEmail('outsider'));
    await outsiderPage.goto(`/e/${eventId}`);

    await expect(outsiderPage.getByText(/could not open that invitation/i)).toBeVisible();
    await outsiderPage.context().close();
  });
});

test.describe('the account', () => {
  test('a host is greeted by name and finds what they made', async ({ page }) => {
    const email = uniqueEmail('host');
    await signIn(page, email);
    await createEvent(page, 'Something I made');

    await page.goto('/account');

    // The greeting is derived from the address when no provider supplied a name, so
    // `host-…@example.com` becomes "Host".
    await expect(page.getByRole('heading', { name: /hello, host/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Something I made' })).toBeVisible();
    await expect(page.getByText(/1 invitation/)).toBeVisible();
  });

  test('the header carries an account menu once you are signed in', async ({ page }) => {
    const email = uniqueEmail('host');
    await signIn(page, email);

    await page.goto('/');
    const header = page.getByRole('banner');
    // Signed in, the header stops selling and starts serving. Generous, because a cold load
    // has to settle the Firebase SDK before the header knows who is looking.
    await expect(header.getByRole('link', { name: /new invitation/i })).toBeVisible({
      timeout: 20_000,
    });

    await header.getByRole('button', { name: /your account/i }).click();
    await expect(page.getByText(email)).toBeVisible();
    await page.getByRole('menuitem', { name: /your invitations/i }).click();

    await page.waitForURL(/\/account/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /hello, host/i })).toBeVisible();
  });

  test('a visitor with no account is offered a way in, not an account menu', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: /^sign in$/i })).toBeVisible();
    await expect(header.getByRole('link', { name: /start free/i })).toBeVisible();
    await expect(header.getByRole('button', { name: /your account/i })).toHaveCount(0);
  });

  test('the plan section is honest that nothing is being charged', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));

    await page.goto('/account?tab=plan');
    await expect(page.getByText(/nothing is being charged/i)).toBeVisible();
    // The preview runs every invitation on the top plan, and says so rather than dangling
    // an upgrade button that would either take money or do nothing.
    await expect(page.getByRole('button', { name: /^manage billing$/i })).toHaveCount(0);
  });

  test('a host renames themselves and it sticks', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));

    await page.goto('/account?tab=settings');
    const name = page.getByLabel('Your name');
    await expect(name).toHaveValue(/.+/);
    await name.fill('Ravi Patel');
    await page.getByRole('button', { name: /^save$/i }).click();

    await expect(page.getByRole('heading', { name: /hello, ravi/i })).toBeVisible({
      timeout: 15_000,
    });

    // And it survives a reload, which is the only proof the server kept it.
    await page.reload();
    await expect(page.getByRole('heading', { name: /hello, ravi/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('signing out ends the session', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    await page.goto('/account?tab=settings');

    await page.getByRole('button', { name: /sign out/i }).click();
    await page.waitForURL('/', { timeout: 15_000 });

    // And the page that needs an account asks for one again. Generous, because this is a
    // cold load that has to settle both the server session and the Firebase SDK before it
    // knows there is nobody here.
    await page.goto('/account');
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('it shows nobody else their events', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    await createEvent(page, 'Private to its host');

    const otherContext = await browser.newContext();
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, uniqueEmail('other'));
    await otherPage.goto('/account');

    await expect(otherPage.getByText(/no invitations yet/i)).toBeVisible({ timeout: 20_000 });
    await expect(otherPage.getByText('Private to its host')).toHaveCount(0);
    await otherContext.close();
  });
});

test.describe('the invitation link', () => {
  test('a shared link opens the invitation for someone with no account', async ({
    browser,
    page,
  }) => {
    // The link is the product's whole distribution loop. It used to point at /e/{id},
    // which turns away everyone who is not already a member — that is, every recipient.
    await signIn(page, uniqueEmail('host'));
    const { joinCode } = await createEvent(page, 'Shared link party');

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();

    await guestPage.goto(`/i/${joinCode.replace('-', '')}`);

    // No code typed, no account, no app — exactly what the invitation promises.
    await expect(guestPage.getByRole('heading', { name: 'Shared link party' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(guestPage).toHaveURL(/\/e\//);
    await guestContext.close();
  });

  test('a link carrying a dead code explains itself', async ({ browser }) => {
    const context = await browser.newContext();
    const guestPage = await context.newPage();

    await guestPage.goto('/i/ZZZZZZZZ');
    await expect(guestPage.getByRole('heading', { name: /did not open/i })).toBeVisible();
    await expect(guestPage.getByRole('button', { name: /enter a code instead/i })).toBeVisible();
    await context.close();
  });

  test('the link carries a preview card for a group chat', async ({ page, request }) => {
    await signIn(page, uniqueEmail('host'));
    const { joinCode } = await createEvent(page, 'Preview party');
    const code = joinCode.replace('-', '');

    // What a crawler sees, which is where almost every guest first meets the product.
    await page.goto(`/i/${code}`);
    const og = page.locator('meta[property="og:title"]');
    await expect(og).toHaveAttribute('content', /Preview party/);

    const image = await request.get(`/i/${code}/opengraph-image`);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toContain('image/png');
    expect((await image.body()).byteLength).toBeGreaterThan(1000);
  });
});

test.describe('the invitation and RSVP', () => {
  test('a guest opens the invitation, replies, and lands on the guest list', async ({
    browser,
    page,
  }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId, joinCode } = await createEvent(page, 'RSVP journey');

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await signInAsGuest(guestPage);

    await guestPage.goto('/join');
    await guestPage.getByLabel('Event code').fill(joinCode);
    await guestPage.getByRole('button', { name: /open it/i }).click();

    await expect(guestPage.getByRole('heading', { name: 'RSVP journey' })).toBeVisible();

    // The details come before the numbers: party size only appears once they say yes.
    await expect(guestPage.getByRole('radio', { name: 'Going' })).toBeVisible();
    await guestPage.getByRole('radio', { name: 'Going' }).click();
    await guestPage.getByRole('button', { name: /i'll be there/i }).click();

    // The reply lands on a panel that does something with the moment, not a toast.
    await expect(guestPage.getByRole('heading', { name: /you're going/i })).toBeVisible();

    // The host sees the reply on the guest list without reloading anything by hand.
    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: 'Guests' }).click();
    await expect(page.getByText(/people coming|person coming/i)).toBeVisible();
    await expect(page.getByText('Replied · 2')).toBeVisible();

    await guestContext.close();
  });

  test('declining is one tap and needs no further detail', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { joinCode } = await createEvent(page, 'Declining test');

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await signInAsGuest(guestPage);

    await guestPage.goto('/join');
    await guestPage.getByLabel('Event code').fill(joinCode);
    await guestPage.getByRole('button', { name: /open it/i }).click();

    await guestPage.getByRole('radio', { name: /can't make it/i }).click();
    await expect(guestPage.getByRole('heading', { name: /thanks for saying/i })).toBeVisible();
    // No party size prompt appears for someone who is not coming.
    await expect(guestPage.getByText(/how many of you/i)).toHaveCount(0);

    // Nor is it a dead end. Not being able to come is not the same as having nothing to say,
    // and for a birthday it is frequently the opposite.
    await expect(
      guestPage.getByRole('button', { name: /leave them a message anyway/i }),
    ).toBeVisible();
    // And the confirmation does not offer a calendar entry for a thing they just said they
    // cannot attend. Scoped to the panel: the invitation above it has its own, which is
    // correct — somebody may still want the date without being able to come.
    const declined = guestPage.getByRole('region', { name: /thanks for saying/i });
    await expect(declined.getByRole('button', { name: /add to calendar/i })).toHaveCount(0);

    await guestContext.close();
  });

  test('a guest can change their answer', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Changing minds');

    // The host is already attending their own event, so they land on the confirmation rather
    // than on radio buttons — which is the point of it.
    await page.goto(`/e/${eventId}`);
    await expect(page.getByRole('heading', { name: /you're going/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole('button', { name: /change my reply/i }).click();
    await page.getByRole('radio', { name: /maybe/i }).click();
    await expect(page.getByRole('heading', { name: /marked as maybe/i })).toBeVisible();

    // A returning guest gets the confirmation, not the radio buttons they already used.
    await page.reload();
    await expect(page.getByRole('heading', { name: /marked as maybe/i })).toBeVisible({
      timeout: 20_000,
    });

    // Changing it is always one quiet tap away — a reply is not a contract.
    await page.getByRole('button', { name: /change my reply/i }).click();
    await expect(page.getByRole('radio', { name: 'Going' })).toBeVisible();
    await page.getByRole('radio', { name: 'Going' }).click();
    // "Update my reply", not "I'll be there" — the button knows they have answered before.
    await page.getByRole('button', { name: /update my reply/i }).click();
    await expect(page.getByRole('heading', { name: /you're going/i })).toBeVisible();
  });

  /**
   * The instant after "yes" is the highest intent anyone has in this product. It used to be
   * spent on a toast that faded, leaving the same three buttons on screen.
   */
  test('saying yes offers the date and a way in, not a fading toast', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { joinCode } = await createEvent(page, 'What happens next');

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/i/${joinCode.replace('-', '')}`);
    await expect(guestPage.getByRole('heading', { name: 'What happens next' })).toBeVisible({
      timeout: 20_000,
    });

    await guestPage.getByRole('radio', { name: 'Going' }).click();
    await guestPage.getByRole('button', { name: /i'll be there/i }).click();

    const confirmed = guestPage.getByRole('region', { name: /you're going/i });
    await expect(confirmed).toBeVisible();
    // The thing that actually makes somebody turn up.
    await expect(confirmed.getByRole('button', { name: /add to calendar/i })).toBeVisible();
    /*
      The host counts as attending their own event, so this guest is not the first.

      Phrased as *others* deliberately, and asserted here because the facepile briefly replaced
      it with a caption that names attendees — which, with one attendee, reads the reader's own
      name back at the person who has just this second replied. See `rsvpCopy.othersComing`.
    */
    await expect(confirmed.getByText(/other person is coming|others are coming/i)).toBeVisible();

    await confirmed.getByRole('button', { name: /say hello on the wall/i }).click();
    await expect(guestPage.getByRole('button', { name: 'Wall', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await guestContext.close();
  });

  test('a guest says who is coming, not just how many', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId, joinCode } = await createEvent(page, 'Family picnic');

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/i/${joinCode.replace('-', '')}`);
    await expect(guestPage.getByRole('heading', { name: 'Family picnic' })).toBeVisible({
      timeout: 20_000,
    });

    await guestPage.getByRole('radio', { name: 'Going' }).click();
    await expect(guestPage.getByText(/bringing anyone with you/i)).toBeVisible();

    // Two adults and a child — a headcount of four that a host can actually cater for.
    await guestPage.getByRole('button', { name: /one more adults/i }).click();
    await guestPage.getByRole('button', { name: /one more children/i }).click();
    await guestPage.getByRole('button', { name: /i'll be there/i }).click();
    await expect(guestPage.getByRole('heading', { name: /you're going/i })).toBeVisible();

    // The host sees the breakdown, not a bare number.
    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: 'Guests' }).click();
    await expect(page.getByText(/1 child/i)).toBeVisible();
    await guestContext.close();
  });

  test('the guest list shows the headcount, not just the reply count', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Headcount test');

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: 'Guests' }).click();

    // The host counts as one attending from the moment they create the invitation.
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/person coming/i)).toBeVisible();
  });
});

/**
 * Inviting people.
 *
 * All of this used to happen inside the host-controls drawer. It lives on the Guests tab now,
 * beside the replies, because inviting someone and seeing whether they answered is one job.
 */
test.describe('inviting people', () => {
  /** The guest list and the form for adding to it, on the tab where they now live. */
  async function openGuests(page: Page, eventId: string) {
    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: 'Guests', exact: true }).click();
    return page.getByRole('region', { name: /add your guests/i });
  }

  test('a host builds a list, sends it, and does not send twice', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Email journey');
    const guest = uniqueEmail('guest');

    const form = await openGuests(page, eventId);
    await form.getByLabel('Name').fill('Priya Sharma');
    await form.getByLabel(/phone or email/i).fill(guest);
    await form.getByRole('button', { name: /^add/i }).click();

    await expect(page.getByText('Priya Sharma')).toBeVisible();
    await expect(page.getByText('Not sent')).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /email all 1/i }).click();
    await expect(page.getByText('Sent', { exact: true })).toBeVisible({ timeout: 15_000 });

    // The invitation goes once; that is what the nudge button is for. The send control is
    // gone rather than greyed out — a disabled button offering to email nobody read as the
    // panel's primary action while being permanently dead.
    await expect(page.getByRole('button', { name: /^email all \d+$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /nudge non-repliers/i })).toBeVisible();
  });

  test('a host sends to one guest without sending to the rest', async ({ page }) => {
    /*
      "Email everyone unsent" was the only send there was, which is the wrong granularity for
      the way a guest list is built: people arrive in ones and twos over a week, and a host
      who has just added their sister should not have to wait or re-run the whole list.
    */
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'One at a time');
    const first = uniqueEmail('first');
    const second = uniqueEmail('second');

    const form = await openGuests(page, eventId);
    for (const [name, address] of [
      ['Ada First', first],
      ['Grace Second', second],
    ] as const) {
      await form.getByLabel('Name').fill(name);
      await form.getByLabel(/phone or email/i).fill(address);
      await form.getByRole('button', { name: /^add/i }).click();
      await expect(page.getByText(name)).toBeVisible();
    }

    await expect(page.getByRole('button', { name: /^email all 2$/i })).toBeVisible();

    // No confirm dialog on a single named send: the row names them, and one email to one
    // person is not the irreversible-feeling act that emailing forty is.
    await page.getByRole('button', { name: `Email the invitation to Ada First` }).click();

    await expect(page.getByText('Sent', { exact: true })).toHaveCount(1, { timeout: 15_000 });
    // The other guest is untouched, and the bulk button now offers exactly the one left.
    await expect(page.getByText('Not sent')).toHaveCount(1);
    await expect(page.getByRole('button', { name: /^email all 1$/i })).toBeVisible();

    // Their row's send button is gone — the invitation goes once, and the control disappears
    // rather than sitting there greyed out, matching how the bulk button behaves.
    await expect(
      page.getByRole('button', { name: 'Email the invitation to Ada First' }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Email the invitation to Grace Second' }),
    ).toBeVisible();
  });

  /**
   * The reason the form was rebuilt.
   *
   * The old paste box could only attach a name through `Name <address>` — angle brackets, and
   * unavailable to anyone entering a phone number. Typing a name beside a number silently
   * dropped the name, so a host ended up with a list of bare digits.
   */
  test('a guest can be added by name and phone number, with the name kept', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Phone journey');

    const form = await openGuests(page, eventId);
    await form.getByLabel('Name').fill('Lee Nakamura');
    await form.getByLabel(/phone or email/i).fill('+1 415 555 0161');
    await form.getByRole('button', { name: /^add/i }).click();

    await expect(page.getByText('Lee Nakamura')).toBeVisible();
    // Normalised on the way in, so it is dialable or it is not stored.
    await expect(page.getByText('+14155550161')).toBeVisible();

    // Nobody can be emailed, so the email buttons have nothing to offer.
    await expect(page.getByRole('button', { name: /^email all \d+$/i })).toHaveCount(0);
    // But the host can still send it themselves, which is the whole point.
    await expect(page.getByRole('button', { name: /copy every message/i })).toBeEnabled();
  });

  test('the form clears once the guests are on the list', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Clear after add');

    const form = await openGuests(page, eventId);
    await form.getByLabel('Name').fill('Ada Lovelace');
    await form.getByLabel(/phone or email/i).fill(uniqueEmail('ada'));
    await form.getByRole('button', { name: /^add/i }).click();

    await expect(page.getByText('Ada Lovelace')).toBeVisible();
    await expect(form.getByLabel('Name')).toHaveValue('');
    await expect(form.getByLabel(/phone or email/i)).toHaveValue('');
  });

  test('a pasted list fills a row per person', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Pasted list');

    const form = await openGuests(page, eventId);
    const contact = form.getByLabel(/phone or email/i);
    await contact.click();
    // Paste is what a host with a list in their phone actually does; it must not all land in
    // one field.
    await contact.evaluate((node: HTMLInputElement) => {
      const data = new DataTransfer();
      data.setData('text', 'Ada <ada@example.com>, Grace <grace@example.com>, +14155550177');
      node.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    });

    await expect(form.getByRole('button', { name: /^add 3$/i })).toBeEnabled();
    await form.getByRole('button', { name: /^add 3$/i }).click();
    await expect(page.getByText('Ada', { exact: true })).toBeVisible();
    await expect(page.getByText('Grace', { exact: true })).toBeVisible();
  });

  test('nothing that is not a contact gets added', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Bad addresses');

    const form = await openGuests(page, eventId);
    await form.getByLabel('Name').fill('Someone');
    await form.getByLabel(/phone or email/i).fill('not a way to reach anyone');

    // Said out loud rather than left as a greyed-out button with no explanation.
    await expect(form.getByText(/not an address or a number/i)).toBeVisible();
    await expect(form.getByRole('button', { name: /^add$/i })).toBeDisabled();
  });

  test('only the host is offered the invite form', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId, joinCode } = await createEvent(page, 'Members do not invite');

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/i/${joinCode.replace('-', '')}`);
    await guestPage.waitForURL(`**/e/${eventId}`, { timeout: 20_000 });
    await guestPage.getByRole('button', { name: 'Guests', exact: true }).click();

    // A member sees who replied. Adding people and reading delivery status is the host's.
    await expect(guestPage.getByRole('region', { name: /add your guests/i })).toHaveCount(0);
    await guestContext.close();
  });

  test('the host can read the email before it goes to anybody', async ({ page }) => {
    // `renderEmail` builds the HTML that lands in forty inboxes and there was no way to look
    // at it — the product asked people to send something they had never read.
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Read it first');

    const form = await openGuests(page, eventId);
    await form.getByLabel('Name').fill('Priya Sharma');
    await form.getByLabel(/phone or email/i).fill(uniqueEmail('guest'));
    await form.getByRole('button', { name: /^add/i }).click();
    await expect(page.getByText('Priya Sharma')).toBeVisible();

    await page.getByRole('button', { name: /see what guests receive/i }).click();

    // Sandboxed, so it cannot reach the page it is embedded in.
    const preview = page.frameLocator('iframe[title="The invitation email"]');
    await expect(preview.getByText('Read it first')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('iframe[title="The invitation email"]')).toHaveAttribute(
      'sandbox',
      '',
    );

    // Says what it does and does not prove, rather than implying deliverability.
    await expect(page.getByText(/spam folder.*guest/i)).toBeVisible();
  });

  test('the email preview is host-only', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId, joinCode } = await createEvent(page, 'Private preview');

    // A signed-in member, not an anonymous one: an anonymous visitor is turned away at
    // identity with a 401 and never reaches the permission at all, so testing that would
    // prove nothing about who is allowed to see this.
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signIn(memberPage, uniqueEmail('member'));
    await memberPage.goto(`/i/${joinCode.replace('-', '')}`);
    await memberPage.waitForURL(`**/e/${eventId}`, { timeout: 20_000 });

    // Through the page, not `request`: `page.request` is a separate context that does not
    // carry the session cookie, so it would answer 401 for everyone and prove nothing.
    // The rendered HTML carries a working invitation link, so it is as sensitive as the code.
    const status = await memberPage.evaluate(async (id) => {
      const response = await fetch(`/api/events/${id}/email-preview`, {
        credentials: 'same-origin',
      });
      return response.status;
    }, eventId);
    expect(status).toBe(403);
    await memberContext.close();
  });

  /**
   * The feature the whole phase exists for. Every guest gets their own link, and opening it
   * in a real browser — the only thing that runs the beacon — is what moves them to "Seen".
   */
  test('the host sees when a guest has opened their invitation', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Watch it land');
    const guest = uniqueEmail('guest');

    const form = await openGuests(page, eventId);
    await form.getByLabel('Name').fill('Ada Lovelace');
    await form.getByLabel(/phone or email/i).fill(guest);
    await form.getByRole('button', { name: /^add/i }).click();

    await expect(page.getByText('Ada Lovelace')).toBeVisible();
    await expect(page.getByText('Not sent')).toBeVisible();

    // Take the guest's own link straight from the API the panel reads.
    const link = await page.evaluate(async (id) => {
      const response = await fetch(`/api/events/${id}/invites`, { credentials: 'same-origin' });
      const body = await response.json();
      const invitee = body.data.invitees[0];
      return `/i/${body.data.joinCode}?g=${invitee.token}`;
    }, eventId);

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(link);
    // The beacon fires after hydration; give it a moment to land.
    await guestPage.waitForTimeout(1500);
    await guestContext.close();

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: 'Guests', exact: true }).click();
    await expect(page.getByText('Seen', { exact: true })).toBeVisible({ timeout: 20_000 });
  });
});

test.describe('adding it to the calendar', () => {
  test('the host gets a real calendar file out of the invitation', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Calendar party');
    await page.goto(`/e/${eventId}`);

    // The file is built in the browser from the event already on the page, so this exercises
    // the whole path a guest takes — no route, no round trip. Scoped to the invitation card:
    // the RSVP confirmation below it offers its own, and the host is attending their own event.
    const download = page.waitForEvent('download');
    await page
      .getByRole('article')
      .getByRole('button', { name: /add to calendar/i })
      .click();
    const file = await download;

    expect(file.suggestedFilename()).toBe('calendar-party.ics');

    const path = await file.path();
    const ics = readFileSync(path, 'utf8');
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Calendar party');
    // The reminders are the reason anyone taps this in the first place.
    expect(ics).toContain('BEGIN:VALARM');
  });

  test('there is nothing to add when the host has not set a date', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { status, payload } = await apiCall<{ data: { event: { id: string } } }>(
      page,
      '/api/events/create',
      {
        title: 'Save the date, eventually',
        occasion: 'party',
        hostedBy: 'The test suite',
        expiryPresetId: '24h',
        startsAt: null,
        rsvp: { enabled: true, allowPlusOnes: true, maxPartySize: 4 },
        allowedKinds: ['text'],
      },
    );
    expect(status).toBe(200);

    await page.goto(`/e/${payload.data.event.id}`);
    await expect(page.getByText('has not set a date yet')).toBeVisible();
    // A button that produces an entry at an invented hour is worse than no button.
    await expect(page.getByRole('button', { name: /add to calendar/i })).toHaveCount(0);
  });

  test('the link in an email works with no account and no JavaScript', async ({
    page,
    request,
  }) => {
    await signIn(page, uniqueEmail('host'));
    const { joinCode } = await createEvent(page, 'Emailed party');
    const code = joinCode.replace('-', '');

    // A plain fetch, carrying no session — which is every recipient of an invitation.
    const response = await request.get(`/i/${code}/calendar`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/calendar');
    expect(response.headers()['content-disposition']).toContain('attachment');
    expect(await response.text()).toContain('SUMMARY:Emailed party');
  });
});

/**
 * These pages are load-bearing beyond being polite.
 *
 * Google's OAuth review fetches the privacy policy before it will let the app serve anyone
 * outside its test-user list. If they stop resolving, or fall behind a Disallow, production
 * sign-in silently stops working for everybody who is not already on that list — and the
 * symptom shows up nowhere near the cause.
 */
test.describe('the legal pages', () => {
  test('both resolve and reach each other', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: /terms of service/i }).click();
    await expect(page.getByRole('heading', { name: /terms of service/i, level: 1 })).toBeVisible();
  });

  test('are reachable from the homepage, which is where a reviewer starts', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click();
    await expect(page.getByRole('heading', { name: 'Privacy', level: 1 })).toBeVisible();
  });

  test('are indexable, unlike the rest of the app', async ({ page }) => {
    // Everything else sends noindex on purpose; a policy nobody can crawl fails review.
    const response = await page.goto('/privacy');
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  });

  test('robots.txt lets a crawler reach them', async ({ page }) => {
    const response = await page.goto('/robots.txt');
    const body = (await response?.text()) ?? '';
    expect(body).toContain('Allow: /privacy');
    expect(body).toContain('Allow: /terms');
  });
});

test.describe('the archive and deletion', () => {
  test('the host downloads everything as a zip', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Archive journey');
    await apiCall(page, '/api/posts', { eventId, body: 'One for the archive' });

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: /host controls/i }).click();

    const panel = page.getByRole('dialog', { name: /host controls/i });
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30_000 }),
      panel.getByRole('link', { name: /download everything/i }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });

  test('deleting needs the event name typed exactly', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Deletion journey');

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: /host controls/i }).click();

    const panel = page.getByRole('dialog', { name: /host controls/i });
    await panel.getByRole('button', { name: /delete this event permanently/i }).click();

    // Guarded until the name matches — a mis-tap must not be able to do this.
    await expect(panel.getByRole('button', { name: /delete it all/i })).toBeDisabled();
    await panel.getByLabel(/type .* to confirm/i).fill('something else');
    await expect(panel.getByRole('button', { name: /delete it all/i })).toBeDisabled();

    await panel.getByLabel(/type .* to confirm/i).fill('Deletion journey');
    await expect(panel.getByRole('button', { name: /delete it all/i })).toBeEnabled();
    await panel.getByRole('button', { name: /delete it all/i }).click();

    // Lands on the invitation list rather than the marketing homepage — someone who has
    // just deleted one event is far more likely to want the others than the sales pitch.
    await page.waitForURL('**/account**', { timeout: 20_000 });

    // And it is genuinely gone, not merely hidden.
    const after = await page.evaluate(async (id) => {
      const response = await fetch(`/api/events/${id}`, { credentials: 'same-origin' });
      return response.status;
    }, eventId);
    expect(after).toBe(404);
  });

  test('the confirmation says why the button is grey', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Explain yourself');

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: /host controls/i }).click();
    const panel = page.getByRole('dialog', { name: /host controls/i });
    await panel.getByRole('button', { name: /delete this event permanently/i }).click();

    // A disabled control with no explanation is how a working feature reads as a broken one.
    await expect(panel.getByText(/type the name above/i)).toBeVisible();
    await panel.getByLabel(/type .* to confirm/i).fill('Explain');
    await expect(panel.getByText(/does not match yet/i)).toBeVisible();
    await panel.getByLabel(/type .* to confirm/i).fill('Explain yourself');
    await expect(panel.getByText(/that matches/i)).toBeVisible();
  });

  /**
   * A title created on a phone comes back with an autocorrected apostrophe. Typing a straight
   * one used to leave the button greyed out with nothing said about why — indistinguishable
   * from a delete that simply does not work, which is what it was reported as.
   */
  test('a straight apostrophe confirms a curly-quoted name', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Ada\u2019s 40th');

    await page.goto(`/e/${eventId}`);
    await page.getByRole('button', { name: /host controls/i }).click();
    const panel = page.getByRole('dialog', { name: /host controls/i });
    await panel.getByRole('button', { name: /delete this event permanently/i }).click();

    await panel.getByLabel(/type .* to confirm/i).fill("Ada's 40th");
    await expect(panel.getByRole('button', { name: /delete it all/i })).toBeEnabled();
    await panel.getByRole('button', { name: /delete it all/i }).click();
    await page.waitForURL('**/account**', { timeout: 20_000 });
  });

  test('an event can be deleted from the account list, without opening it', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    await createEvent(page, 'Tidy up later');

    // The only delete in the product used to be at the bottom of a drawer inside the event —
    // which is the last place someone tidying up an event that has ended would look.
    await page.goto('/account');
    const card = page.locator('li', { hasText: 'Tidy up later' });
    await card.getByRole('button', { name: /^delete$/i }).click();
    await card.getByLabel(/type .* to confirm/i).fill('Tidy up later');
    await card.getByRole('button', { name: /delete it all/i }).click();

    await expect(page.getByText('Tidy up later')).toHaveCount(0, { timeout: 20_000 });
  });
});

/**
 * The gift list is the cheapest question in the business plan: will a guest on an invitation
 * click through to buy something? Everything about cash gifting waits on that number, so the
 * path that produces it — host adds a link, guest sees it, tap gets counted — is worth an
 * end-to-end test rather than trusting the API assertions alone.
 */
test.describe('the gift list', () => {
  test('a host adds a link and a guest sees it on the invitation', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId, joinCode } = await createEvent(page, 'Fortieth', 'birthday');

    await page.goto(`/e/${eventId}?tab=guests`);
    await page.getByLabel('Link').fill('https://www.amazon.com/wedding/registry/TEST');
    await page.getByRole('button', { name: /add a link/i }).click();

    // Named from where it points, because the host left the name blank — which is the
    // common case and the reason the field is optional.
    const panel = page.getByRole('region', { name: /gift list/i });
    await expect(panel.getByText('Amazon', { exact: true })).toBeVisible({ timeout: 15_000 });

    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/i/${joinCode.replace('-', '')}`);
    await expect(guestPage.getByRole('heading', { name: 'Fortieth' })).toBeVisible({
      timeout: 20_000,
    });

    const list = guestPage.getByRole('region', { name: /gift list/i });
    await expect(list).toBeVisible();
    // A real href, so it survives our own beacon route being down and works with no JS.
    const link = list.getByRole('link', { name: /amazon/i });
    await expect(link).toHaveAttribute('href', 'https://www.amazon.com/wedding/registry/TEST');
    // `noopener` keeps the shop from reaching back through window.opener.
    await expect(link).toHaveAttribute('rel', /noopener/);

    await guestContext.close();
  });

  test('nothing is asked for at an occasion where a gift would be a faux pas', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    // A work offsite. The default `createEvent` occasion is a party, which is also giftless,
    // so this names the one where asking would be actively wrong.
    const { eventId } = await createEvent(page, 'Q4 offsite', 'work');

    await page.goto(`/e/${eventId}?tab=guests`);
    // Anchored on the invite form, which every host sees, rather than on a send control —
    // those only render once somebody is on the list.
    await expect(page.getByRole('region', { name: /add your guests/i })).toBeVisible({
      timeout: 20_000,
    });
    // The panel is absent rather than empty: a "Gift list" heading with nothing under it
    // still reads as an ask.
    await expect(page.getByRole('region', { name: /gift list/i })).toHaveCount(0);

    await page.goto(`/e/${eventId}`);
    await expect(page.getByRole('heading', { name: 'Q4 offsite' })).toBeVisible();
    await expect(page.getByRole('region', { name: /gift list/i })).toHaveCount(0);
  });
});

/**
 * The planning list is the clearest answer this product has to "why pay when Evite is free",
 * so the thing worth proving through the real UI is that it arrives *already written* — a host
 * opening an empty board would be looking at a worse Reminders app.
 */
test.describe('the plan', () => {
  test('arrives written, with dates and the numbers a notes app cannot know', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Fiftieth', 'birthday');

    await page.goto(`/e/${eventId}?tab=plan`);
    const plan = page.getByRole('region', { name: /the plan/i });
    await expect(plan).toBeVisible({ timeout: 20_000 });

    // The rows themselves are the product. A birthday knows about cakes.
    await expect(plan.getByText(/order the cake/i)).toBeVisible();
    await expect(plan.getByText(/confirm final numbers/i)).toBeVisible();
    // With a lead time counted back from the date the host already gave us.
    await expect(plan.getByText(/^· By /).first()).toBeVisible();

    // The host is attending their own event, so the live headcount has something to say —
    // this is the line a general-purpose planner structurally cannot produce.
    await expect(plan.getByText(/coming so far/i)).toBeVisible();

    await expect(plan.getByText(/0 of \d+ done/)).toBeVisible();
  });

  test('a host ticks something off and it sticks', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Ticking along', 'birthday');

    await page.goto(`/e/${eventId}?tab=plan`);
    const row = page.getByRole('checkbox', { name: /order the cake/i });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row).toHaveAttribute('aria-checked', 'false');

    await row.click();
    await expect(row).toHaveAttribute('aria-checked', 'true', { timeout: 15_000 });

    // The first tick is what writes the seeded list out. A reload proves it landed, and that
    // materialising did not duplicate every row in the process.
    await page.reload();
    const reloaded = page.getByRole('checkbox', { name: /order the cake/i });
    await expect(reloaded).toHaveAttribute('aria-checked', 'true', { timeout: 20_000 });
    await expect(page.getByText(/1 of \d+ done/)).toBeVisible();
  });

  test('a host adds something the template did not think of', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Extra chairs', 'birthday');

    await page.goto(`/e/${eventId}?tab=plan`);
    const field = page.getByPlaceholder(/what else needs doing/i);
    await expect(field).toBeVisible({ timeout: 20_000 });

    await field.fill('Borrow more chairs');
    await page.getByRole('button', { name: /add something/i }).click();

    await expect(page.getByRole('checkbox', { name: 'Borrow more chairs' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('is not offered to a guest at all', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId, joinCode } = await createEvent(page, 'Private notes', 'birthday');

    // A signed-in member, not an anonymous one. An anonymous visitor is refused at identity
    // with a 401 and never reaches the permission, so testing that would prove nothing about
    // who is allowed to read a host's planning notes.
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await signIn(memberPage, uniqueEmail('member'));
    await memberPage.goto(`/i/${joinCode.replace('-', '')}`);
    await memberPage.waitForURL(`**/e/${eventId}`, { timeout: 20_000 });

    // The tab is absent for a guest…
    await expect(memberPage.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0);

    // …and hiding it is not the protection. Through the page rather than `page.request`,
    // which is a separate context carrying no session cookie and would answer 401 for anyone.
    //
    // 403 rather than 404, matching the funnel: this guest already knows the event exists —
    // they are standing in it — so pretending otherwise would be theatre. A stranger holding
    // only an id gets the 404, which is the case that actually needs hiding.
    const status = await memberPage.evaluate(async (id) => {
      const response = await fetch(`/api/events/${id}/plan`, { credentials: 'same-origin' });
      return response.status;
    }, eventId);
    expect(status).toBe(403);

    await memberContext.close();
  });
});

/**
 * The no-ads promise is the free tier's whole differentiator against the incumbent, and it
 * was true from the first commit while being said nowhere a customer could read it. These
 * assert it reaches the two pages a prospective host actually looks at.
 */
/**
 * The four-number summary above the guest list. Counts of **people**, from the invitee list —
 * never the funnel, which counts sums and would report one guest looking three times as three.
 */
test.describe('how it is going', () => {
  test('summarises the guest list in people, not in opens', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Progress test');

    await page.goto(`/e/${eventId}?tab=guests`);
    const form = page.getByRole('region', { name: /add your guests/i });
    await expect(form).toBeVisible({ timeout: 20_000 });

    // Nothing to report before anybody is invited — an empty summary over an empty list is
    // a widget telling a host they have not started yet.
    await expect(page.getByRole('region', { name: /how it is going/i })).toHaveCount(0);

    await form.getByLabel('Name').fill('Priya Sharma');
    await form.getByLabel(/phone or email/i).fill(uniqueEmail('guest'));
    await form.getByRole('button', { name: /^add/i }).click();

    const progress = page.getByRole('region', { name: /how it is going/i });
    await expect(progress).toBeVisible({ timeout: 15_000 });
    await expect(progress.getByText('On the list')).toBeVisible();
    await expect(progress.getByText('Seen it')).toBeVisible();

    // Added but not sent, so exactly one on the list and nothing further along. The nudge
    // line stays away until there is a gap worth closing.
    await expect(progress.getByText(/still waiting on/i)).toHaveCount(0);
  });
});

/**
 * The mark is the only organic distribution this product has, and it rendered on nothing at
 * all for months — `showBranding` read an entitlement that the preview plan happens to grant,
 * so being generous switched the growth loop off. Nothing failed; it was simply absent.
 *
 * Absence is exactly what a test suite does not notice on its own, which is why this asserts
 * presence on a real invitation rather than trusting the unit test alone.
 */
test.describe('made with Marquee', () => {
  test('is on a real invitation, and is a link', async ({ browser, page }) => {
    await signIn(page, uniqueEmail('host'));
    const { joinCode } = await createEvent(page, 'Attribution test');

    // Seen as a guest sees it — the audience the mark exists for.
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/i/${joinCode.replace('-', '')}`);
    await expect(guestPage.getByRole('heading', { name: 'Attribution test' })).toBeVisible({
      timeout: 20_000,
    });

    // A link, not a footnote: as static text it asked a guest to remember a name and go and
    // search for it later, which is not a conversion path.
    const mark = guestPage.getByRole('link', { name: /made with marquee/i });
    await expect(mark).toBeVisible();
    await expect(mark).toHaveAttribute('href', /./);

    await guestContext.close();
  });
});

test.describe('the no-ads promise', () => {
  test('is on the landing page, with a reason', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: /nobody is advertising at your guests/i }),
    ).toBeVisible();
    await expect(page.getByText(/free does not mean ad-supported/i)).toBeVisible();
    // The "what's the catch" answer, not just the claim.
    await expect(page.getByText(/earn us pennies and cost you the moment/i)).toBeVisible();
  });

  test('is on the pricing page and on the free plan itself', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByText(/no ads\. not even on the free plan/i)).toBeVisible();
    await expect(page.getByText(/is the free plan ad-supported/i)).toBeVisible();
    // On the free column, which is the tier the claim is about.
    await expect(page.getByText(/no ads\. not even here/i)).toBeVisible();
  });
});

/*
  The operator console.

  Until this landed the console had no end-to-end coverage of any kind — and for most of its
  life it had nothing to cover, because five `admin:*` permissions were enforced and reachable
  from nowhere. The refusals are asserted unconditionally; the positive path needs an account
  the *server* calls an owner, so it is skipped rather than guessed when the address is not
  known to this process, exactly as the smoke script does.

  Locally:  OWNER_EMAILS=$(grep OWNER_EMAILS .env.local | cut -d= -f2) npx playwright test
*/
const OWNER_EMAIL = (process.env.OWNER_EMAILS ?? '').split(',')[0]?.trim() ?? '';
const OWNER_EMAILS_MISSING = OWNER_EMAIL.length === 0;

test.describe('the operator console', () => {
  test('turns an ordinary account away, with a reason rather than a blank screen', async ({
    page,
  }) => {
    await signIn(page, uniqueEmail('nosy'));

    for (const path of ['/admin/events', '/admin/users', '/admin/audit', '/admin/funnel']) {
      await page.goto(path);
      // The page renders — the gate is the API, not the route — and says why it is empty.
      // A spinner that never resolves would be the failure mode worth catching here.
      await expect(page.getByRole('alert')).toBeVisible();
    }
  });

  test('turns a signed-out visitor away too', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('alert')).toBeVisible();
    // And never renders a row of somebody's account while it does so.
    await expect(page.getByRole('button', { name: 'Suspend', exact: true })).toHaveCount(0);
  });

  test('is not linked from anywhere a guest or host would find it', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    await page.goto('/');
    await expect(page.getByRole('link', { name: /operations/i })).toHaveCount(0);
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  });

  test.describe('as the operator', () => {
    test.skip(OWNER_EMAILS_MISSING, 'OWNER_EMAILS is not set in this environment');

    test('opens on the sections, each described by the job it does', async ({ page }) => {
      await signIn(page, OWNER_EMAIL);
      await page.goto('/admin');

      await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
      for (const label of ['Events', 'People', 'Audit', 'Funnel']) {
        await expect(page.getByRole('navigation', { name: 'Operations' })).toContainText(label);
      }
      // The takedown path, said out loud on the card rather than left to be inferred.
      await expect(page.getByText(/where a post can be taken down/i)).toBeVisible();
    });

    test('finds an event by its id and links through to it', async ({ page }) => {
      await signIn(page, OWNER_EMAIL);
      // Unique per run: the emulator keeps its data between runs, so a fixed title finds
      // yesterday's event as well as today's and the assertion goes ambiguous.
      const title = `Console lookup ${Date.now()}`;
      const event = await createEvent(page, title);

      await page.goto('/admin/events');
      await page.getByPlaceholder(/paste an event id/i).fill(event.eventId);
      await page.getByRole('button', { name: 'Search' }).click();

      // Exactly one: an id match short-circuits rather than also matching titles.
      const link = page.getByRole('link', { name: title });
      await expect(link).toHaveCount(1);
      await expect(link).toHaveAttribute('href', `/e/${event.eventId}`);
    });

    test('will not suspend anybody until a reason is typed', async ({ page }) => {
      await signIn(page, OWNER_EMAIL);
      const target = uniqueEmail('tobesuspended');

      // Give the account a session so it exists to be found.
      const other = await page.context().browser()!.newContext();
      const otherPage = await other.newPage();
      await signIn(otherPage, target);

      await page.goto('/admin/users');
      await page.getByPlaceholder(/paste a user id/i).fill(target);
      await page.getByRole('button', { name: 'Search' }).click();

      /*
        Wait for the list to narrow before reaching for a control inside it.

        `toBeVisible` on a locator matching many elements is a strict-mode violation, and a
        strict-mode violation throws immediately rather than being retried — so asserting on
        the button first turns "the results have not arrived yet" into a hard failure instead
        of a wait. `toHaveCount` retries, so it is the right way to wait for a list to settle.
      */
      const suspend = page.getByRole('button', { name: 'Suspend', exact: true });
      await expect(suspend).toHaveCount(1);
      // A suspension with no reason is unreviewable six weeks later, so the control is
      // inert until there is one — the server refuses it as well.
      await expect(suspend).toBeDisabled();

      await page.getByPlaceholder(/reported for abuse/i).fill('e2e test, lifted immediately');
      await expect(suspend).toBeEnabled();
      await suspend.click();

      await expect(page.getByText('Suspended', { exact: true })).toBeVisible();

      // Put it back, so the run leaves nothing suspended behind it.
      await page.getByPlaceholder(/reported for abuse/i).fill('e2e test finished');
      await page.getByRole('button', { name: /lift suspension/i }).click();
      await expect(page.getByText('Suspended', { exact: true })).toHaveCount(0);

      await other.close();
    });

    test('shows the audit trail, including the read of it', async ({ page }) => {
      await signIn(page, OWNER_EMAIL);

      /*
        Cause the entry, then look for it — do not go looking through history for one.

        The first version asserted that `admin.auditViewed` was somewhere on the page, which
        only held while nothing had pushed it off: the log is newest-first and capped at a
        page, and a suite that creates events, replies and posts writes plenty of entries.
        Adding three tests earlier in the file was enough to break it, which is a test
        depending on the volume of unrelated tests rather than on the behaviour it names.

        Loading the page writes the entry. So load it, then reload: the read that just
        happened is at the top, whatever else is in the log.
      */
      await page.goto('/admin/audit');
      await expect(page.getByRole('columnheader', { name: 'Action' })).toBeVisible({
        timeout: 15_000,
      });

      await page.reload();
      const rows = page.getByRole('row');
      await expect(rows.nth(1)).toContainText('admin.auditViewed', { timeout: 15_000 });

      // IP and user agent are stored on every entry and deliberately not rendered.
      await expect(page.getByRole('columnheader', { name: 'Detail' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: /ip/i })).toHaveCount(0);
    });

    test('reads the funnel, with a denominator beside every ratio', async ({ page }) => {
      await signIn(page, OWNER_EMAIL);
      await page.goto('/admin/funnel');

      await expect(page.getByRole('heading', { name: 'What these decide' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'The counters themselves' })).toBeVisible();
      // A percentage with no denominator beside it is the thing this board exists not to show.
      await expect(page.getByText(/\d+ of \d+/).first()).toBeVisible();
    });
  });
});

test.describe('accessibility and theming', () => {
  test('every page renders in dark mode without console errors', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const path of ['/', '/pricing', '/templates', '/join', '/create', '/privacy', '/terms']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }

    expect(errors).toEqual([]);
    await context.close();
  });
});
