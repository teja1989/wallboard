import { config } from 'dotenv';

/**
 * Loads .env.local the way Next does, so CLI scripts see the same configuration the app
 * does. Imported for its side effect, before anything that reads config.
 */
config({ path: '.env.local', quiet: true });
config({ path: '.env', quiet: true });
