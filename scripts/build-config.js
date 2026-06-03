const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Mangler SUPABASE_URL og SUPABASE_ANON_KEY (Vercel Environment Variables).');
  process.exit(1);
}

const out = `window.FAXCHAT_CONFIG = {
  url: ${JSON.stringify(url)},
  anonKey: ${JSON.stringify(anonKey)}
};
`;

fs.writeFileSync(path.join(__dirname, '..', 'config.js'), out);
console.log('config.js generert.');
