function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Mangler miljøvariabel: ${name}`);
    return value;
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

module.exports = {
    signInWithInternalEmail,
    adminFetchProfileByUsername,
    readJsonBody
};
