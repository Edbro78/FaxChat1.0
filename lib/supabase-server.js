function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`Mangler miljøvariabel: ${name}`);
    return value;
}

async function verifyLogin(username, password) {
    const url = requireEnv('SUPABASE_URL');
    const anonKey = requireEnv('SUPABASE_ANON_KEY');

    const res = await fetch(`${url}/rest/v1/rpc/verify_faxchat_login`, {
        method: 'POST',
        headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            p_username: username,
            p_password: password
        })
    });

    const rows = await res.json();
    if (!res.ok) throw new Error(rows.message || 'Databasefeil ved innlogging');
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

module.exports = { verifyLogin, readJsonBody };
