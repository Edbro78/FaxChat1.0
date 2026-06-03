const { parseFaxUsername } = require('../../lib/fax-utils');
const { verifyLogin, readJsonBody } = require('../../lib/supabase-server');
const { signSupabaseJwt } = require('../../lib/jwt');
const defaults = require('../../lib/supabase-defaults');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const body = await readJsonBody(req);
        const parsed = parseFaxUsername(body.username || '');
        if (!parsed) {
            res.status(400).json({ error: 'Brukernavn må være Kortnavn + 2 siffer, f.eks. Edvard01' });
            return;
        }

        if (!body.password) {
            res.status(400).json({ error: 'Passord mangler' });
            return;
        }

        const profile = await verifyLogin(parsed.username, body.password);
        if (!profile) {
            res.status(401).json({ error: 'Feil brukernavn eller passord' });
            return;
        }

        const jwtSecret = process.env.SUPABASE_JWT_SECRET;
        if (!jwtSecret) {
            res.status(500).json({
                error: 'SUPABASE_JWT_SECRET mangler i Vercel (Supabase → Settings → API → JWT Secret)'
            });
            return;
        }

        const accessToken = signSupabaseJwt(profile.id, jwtSecret);

        res.status(200).json({
            access_token: accessToken,
            refresh_token: accessToken,
            profile: {
                id: profile.id,
                name: profile.name,
                station_id: profile.station_id,
                fax_label: profile.fax_label,
                description: profile.description
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Innlogging feilet' });
    }
};
