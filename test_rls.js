require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function run() {
  const connectionString = process.env.NEXT_PUBLIC_SUPABASE_URL.replace('https://', 'postgresql://postgres:').replace('.supabase.co', ':6543/postgres');
  // Wait, I don't have the database password. 
  // Maybe I can just use supabase-js to query a view if I make one via a migration.
}
run();
