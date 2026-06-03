const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('');
  console.error('BUILD FEILET: Supabase-miljøvariabler mangler.');
  console.error('');
  console.error('I Vercel: Project → Settings → Environment Variables');
  console.error('  SUPABASE_URL      = https://xxxx.supabase.co  (Supabase → Settings → API → Project URL)');
  console.error('  SUPABASE_ANON_KEY = eyJ...                     (Supabase → Settings → API → anon public)');
  console.error('');
  console.error('Huk av Production (og Preview), lagre, deretter Redeploy.');
  console.error('');
  process.exit(1);
}

const out = `window.FAXCHAT_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)}
};
`;

fs.writeFileSync(path.join(__dirname, '..', 'config.js'), out);
console.log('config.js generert.');
