module.exports = (req, res) => {
    const defaults = require('../lib/supabase-defaults');
    const url = process.env.SUPABASE_URL || defaults.url;
    const anonKey = process.env.SUPABASE_ANON_KEY || defaults.publishableKey;

    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json({ url, anonKey });
};
