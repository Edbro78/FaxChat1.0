const crypto = require('crypto');
const { parseFaxUsername } = require('../../lib/fax-utils');
const {
    checkAdminSecret,
    readJsonBody,
    adminCreateUser,
    adminFetchProfileByUsername,
    adminInsertProfile
} = require('../../lib/supabase-server');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        checkAdminSecret(req);
        const body = await readJsonBody(req);
        const parsed = parseFaxUsername(body.username || '');

        if (!parsed) {
            res.status(400).json({ error: 'Brukernavn må være Kortnavn + 2 siffer, f.eks. Edvard01' });
            return;
        }

        if (!body.password || body.password.length < 3) {
            res.status(400).json({ error: 'Passord må være minst 3 tegn' });
            return;
        }

        const existing = await adminFetchProfileByUsername(parsed.username);
        if (existing) {
            res.status(409).json({ error: `Brukernavn ${parsed.username} finnes allerede` });
            return;
        }

        const authEmail = `${crypto.randomUUID()}@fax.internal`;
        const authUser = await adminCreateUser(authEmail, body.password);

        const profile = await adminInsertProfile({
            id: authUser.id,
            username: parsed.username,
            auth_email: authEmail,
            name: parsed.name,
            station_id: parsed.stationId,
            fax_label: parsed.faxLabel,
            description: body.description || ''
        });

        res.status(201).json({
            ok: true,
            username: profile.username,
            name: profile.name,
            station_id: profile.station_id,
            fax_label: profile.fax_label
        });
    } catch (e) {
        res.status(e.status || 500).json({ error: e.message || 'Kunne ikke opprette bruker' });
    }
};
