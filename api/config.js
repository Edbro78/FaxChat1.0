module.exports = (req, res) => {
    const url = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
        res.status(500).json({
            error: 'SUPABASE_URL og SUPABASE_ANON_KEY må settes under Vercel → Settings → Environment Variables'
        });
        return;
    }

    res.setHeader('Cache-Control', 's-maxage=300');
    res.status(200).json({ url, anonKey });
};
