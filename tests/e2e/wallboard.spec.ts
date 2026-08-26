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

test.describe('landing and navigation', () => {
  test('the landing page offers both ways in', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /start an event/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /join with a code/i })).toBeVisible();
  });

  test('hosting requires an account', async ({ page }) => {
    await page.goto('/create');
    await expect(page.getByRole('heading', { name: /sign in to host/i })).toBeVisible();
  });
});

test.describe('creating an event', () => {
  test('a signed-in host creates a wall and is shown the code once', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    await page.goto('/create');

    await page.getByLabel('What is it?').fill('Rooftop dinner');
    await page.getByRole('button', { name: '6 hours' }).click();
    await page.getByRole('button', { name: /create the wall/i }).click();

    await expect(page.getByRole('heading', { name: /your wall is live/i })).toBeVisible();

    const code = await page.locator('.code-display').first().innerText();
    expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);

    await page.getByRole('button', { name: /open the wall/i }).click();
    await expect(page.getByRole('heading', { name: 'Rooftop dinner' })).toBeVisible();
  });

  test('the form refuses an event with no name', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    await page.goto('/create');
    await expect(page.getByRole('button', { name: /create the wall/i })).toBeDisabled();
  });
});

test.describe('joining', () => {
  test('a wrong code is refused with an explanation', async ({ page }) => {
    await signInAsGuest(page);
    await page.goto('/join');

    await page.getByLabel('Event code').fill('ZZZZZZZZ');
    await page.getByRole('button', { name: /open the wall/i }).click();

    await expect(page.locator('#join-error')).toContainText(/did not work/i);
  });

  test('the code field formats as you type and gates the button', async ({ page }) => {
    await signInAsGuest(page);
    await page.goto('/join');

    const field = page.getByLabel('Event code');
    await field.fill('abcd234');
    await expect(page.getByRole('button', { name: /open the wall/i })).toBeDisabled();

    await field.fill('abcd2345');
    await expect(field).toHaveValue('ABCD-2345');
    await expect(page.getByRole('button', { name: /open the wall/i })).toBeEnabled();
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
    await guestPage.getByRole('button', { name: /open the wall/i }).click();

    await expect(guestPage.getByRole('heading', { name: 'Guest arrival test' })).toBeVisible();
    // Watching is allowed; posting is where the account is required.
    await expect(guestPage.getByRole('heading', { name: /join in/i })).toBeVisible();
    await expect(guestPage.getByPlaceholder('Say something…')).toHaveCount(0);

    await guestContext.close();
  });
});

test.describe('the wall', () => {
  test('a member posts and it appears without a reload', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Live update test');

    await page.goto(`/e/${eventId}`);
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
    await expect(page.getByText(/this wall is closed/i)).toBeVisible();
    await expect(page.getByPlaceholder('Say something…')).toHaveCount(0);
  });

  test('a non-member is turned away', async ({ page }) => {
    await signIn(page, uniqueEmail('host'));
    const { eventId } = await createEvent(page, 'Private event');

    const outsiderPage = await (await page.context().browser()!.newContext()).newPage();
    await signIn(outsiderPage, uniqueEmail('outsider'));
    await outsiderPage.goto(`/e/${eventId}`);

    await expect(outsiderPage.getByText(/could not open that wall/i)).toBeVisible();
    await outsiderPage.context().close();
  });
});

test.describe('accessibility and theming', () => {
  test('every page renders in dark mode without console errors', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const path of ['/', '/join', '/create']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }

    expect(errors).toEqual([]);
    await context.close();
  });
});
