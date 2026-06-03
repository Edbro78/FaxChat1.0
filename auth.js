let supabaseClient = null;
let currentProfile = null;

const AUTH_EMAIL_DOMAIN = 'faxchat.no';

/** Brukernavn "admin" → admin@faxchat.no for Supabase Auth */
function usernameToEmail(username) {
    const value = username.trim().toLowerCase();
    if (value.includes('@')) return value;
    return `${value}@${AUTH_EMAIL_DOMAIN}`;
}

function getSupabase() {
    if (!supabaseClient && window.FAXCHAT_CONFIG) {
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
    const email = usernameToEmail(document.getElementById('loginUsername').value);
    const password = document.getElementById('loginPassword').value;
    const errEl = document.getElementById('loginError');
    const btn = document.getElementById('loginSubmitBtn');

    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.innerText = 'KOBLER TIL...';

    try {
        const sb = getSupabase();
        const { error } = await sb.auth.signInWithPassword({ email, password });
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
    await sb.auth.signOut();
    currentProfile = null;
    showLogin();
    document.getElementById('loginPassword').value = '';
}

async function bootstrapAuth() {
    if (!window.FAXCHAT_CONFIG?.url) {
        document.getElementById('loginError').innerText =
            'config.js mangler. Kjør build-config eller kopier config.example.js.';
        document.getElementById('loginError').classList.remove('hidden');
        showLogin();
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
