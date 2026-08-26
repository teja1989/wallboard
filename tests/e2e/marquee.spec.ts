import { expect, test } from '@playwright/test';
import {
  apiCall,
  createEvent,
  resetRateLimits,
  signIn,
  signInAsGuest,
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
    await expect(page.getByRole('heading', { level: 2, name: 'Free', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'One event' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Pro', exact: true })).toBeVisible();
    // Billing is off by default, so the page must say so rather than implying we charge.
    await expect(page.getByText(/free while we are in preview/i)).toBeVisible();
  });

  test('hosting requires an account', async ({ page }) => {
    await page.goto('/create');
    await expect(page.getByRole('heading', { name: /sign in to host/i })).toBeVisible();
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
    await page.getByRole('button', { name: /send the invitation/i }).click();

    await expect(page.getByRole('heading', { name: /your invitation is ready/i })).toBeVisible();

    const code = await page.locator('.code-display').first().innerText();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    await page.getByRole('button', { name: /open the invitation/i }).click();
    await expect(page.getByRole('heading', { name: 'Rooftop dinner' })).toBeVisible();
    await expect(page.getByText('From Priya & Sam')).toBeVisible();
    await expect(page.getByText('The Rooftop')).toBeVisible();
  });

  test('the form refuses an invitation with no name', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    await page.goto('/create');
    await expect(page.getByRole('button', { name: /send the invitation/i })).toBeDisabled();
  });

  test('every theme is offered while billing is in preview', async ({ page }) => {
    // Billing is off, so nothing is gated — and the page says exactly that rather than
    // dangling a paywall the visitor will never actually meet.
    await signIn(page, uniqueEmail('host'));
    await page.goto('/create');
    await expect(page.getByRole('button', { name: 'Midnight' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Sunset' })).toBeEnabled();
    await expect(page.getByText(/every theme is available while we are in preview/i)).toBeVisible();
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
    await page.getByRole('button', { name: 'Wall' }).click();
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
    await page.getByRole('button', { name: 'Wall' }).click();
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
    await page.getByRole('button', { name: 'Wall' }).click();
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
    await page.getByRole('button', { name: 'Wall' }).click();
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

    await expect(guestPage.getByText(/you are on the list/i)).toBeVisible();

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
    await expect(guestPage.getByText(/thanks for letting us know/i)).toBeVisible();
    // No party size prompt appears for someone who is not coming.
    await expect(guestPage.getByText(/how many of you/i)).toHaveCount(0);

    await guestContext.close();
  });

  test('a guest can change their answer', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Changing minds');

    await page.goto(`/e/${eventId}`);
    await page.getByRole('radio', { name: /maybe/i }).click();
    await expect(page.getByText(/thanks for letting us know/i)).toBeVisible();

    await page.reload();
    await expect(page.getByText('Maybe').first()).toBeVisible();
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

test.describe('accessibility and theming', () => {
  test('every page renders in dark mode without console errors', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const path of ['/', '/pricing', '/join', '/create']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }

    expect(errors).toEqual([]);
    await context.close();
  });
});
