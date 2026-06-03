let supabaseClient = null;
let currentProfile = null;
let configLoaded = false;

const FAX_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*\d{2}$/;

function parseFaxUsername(input) {
    const raw = input.trim();
    if (!FAX_USERNAME_PATTERN.test(raw)) return null;
    const match = raw.match(/^([A-Za-z][A-Za-z0-9]*)(\d{2})$/);
    const nameRaw = match[1];
    const stationId = match[2];
    const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1).toLowerCase();
    const username = name + stationId;
    return { name, stationId, username, faxLabel: username };
}

async function loadFaxchatConfig() {
    if (configLoaded && window.FAXCHAT_CONFIG?.url && window.FAXCHAT_CONFIG?.anonKey) {
        return true;
    }

    if (window.FAXCHAT_CONFIG?.url && window.FAXCHAT_CONFIG?.anonKey) {
        configLoaded = true;
        return true;
    }

    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (res.ok && data.url && data.anonKey) {
            window.FAXCHAT_CONFIG = { url: data.url, anonKey: data.anonKey };
            configLoaded = true;
            return true;
        }
    } catch (_) {}

    configLoaded = false;
    return false;
}

function getSupabase() {
    if (!supabaseClient && window.FAXCHAT_CONFIG?.url) {
        supabaseClient = window.supabase.createClient(
            window.FAXCHAT_CONFIG.url,
            window.FAXCHAT_CONFIG.anonKey
        );
    }
    return supabaseClient;
}

function showLogin() {
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
}

function showApp() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appScreen').classList.remove('hidden');
}

function showConfigError(message) {
    document.getElementById('loginError').innerText = message;
    document.getElementById('loginError').classList.remove('hidden');
    showLogin();
}

async function loadCurrentProfile() {
    if (currentProfile?.id) return currentProfile;
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data, error } = await sb
        .from('profiles')
        .select('id, name, station_id, fax_label, description')
        .eq('id', user.id)
        .single();

    if (error || !data) return null;
    return data;
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const errEl = document.getElementById('loginError');
    const btn = document.getElementById('loginSubmitBtn');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.innerText = 'KOBLER TIL...';

    try {
        if (!(await loadFaxchatConfig())) {
            throw new Error('Supabase-config mangler. Sjekk at public-config.js lastes.');
        }

        const username = document.getElementById('loginUsername').value.trim();
        const parsed = parseFaxUsername(username);
        if (!parsed) {
            throw new Error('Bruk Edvard01 — ikke e-post. Kortnavn + 2 siffer (01 = faksnummer).');
        }

        const password = document.getElementById('loginPassword').value;
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: parsed.username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            if (data.error && data.error.includes('JWT_SECRET')) {
                throw new Error('Vercel mangler SUPABASE_JWT_SECRET (Supabase → Settings → API → JWT Secret).');
            }
            throw new Error(data.error || 'Feil brukernavn eller passord');
        }

        const sb = getSupabase();
        const { error: sessionError } = await sb.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token
        });
        if (sessionError) throw sessionError;

        currentProfile = data.profile;
        if (typeof initFaxApp === 'function') await initFaxApp();
        showApp();
    } catch (e) {
        errEl.innerText = e.message || 'Innlogging feilet.';
        errEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerText = 'AKTIVER LINJE';
    }
}

async function logout() {
    const sb = getSupabase();
    if (sb) await sb.auth.signOut();
    currentProfile = null;
    showLogin();
    document.getElementById('loginPassword').value = '';
    document.getElementById('loginUsername').value = '';
}

async function bootstrapAuth() {
    if (!(await loadFaxchatConfig())) {
        showConfigError('Supabase-config mangler. Last siden på nytt eller sjekk deploy.');
        return;
    }

    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();

    if (session) {
        currentProfile = await loadCurrentProfile();
        if (currentProfile) {
            if (typeof initFaxApp === 'function') await initFaxApp();
            showApp();
            return;
        }
        await sb.auth.signOut();
    }

    showLogin();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);
    bootstrapAuth();
});
