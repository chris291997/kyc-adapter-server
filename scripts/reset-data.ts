/**
 * Operational data-reset script. NOT a migration — must be invoked explicitly.
 * Usage:
 *   npm run reset:data -- --mode=full     # everything except super_admin users
 *   npm run reset:data -- --mode=verifications  # verifications + accounts only
 *
 * Refuses to run when NODE_ENV=production unless ALLOW_PROD_DATA_RESET=true is set.
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import dataSourceOptions from '../src/database/data-source';

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? 'true'];
    }),
  );
  const mode = args.mode ?? 'verifications';

  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_DATA_RESET !== 'true') {
    console.error('Refusing to run in production without ALLOW_PROD_DATA_RESET=true');
    process.exit(1);
  }

  const ds = new DataSource(dataSourceOptions as any);
  await ds.initialize();

  await ds.query('SET session_replication_role = replica;');
  try {
    if (mode === 'full') {
      console.log('Mode: full — wiping all tenant data, keeping super_admin users');
      await ds.query("DELETE FROM webhook_logs;");
      await ds.query("DELETE FROM verification_documents;");
      await ds.query("DELETE FROM verifications;");
      await ds.query("DELETE FROM accounts;");
      await ds.query("DELETE FROM api_keys;");
      await ds.query("DELETE FROM tenant_provider_configs;");
      await ds.query("DELETE FROM refresh_tokens;");
      await ds.query("DELETE FROM users WHERE user_type != 'super_admin';");
      await ds.query("DELETE FROM tenants;");
      await ds.query("DELETE FROM providers;");
    } else if (mode === 'verifications') {
      console.log('Mode: verifications — wiping verifications + accounts, keeping configuration');
      await ds.query("DELETE FROM webhook_logs WHERE verification_id IS NOT NULL;");
      await ds.query("DELETE FROM verification_documents;");
      await ds.query("DELETE FROM verifications;");
      await ds.query("DELETE FROM accounts;");
    } else {
      throw new Error(`Unknown mode: ${mode}. Use --mode=full or --mode=verifications`);
    }
  } finally {
    await ds.query('SET session_replication_role = DEFAULT;');
    await ds.destroy();
  }
  console.log('Reset complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
