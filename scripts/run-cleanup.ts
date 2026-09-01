import './_bootstrap';

/**
 * Runs the expiry sweep locally. In production this is Cloud Scheduler calling
 * POST /api/internal/cleanup; here it calls the same service function directly.
 *
 *   npm run cleanup
 */
async function main(): Promise<void> {
  const { runCleanup } = await import('../src/lib/services/cleanup');
  const summary = await runCleanup();

  console.log('Cleanup finished');
  console.log(`  events swept:            ${summary.eventsSwept}`);
  console.log(`  objects deleted:         ${summary.objectsDeleted}`);
  console.log(`  pending uploads cleared: ${summary.pendingUploadsCleared}`);
  console.log(`  took:                    ${summary.finishedAt - summary.startedAt}ms`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
