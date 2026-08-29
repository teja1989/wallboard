import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { freeTemplates, planOrder, plans, templates } from '@/config';

/**
 * A pricing page is a promise, so a bullet on it is a claim that has to be true.
 *
 * Two were not. "Readable links, /e/priya-and-sam" sat on the Pro plan describing a feature
 * with **zero call sites anywhere in the app** — worse than a missing feature, because a
 * missing feature is not being sold. And both template counts were wrong: free said four
 * where there are five, and the paid tier said "all ten" where there are fifteen.
 *
 * The counts are now derived rather than restated, which is the codebase's own rule about
 * config being the single source of a number. These assertions cover the part deriving cannot:
 * that a bullet does not describe something nothing implements.
 */

/** Every `.ts`/`.tsx` under `src/`, excluding the config that merely declares the entitlement. */
function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      sourceFiles(path, found);
    } else if (/\.tsx?$/.test(entry)) {
      found.push(path);
    }
  }
  return found;
}

function isReadAnywhere(entitlement: string): boolean {
  const declaredIn = join('src', 'config', 'plans.config.ts');
  return sourceFiles(join(process.cwd(), 'src')).some((path) => {
    if (path.endsWith(declaredIn)) return false;
    return readFileSync(path, 'utf8').includes(entitlement);
  });
}

describe('what the plans claim', () => {
  it('states the real number of free themes', () => {
    const claim = plans.free.highlights.find((line) => /invitation themes/i.test(line));
    expect(claim).toBe(`${freeTemplates.length} invitation themes`);
  });

  it('states the real total on a paid plan', () => {
    const claim = plans.event.highlights.find((line) => /invitation themes/i.test(line));
    // "All ten" was wrong twice over: ten is the *premium* count, and the buyer gets every one.
    expect(claim).toBe(`All ${templates.length} invitation themes`);
    expect(templates.length).toBeGreaterThan(freeTemplates.length);
  });

  it('does not sell a readable link while nothing implements one', () => {
    /*
      The guard that would have caught the original bug, and that releases itself the day
      somebody builds the feature: if `vanityLink` gains a reader anywhere in `src/`, a plan
      is free to advertise it again.
    */
    if (isReadAnywhere('vanityLink')) return;

    for (const planId of planOrder) {
      for (const line of plans[planId].highlights) {
        expect(/readable link|vanity|\/e\/priya/i.test(line), `${planId}: "${line}"`).toBe(false);
      }
    }
  });

  it('keeps every entitlement it charges for wired to something', () => {
    /*
      The general form. An entitlement nobody reads is either dead config or an unkept
      promise, and both are worth knowing about — `vanityLink` is the known exception and is
      named here so a *second* one cannot slip in behind it.
    */
    const unimplemented = Object.keys(plans.free.entitlements).filter(
      (entitlement) => !isReadAnywhere(entitlement),
    );
    expect(unimplemented).toEqual(['vanityLink']);
  });
});
