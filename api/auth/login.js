const { parseFaxUsername } = require('../lib/fax-utils');
const { signInWithInternalEmail, adminFetchProfileByUsername, readJsonBody } = require('../lib/supabase-server');

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

        const profile = await adminFetchProfileByUsername(parsed.username);
        if (!profile) {
            res.status(401).json({ error: 'Feil brukernavn eller passord' });
            return;
        }

        const session = await signInWithInternalEmail(profile.auth_email, body.password);

        res.status(200).json({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            profile: {
                id: profile.id,
                name: profile.name,
                station_id: profile.station_id,
                fax_label: profile.fax_label,
                description: profile.description
            }
        });
    } catch (e) {
        const status = e.message.includes('passord') ? 401 : 500;
        res.status(status).json({ error: e.message || 'Innlogging feilet' });
    }
};
