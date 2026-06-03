function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Mangler miljøvariabel: ${name}`);
    return value;
}

async function adminCreateUser(authEmail, password) {
    const url = requireEnv('SUPABASE_URL');
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const res = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email: authEmail,
            password,
            email_confirm: true
        })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.msg || data.message || data.error_description || 'Kunne ikke opprette bruker');
    }
    return data;
}

async function signInWithInternalEmail(authEmail, password) {
    const url = requireEnv('SUPABASE_URL');
    const anonKey = requireEnv('SUPABASE_ANON_KEY');

    const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
            apikey: anonKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: authEmail, password })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error_description || data.msg || 'Feil brukernavn eller passord');
    }
    return data;
}

async function adminFetchProfileByUsername(username) {
    const url = requireEnv('SUPABASE_URL');
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const res = await fetch(
        `${url}/rest/v1/profiles?username=eq.${encodeURIComponent(username)}&select=id,username,auth_email,name,station_id,fax_label,description`,
        {
            headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`
            }
        }
    );

    const rows = await res.json();
    if (!res.ok) throw new Error(rows.message || 'Databasefeil');
    return rows[0] || null;
}

async function adminInsertProfile(row) {
    const url = requireEnv('SUPABASE_URL');
    const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

    const res = await fetch(`${url}/rest/v1/profiles`, {
        method: 'POST',
        headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
        },
        body: JSON.stringify(row)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Kunne ikke lagre profil');
    return Array.isArray(data) ? data[0] : data;
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch {
                reject(new Error('Ugyldig JSON'));
            }
        });
        req.on('error', reject);
    });
}

function checkAdminSecret(req) {
    const expected = requireEnv('ADMIN_SECRET');
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : (req.headers['x-admin-secret'] || '');
    if (token !== expected) {
        const err = new Error('Ugyldig admin-nøkkel');
        err.status = 401;
        throw err;
    }
}

module.exports = {
    adminCreateUser,
    signInWithInternalEmail,
    adminFetchProfileByUsername,
    adminInsertProfile,
    readJsonBody,
    checkAdminSecret
};
