import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import semver from 'semver';

/**
 * The installed tree must not contradict itself.
 *
 * This exists because of a specific, expensive outage. `package.json` carried an `overrides`
 * block — added in the first commit, almost certainly to quiet `npm audit` — that forced
 * `gaxios` to v7. Every package in the Cloud Storage auth chain declares `gaxios: ^6`.
 *
 * The two majors differ in one detail that matters: in v6 a response's `headers` is a plain
 * object, and in v7 it is a WHATWG `Headers` instance. `gcp-metadata@6` reads
 * `res.headers['metadata-flavor']`, which on a `Headers` instance is `undefined` rather than
 * `'Google'` — so every attempt to fetch credentials from the metadata server failed with
 * "incorrect Metadata-Flavor header ... got no header".
 *
 * The blast radius was everything backed by Cloud Storage: photo and video upload, the wall's
 * signed image URLs, the archive download, and deleting an event. It was invisible locally,
 * because the emulator driver needs no credentials at all, and invisible in CI for the same
 * reason. It surfaced only as a 500 in production.
 *
 * npm will never warn about this. An override is an explicit instruction, so npm marks the
 * result "overridden" rather than "invalid" and prints nothing — `npm ls` looked clean the
 * whole time. That is what this test is for.
 */

interface LockPackage {
  version?: string;
  dependencies?: Record<string, string>;
  /** Platform-specific packages npm skips entirely when they do not apply. */
  optional?: boolean;
  /** Vendored inside its parent, so it never resolves through `node_modules` at all. */
  inBundle?: boolean;
}

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')) as {
  packages: Record<string, LockPackage>;
};

/**
 * Which copy of `name` a package at `fromPath` actually loads.
 *
 * Node walks up the directory tree looking for `node_modules/<name>`, and npm's nesting
 * relies on exactly that, so resolution has to be modelled rather than assumed — the answer
 * for a nested copy is frequently not the one at the root.
 */
function resolveFrom(fromPath: string, name: string): LockPackage | null {
  let directory = fromPath;
  for (;;) {
    const candidate = `${directory ? `${directory}/` : ''}node_modules/${name}`;
    const found = lock.packages[candidate];
    if (found) return found;
    if (!directory) return null;
    const cut = directory.lastIndexOf('/node_modules/');
    directory = cut === -1 ? '' : directory.slice(0, cut);
  }
}

function violations(): string[] {
  const found: string[] = [];

  for (const [path, meta] of Object.entries(lock.packages)) {
    // Optional and bundled packages are excluded, not overlooked. An optional package is one
    // npm declines to install on this platform — the WASM builds of native tooling are the
    // usual case — so nothing can load it or its dependencies. A bundled one ships its
    // dependencies inside itself and never resolves them through `node_modules`.
    if (meta.optional || meta.inBundle) continue;

    for (const [name, range] of Object.entries(meta.dependencies ?? {})) {
      // Ranges npm resolves by other means — git URLs, tarballs, aliases, workspaces.
      if (!semver.validRange(range)) continue;

      const resolved = resolveFrom(path, name);
      if (!resolved?.version) continue;

      if (!semver.satisfies(resolved.version, range)) {
        found.push(
          `${path || '(root)'} declares ${name}@${range} but resolves ${resolved.version}`,
        );
      }
    }
  }

  return found;
}

describe('the dependency tree', () => {
  it('gives every package a version of each dependency that it asked for', () => {
    // Listed in full rather than counted: when this fails, the names are the whole diagnosis,
    // and the fix is almost always deleting an `overrides` entry someone added to quiet an
    // audit warning without checking what else declared that package.
    expect(violations()).toEqual([]);
  });

  /**
   * Named on its own because it is the one that took production down, and because an audit
   * warning on `uuid` is a standing invitation to re-add the override that caused it.
   *
   * The advisory those overrides silenced is a bounds check in `uuid`'s v3/v5/v6 when a `buf`
   * argument is supplied. Nothing here calls uuid — this codebase uses `node:crypto` — so it
   * was never reachable. It was traded for every stored byte becoming unreachable instead.
   */
  it('keeps the Cloud Storage auth chain on one major of gaxios', () => {
    const chain = Object.entries(lock.packages).filter(
      ([path, meta]) => meta.dependencies?.gaxios !== undefined && !path.includes('firebase-tools'),
    );
    expect(chain.length).toBeGreaterThan(0);

    for (const [path, meta] of chain) {
      const range = meta.dependencies?.gaxios as string;
      const resolved = resolveFrom(path, 'gaxios');
      if (!resolved?.version || !semver.validRange(range)) continue;
      expect(
        semver.satisfies(resolved.version, range),
        `${path} declares gaxios@${range} but resolves ${resolved.version}`,
      ).toBe(true);
    }
  });
});
