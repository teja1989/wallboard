/**
 * Stamps every existing event with the plan it has actually been running on.
 *
 * Entitlements used to be resolved at read time: while `features.billing` was off,
 * `effectivePlanId()` returned the preview plan for every event regardless of what was stored
 * on it. So every event in the database is stamped with its host's account plan — `free` for
 * almost everyone — while behaving as `pro`.
 *
 * That override is gone. An event now runs on the plan written on it, which is the only way
 * a promo or a paid upgrade can mean anything durable. But it leaves the events created before
 * the change holding a `free` stamp and a pro-shaped wall: the moment billing is switched on
 * they would drop to 25 guests and seven days and lose their archive, mid-event.
 *
 * This closes that gap. It is a one-time migration, and it must run **before**
 * `features.billing` is turned on.
 *
 *   node scripts/backfill-event-plans.mjs                  # against the emulators, dry run
 *   APPLY=1 node scripts/backfill-event-plans.mjs          # against the emulators, for real
 *   APPLY=1 PROJECT=quantum-pulsar node scripts/backfill-event-plans.mjs   # production
 *
 * Dry by default, because a script that writes to production on a bare invocation is a script
 * that eventually does so by accident.
 *
 * **Idempotent, and it never takes anything away.** An event is only ever moved *up* to the
 * plan it was already enjoying — a host who genuinely bought Pro keeps Pro, and running this
 * twice changes nothing the second time.
 */

import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const APPLY = process.env.APPLY === '1';
const PROJECT = process.env.PROJECT ?? 'marquee-dev';
const BATCH = 400;

/** Weakest to strongest, matching PLAN_IDS in src/config/plans.config.ts. */
const RANK = { free: 0, event: 1, pro: 2 };
/** previewPlanId — what every event has actually been running on while billing was off. */
const PREVIEW_PLAN = 'pro';

function usingEmulator() {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}

function start() {
  if (PROJECT === 'marquee-dev') {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  }
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  initializeApp({
    projectId: PROJECT,
    ...(serviceAccount ? { credential: cert(JSON.parse(serviceAccount)) } : {}),
  });
  return getFirestore();
}

async function main() {
  const db = start();

  console.log(`\nBackfilling event plans`);
  console.log(`  project : ${PROJECT}${usingEmulator() ? ' (emulator)' : ''}`);
  console.log(`  target  : ${PREVIEW_PLAN}`);
  console.log(`  mode    : ${APPLY ? 'APPLY — this writes' : 'dry run'}\n`);

  if (APPLY && !usingEmulator()) {
    console.log('⚠  This writes to production Firestore. Ctrl-C within five seconds to stop.');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const snapshot = await db.collection('events').get();
  let raised = 0;
  let alreadyFine = 0;
  let batch = db.batch();
  let pending = 0;

  for (const doc of snapshot.docs) {
    const current = doc.get('plan');
    const currentRank = RANK[current] ?? 0;

    // Only ever upward. Someone who bought Pro must not be pushed down to the preview plan,
    // and re-running must be a no-op.
    if (currentRank >= RANK[PREVIEW_PLAN]) {
      alreadyFine += 1;
      continue;
    }

    console.log(
      `  ${doc.id}  ${current ?? '(unset)'} -> ${PREVIEW_PLAN}  ${doc.get('title') ?? ''}`,
    );
    raised += 1;

    if (APPLY) {
      batch.update(doc.ref, { plan: PREVIEW_PLAN });
      pending += 1;
      if (pending >= BATCH) {
        await batch.commit();
        batch = db.batch();
        pending = 0;
      }
    }
  }

  if (APPLY && pending > 0) await batch.commit();

  console.log(`\n  ${raised} raised, ${alreadyFine} already at or above ${PREVIEW_PLAN}`);
  if (!APPLY && raised > 0) console.log('  Nothing was written. Re-run with APPLY=1.\n');
  else console.log('');
}

main().catch((error) => {
  console.error('\nBackfill failed:', error);
  process.exit(1);
});
