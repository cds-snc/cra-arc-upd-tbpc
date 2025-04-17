import { readFile } from 'node:fs/promises';
import type { AuthParams } from './adobe-analytics.types';

const getAACredsString = async (): Promise<string> =>
  process.env.AA_CREDS_POOL ||
  (await readFile(
    process.env.AA_KEY_POOL_PATH || 'keys/aa_creds_pool.json',
    'utf8',
  ));

export const getAACredsPool = (): Promise<AuthParams[]> =>
  getAACredsString().then(JSON.parse);
