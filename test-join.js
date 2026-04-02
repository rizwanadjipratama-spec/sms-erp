const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  console.log("Testing join directly...");
  const { data: d1, error: e1 } = await supabase.from('request_status_logs').select('*, actor:profiles(*)').limit(1);
  console.log("Using actor:profiles(*):", JSON.stringify({ d1, e1 }, null, 2));
}
run();
