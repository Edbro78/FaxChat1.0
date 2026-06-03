let supabaseClient = null;
let currentProfile = null;
let configLoaded = false;

const AUTH_EMAIL_DOMAIN = 'faxchat.no';
const FAX_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*\d{2}$/;

/**
 * Edvard01 → { name: 'Edvard', stationId: '01', faxLabel: 'Edvard01', authEmail: 'edvard01@faxchat.no' }
 */
function parseFaxUsername(input) {
    const raw = input.trim();
    if (!FAX_USERNAME_PATTERN.test(raw)) return null;

    const match = raw.match(/^([A-Za-z][A-Za-z0-9]*)(\d{2})$/);
    const nameRaw = match[1];
    const stationId = match[2];
    const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1).toLowerCase();
    const faxLabel = name + stationId;

    return {
        name,
        stationId,
        faxLabel,
        authEmail: `${faxLabel.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`
    };
}

function loadScriptConfig() {
    return new Promise((resolve) => {
        if (window.FAXCHAT_CONFIG?.url && window.FAXCHAT_CONFIG?.anonKey) {
            resolve(true);
            return;
        }
        const script = document.createElement('script');
        script.src = 'config.js';
        script.onload = () => resolve(Boolean(window.FAXCHAT_CONFIG?.url && window.FAXCHAT_CONFIG?.anonKey));
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
    });
}

async function loadFaxchatConfig() {
    if (configLoaded && window.FAXCHAT_CONFIG?.url) return true;

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
    } catch (_) {
        /* lokal dev uten Vercel API */
    }

    const fromFile = await loadScriptConfig();
    configLoaded = fromFile;
    return fromFile;
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
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data, error } = await sb
        .from('profiles')
        .select('id, name, station_id, fax_label, description')
        .eq('id', user.id)
        .single();

    if (error || !data) {
        console.error('Profil mangler for bruker:', error);
        return null;
    }
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
            throw new Error('Supabase er ikke konfigurert. Legg SUPABASE_URL og SUPABASE_ANON_KEY i Vercel → Environment Variables, deretter Redeploy.');
        }

        const username = document.getElementById('loginUsername').value.trim();
        const parsed = parseFaxUsername(username);
        if (!parsed) {
            throw new Error('Brukernavn må være Kortnavn + 2 siffer, f.eks. Edvard01 (01 = faksnummer).');
        }

        const password = document.getElementById('loginPassword').value;
        const sb = getSupabase();
        const { error } = await sb.auth.signInWithPassword({ email: parsed.authEmail, password });
        if (error) throw error;

        currentProfile = await loadCurrentProfile();
        if (!currentProfile) {
            await sb.auth.signOut();
            throw new Error('Brukerkonto mangler profil. Kontakt administrator.');
        }

        if (typeof initFaxApp === 'function') {
            await initFaxApp();
        }
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
}

async function bootstrapAuth() {
    const ok = await loadFaxchatConfig();
    if (!ok) {
        showConfigError(
            'Supabase mangler. I Vercel: Settings → Environment Variables → SUPABASE_URL + SUPABASE_ANON_KEY → Redeploy. Lokalt: kopier config.example.js til config.js.'
        );
        return;
    }

    const sb = getSupabase();
    const { data: { session } } = await sb.auth.getSession();

    if (session) {
        currentProfile = await loadCurrentProfile();
        if (currentProfile) {
            if (typeof initFaxApp === 'function') {
                await initFaxApp();
            }
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
