const SUPABASE_URL = 'https://mswgcwwpvkxvkvwejiab.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_FT8dFRVYyO-7dXlGnydQUA_UQsL9A3w';

let supabaseClient = null;
let currentProfile = null;

function getSupabase() {
    if (!supabaseClient) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

async function loadProfile() {
    const sb = getSupabase();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return null;

    const { data } = await sb.from('profiles').select('id, name, station_id, fax_label, description').eq('id', user.id).maybeSingle();
    if (data) return data;

    const { data: ensured, error } = await sb.rpc('ensure_profile');
    if (error || !ensured) return null;
    return ensured;
}

async function handleLoginSubmit(event) {
    event.preventDefault();
    const errEl = document.getElementById('loginError');
    const btn = document.getElementById('loginSubmitBtn');
    errEl.classList.add('hidden');
    btn.disabled = true;
    btn.innerText = 'KOBLER TIL...';
    try {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const { error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentProfile = await loadProfile();
        if (!currentProfile) {
            await getSupabase().auth.signOut();
            throw new Error('Innlogging OK, men profil finnes ikke. Kjør schema.sql i Supabase SQL Editor (nederst er engangs-fix).');
        }
        initAudio();
        await initFaxApp();
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
    await getSupabase().auth.signOut();
    currentProfile = null;
    showLogin();
    document.getElementById('loginPassword').value = '';
}

async function bootstrapAuth() {
    const { data: { session } } = await getSupabase().auth.getSession();
    if (session) {
        currentProfile = await loadProfile();
        if (currentProfile) {
            initAudio();
            await initFaxApp();
            showApp();
            return;
        }
        await getSupabase().auth.signOut();
    }
    showLogin();
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginForm').addEventListener('submit', handleLoginSubmit);
    registerServiceWorker();
    bootstrapAuth();
});

// --- WEB PUSH (forutsetter PWA fra hjemskjerm) ---

function isStandalonePwa() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return null;
    try {
        return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch (e) {
        console.warn('Service worker registration failed', e);
        return null;
    }
}

async function setupPushNotifications() {
    if (!isStandalonePwa()) return;
    const vapidPublic = window.FAXCHAT_PUSH?.vapidPublicKey;
    if (!vapidPublic) return;
    if (!('PushManager' in window) || !('Notification' in window)) return;

    await registerServiceWorker();
    const reg = await navigator.serviceWorker.ready;

    let permission = Notification.permission;
    if (permission === 'default') {
        permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') return;

    const { data: { user } } = await getSupabase().auth.getUser();
    if (!user) return;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublic)
        });
    }

    const { error } = await getSupabase().from('push_subscriptions').upsert(
        {
            user_id: user.id,
            endpoint: sub.endpoint,
            subscription: sub.toJSON()
        },
        { onConflict: 'user_id,endpoint' }
    );

    if (error) {
        console.warn('Kunne ikke lagre push-abonnement:', error.message);
    }
}

// --- SOUND SYNTHESIS ENGINE (Synthesized via Web Audio API) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playRetroSound(type, f1 = null, f2 = null) {
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    if (type === 'key') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140 + Math.random() * 30, now);
        osc.frequency.exponentialRampToValueAtTime(30, now + 0.05);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
    }
    else if (type === 'type') {
        const osc = audioCtx.createOscillator();
        const noise = audioCtx.createBufferSource();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.03);

        const bufferSize = audioCtx.sampleRate * 0.02;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        noise.buffer = buffer;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;

        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.03);

        osc.connect(gain);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        noise.start(now);
        osc.stop(now + 0.03);
        noise.stop(now + 0.03);
    }
    else if (type === 'dtmf' && f1 && f2) {
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc1.frequency.setValueAtTime(f1, now);
        osc2.frequency.setValueAtTime(f2, now);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.15);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.15);
        osc2.stop(now + 0.15);
    }
    else if (type === 'reelslide') {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(450, now + 0.25);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.25);
    }
    else if (type === 'reload') {
        const duration = 1.0;
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(45, now);
        osc1.frequency.linearRampToValueAtTime(95, now + duration);

        osc2.type = 'square';
        osc2.frequency.setValueAtTime(80, now);
        osc2.frequency.linearRampToValueAtTime(160, now + duration);

        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration);
        osc2.stop(now + duration);
    }
}

function playScreamingFaxHandshake() {
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    beep(1100, 0.4, now);
    beep(1100, 0.4, now + 0.6);
    beep(2100, 0.8, now + 1.2);

    setTimeout(() => {
        const runNow = audioCtx.currentTime;

        const bufferSize = audioCtx.sampleRate * 2.0;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = buffer;

        const bandpass = audioCtx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 1700;
        bandpass.Q.value = 1.5;

        const hissGain = audioCtx.createGain();
        hissGain.gain.setValueAtTime(0.06, runNow);
        hissGain.gain.exponentialRampToValueAtTime(0.001, runNow + 2.0);

        const carrier1 = audioCtx.createOscillator();
        carrier1.type = 'sawtooth';
        carrier1.frequency.setValueAtTime(1400, runNow);
        carrier1.frequency.linearRampToValueAtTime(1800, runNow + 1.2);

        const carrier2 = audioCtx.createOscillator();
        carrier2.type = 'square';
        carrier2.frequency.setValueAtTime(2400, runNow);
        carrier2.frequency.linearRampToValueAtTime(1200, runNow + 2.0);

        const fmOsc = audioCtx.createOscillator();
        const fmGain = audioCtx.createGain();
        fmOsc.frequency.setValueAtTime(50, runNow);
        fmGain.gain.setValueAtTime(300, runNow);

        const toneGain = audioCtx.createGain();
        toneGain.gain.setValueAtTime(0.04, runNow);
        toneGain.gain.exponentialRampToValueAtTime(0.001, runNow + 2.0);

        fmOsc.connect(fmGain);
        fmGain.connect(carrier1.frequency);
        fmGain.connect(carrier2.frequency);

        noiseSource.connect(bandpass);
        bandpass.connect(hissGain);
        hissGain.connect(audioCtx.destination);

        carrier1.connect(toneGain);
        carrier2.connect(toneGain);
        toneGain.connect(audioCtx.destination);

        fmOsc.start(runNow);
        carrier1.start(runNow);
        carrier2.start(runNow);
        noiseSource.start(runNow);

        fmOsc.stop(runNow + 2.0);
        carrier1.stop(runNow + 2.0);
        carrier2.stop(runNow + 2.0);
        noiseSource.stop(runNow + 2.0);
    }, 2100);
}

function beep(freq, duration, startTime) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.05, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
}

const FAX_CYCLE_MS = 8000;
const FAX_RECEIVE_MS = 10000;
const FAX_SHRED_MS = 6000;
const PAPER_MAX = 6;
const MESSAGE_MAX_LENGTH = 50;
const FAX_SEND_PAUSE_MS = 2600;
const FAX_SEND_FEED_MS = 5400;
let isFaxMachineBusy = false;
let faxSoundCleanup = [];

function clearFaxSoundCleanup() {
    faxSoundCleanup.forEach((fn) => {
        try { fn(); } catch (_) { /* ignore */ }
    });
    faxSoundCleanup = [];
}

/** Klassisk 8-sekunders faxlyd: handshake + modem + mekanisk surr */
function playFaxMachineCycle(durationMs = FAX_CYCLE_MS) {
    initAudio();
    if (!audioCtx) return;
    clearFaxSoundCleanup();

    const now = audioCtx.currentTime;
    const durationSec = durationMs / 1000;

    beep(1100, 0.35, now);
    beep(1100, 0.35, now + 0.55);
    beep(2100, 0.7, now + 1.15);

    const motorStart = now + 0.15;
    const motorOsc = audioCtx.createOscillator();
    const motorGain = audioCtx.createGain();
    motorOsc.type = 'sawtooth';
    motorOsc.frequency.setValueAtTime(48, motorStart);
    motorOsc.frequency.linearRampToValueAtTime(88, motorStart + 1.0);
    motorGain.gain.setValueAtTime(0.05, motorStart);
    motorGain.gain.exponentialRampToValueAtTime(0.006, motorStart + 1.05);
    motorOsc.connect(motorGain);
    motorGain.connect(audioCtx.destination);
    motorOsc.start(motorStart);
    motorOsc.stop(motorStart + 1.1);

    const dataStart = now + 2.0;
    const dataDuration = Math.max(0.5, durationSec - 2.0);
    const bufferSize = Math.floor(audioCtx.sampleRate * dataDuration);
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const bufData = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        bufData[i] = Math.random() * 2 - 1;
    }

    const noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 1680;
    bandpass.Q.value = 1.3;

    const hissGain = audioCtx.createGain();
    hissGain.gain.setValueAtTime(0, dataStart);
    hissGain.gain.linearRampToValueAtTime(0.075, dataStart + 0.12);
    hissGain.gain.exponentialRampToValueAtTime(0.001, dataStart + dataDuration);

    const carrier1 = audioCtx.createOscillator();
    carrier1.type = 'sawtooth';
    carrier1.frequency.setValueAtTime(1400, dataStart);
    carrier1.frequency.linearRampToValueAtTime(1750, dataStart + dataDuration * 0.55);
    carrier1.frequency.linearRampToValueAtTime(1250, dataStart + dataDuration);

    const carrier2 = audioCtx.createOscillator();
    carrier2.type = 'square';
    carrier2.frequency.setValueAtTime(2380, dataStart);
    carrier2.frequency.linearRampToValueAtTime(1150, dataStart + dataDuration);

    const fmOsc = audioCtx.createOscillator();
    const fmGain = audioCtx.createGain();
    fmOsc.frequency.setValueAtTime(48, dataStart);
    fmGain.gain.setValueAtTime(290, dataStart);

    const toneGain = audioCtx.createGain();
    toneGain.gain.setValueAtTime(0, dataStart);
    toneGain.gain.linearRampToValueAtTime(0.048, dataStart + 0.18);
    toneGain.gain.exponentialRampToValueAtTime(0.001, dataStart + dataDuration);

    fmOsc.connect(fmGain);
    fmGain.connect(carrier1.frequency);
    fmGain.connect(carrier2.frequency);
    noiseSource.connect(bandpass);
    bandpass.connect(hissGain);
    hissGain.connect(audioCtx.destination);
    carrier1.connect(toneGain);
    carrier2.connect(toneGain);
    toneGain.connect(audioCtx.destination);

    fmOsc.start(dataStart);
    carrier1.start(dataStart);
    carrier2.start(dataStart);
    noiseSource.start(dataStart);
    fmOsc.stop(dataStart + dataDuration);
    carrier1.stop(dataStart + dataDuration);
    carrier2.stop(dataStart + dataDuration);
    noiseSource.stop(dataStart + dataDuration);

    const rollerTimer = setInterval(() => playRetroSound('reelslide'), 1100);
    faxSoundCleanup.push(() => clearInterval(rollerTimer));
    setTimeout(() => clearInterval(rollerTimer), durationMs);
}

function printedFaxStorageKey() {
    return `faxchat_printed_${currentProfile?.station_id || 'unknown'}`;
}

function loadPrintedFaxIds() {
    const key = printedFaxStorageKey();
    const legacyKey = `faxchat_seen_${currentProfile?.station_id || 'unknown'}`;
    try {
        const ids = new Set();
        const fromLocal = localStorage.getItem(key);
        if (fromLocal) JSON.parse(fromLocal).forEach((id) => ids.add(id));
        const fromLegacyLocal = localStorage.getItem(legacyKey);
        if (fromLegacyLocal) JSON.parse(fromLegacyLocal).forEach((id) => ids.add(id));
        const fromLegacySession = sessionStorage.getItem(legacyKey);
        if (fromLegacySession) JSON.parse(fromLegacySession).forEach((id) => ids.add(id));
        return ids;
    } catch (_) {
        return new Set();
    }
}

function markFaxPrinted(id) {
    const printed = loadPrintedFaxIds();
    printed.add(id);
    try {
        localStorage.setItem(printedFaxStorageKey(), JSON.stringify([...printed]));
    } catch (_) { /* ignore quota */ }
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function animateThermalReveal(el, durationMs) {
    return new Promise((resolve) => {
        const start = performance.now();
        function tick(now) {
            const t = Math.min(1, (now - start) / durationMs);
            el.style.setProperty('--fax-reveal', `${(t * 100).toFixed(2)}%`);
            if (t < 1) {
                requestAnimationFrame(tick);
            } else {
                resolve();
            }
        }
        el.style.setProperty('--fax-reveal', '0%');
        requestAnimationFrame(tick);
    });
}

function setFaxMachineTransmitting(active) {
    const scene = document.getElementById('jitflSendScene');
    if (scene) scene.classList.toggle('jitfl-scene--transmitting', active);
    const ledPower = document.getElementById('jitflLedPower');
    const ledTx = document.getElementById('jitflLedTx');
    if (ledPower) ledPower.classList.toggle('lit', active);
    if (ledTx) ledTx.classList.toggle('lit', active);
}

function resetJitflSendDom() {
    const sendSheet = document.getElementById('faxSendSheet');
    const msgBody = document.getElementById('faxSendMessageBody');
    const intakeGlow = document.getElementById('jitflIntakeGlow');
    const rollers = document.getElementById('jitflRollers');
    const lcd = document.getElementById('jitflLcdText');

    sendSheet?.classList.remove('phase-feed');
    sendSheet?.classList.add('phase-pause');
    if (msgBody) msgBody.textContent = '';
    intakeGlow?.classList.remove('active');
    rollers?.classList.remove('active');
    if (lcd) lcd.textContent = 'STANDBY';
    setFaxMachineTransmitting(false);
}

function resetFaxMachineDom() {
    const overlay = document.getElementById('faxMachineOverlay');
    const paper = document.getElementById('faxEmergingPaper');
    const scanLine = document.getElementById('faxScanLine');

    overlay.classList.remove('mode-send', 'mode-receive');
    document.getElementById('faxMachineReceiveLayout').classList.remove('hidden');
    document.getElementById('faxMachineSendLayout').classList.add('hidden');

    paper.classList.remove('printing');
    paper.classList.add('hidden');
    scanLine.classList.remove('scanning', 'hidden');
    document.getElementById('faxEmergingTray').classList.remove('hidden');
    resetJitflSendDom();
}

function showFaxMachineOverlay(mode, statusText, hintText) {
    resetFaxMachineDom();
    const overlay = document.getElementById('faxMachineOverlay');
    overlay.classList.remove('hidden');
    overlay.classList.add(mode === 'send' ? 'mode-send' : 'mode-receive');
    document.getElementById('faxMachineLed').classList.add('active');
    document.getElementById('faxMachineStatus').innerText = statusText;
    document.getElementById('faxMachineHint').innerText = hintText;
    document.getElementById('faxMachineModeLabel').innerText = mode === 'send' ? 'SENDER FAX' : 'MOTTAR FAX';

    if (mode === 'send') {
        document.getElementById('faxMachineReceiveLayout').classList.add('hidden');
        document.getElementById('faxMachineSendLayout').classList.remove('hidden');
        const lcd = document.getElementById('jitflLcdText');
        if (lcd) lcd.textContent = 'KLAR';
    } else {
        document.getElementById('faxMachineReceiveLayout').classList.remove('hidden');
        document.getElementById('faxMachineSendLayout').classList.add('hidden');
    }
}

function hideFaxMachineOverlay() {
    document.getElementById('faxMachineOverlay').classList.add('hidden');
    document.getElementById('faxMachineLed').classList.remove('active');
    resetFaxMachineDom();
}

function getFaxSenderMeta(fax) {
    const senderProfile = directoryProfiles.find((p) => p.id === fax.sender_user_id);
    const date = new Date(fax.created_at);
    const day = String(date.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DES'];
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');

    return {
        name: senderProfile?.name?.toUpperCase() || 'UKJENT AVSENDER',
        stationId: senderProfile?.station_id || '??',
        faxLabel: senderProfile?.fax_label || '—',
        dateStr: `${day}. ${months[date.getMonth()]} ${date.getFullYear()}`,
        timeStr: `${hour}:${min}`
    };
}

function buildPaperRemainingMarkup(remaining) {
    let leds = '';
    for (let i = 0; i < PAPER_MAX; i++) {
        leds += `<span class="fax-cover-paper-led${i < remaining ? ' is-lit' : ''}"></span>`;
    }
    return `
        <div class="fax-cover-paper">
            <span class="fax-cover-label">PAPIR IGJEN</span>
            <div class="fax-cover-paper-row">
                <div class="fax-cover-paper-leds" aria-label="${remaining} av ${PAPER_MAX} ark">${leds}</div>
                <span class="fax-cover-paper-count">${remaining}/${PAPER_MAX}</span>
            </div>
        </div>
    `;
}

function buildFaxCoverHtml(fax, paperRemaining = null) {
    const meta = getFaxSenderMeta(fax);
    const paperBlock = paperRemaining !== null ? buildPaperRemainingMarkup(paperRemaining) : '';
    return `
        <div class="fax-cover-kicker">INNKOMMENDE FAX</div>
        <div class="fax-cover-heading">FORSIDE</div>
        <div class="fax-cover-grid">
            <div class="fax-cover-row">
                <span class="fax-cover-label">AVSENDER</span>
                <span class="fax-cover-value fax-cover-value--name">${escapeHtml(meta.name)}</span>
            </div>
            <div class="fax-cover-row">
                <span class="fax-cover-label">FAX-NR</span>
                <span class="fax-cover-value">${escapeHtml(meta.stationId)}</span>
            </div>
            <div class="fax-cover-row">
                <span class="fax-cover-label">DATO</span>
                <span class="fax-cover-value">${escapeHtml(meta.dateStr)}</span>
            </div>
            <div class="fax-cover-row">
                <span class="fax-cover-label">KLOKKESLETT</span>
                <span class="fax-cover-value fax-cover-value--time">${escapeHtml(meta.timeStr)}</span>
            </div>
        </div>
        ${paperBlock}
    `;
}

async function runFaxReceiveAnimation(fax) {
    if (paperCapacity <= 0) {
        const refilled = await promptRefillPaper();
        if (!refilled) return false;
    }

    paperCapacity--;
    const remaining = paperCapacity;
    updatePaperGauge();
    updateSendButtonState();

    const senderProfile = directoryProfiles.find((p) => p.id === fax.sender_user_id);
    const senderName = senderProfile?.name || 'UKJENT';

    showFaxMachineOverlay('receive', 'MOTTAR...', `INNKOMMENDE FRA ${senderName.toUpperCase()} — SKRIVER UT ARK...`);
    playFaxMachineCycle(FAX_RECEIVE_MS);

    const paper = document.getElementById('faxEmergingPaper');
    const cover = document.getElementById('faxEmergingCover');
    const body = document.getElementById('faxEmergingBody');
    const scanLine = document.getElementById('faxScanLine');
    if (cover) cover.innerHTML = buildFaxCoverHtml(fax, remaining);
    if (body) body.textContent = fax.content;

    const animMs = `${FAX_RECEIVE_MS}ms`;
    paper.style.animationDuration = animMs;
    if (scanLine) {
        scanLine.classList.remove('hidden');
        scanLine.style.animationDuration = animMs;
        void scanLine.offsetWidth;
        scanLine.classList.add('scanning');
    }

    cover?.classList.add('thermal-print');
    body?.classList.add('thermal-print');
    paper.classList.remove('hidden');
    void paper.offsetWidth;
    paper.classList.add('printing');

    const revealPromise = Promise.all([
        cover ? animateThermalReveal(cover, FAX_RECEIVE_MS) : Promise.resolve(),
        body ? animateThermalReveal(body, FAX_RECEIVE_MS) : Promise.resolve()
    ]);

    await Promise.all([revealPromise, delay(FAX_RECEIVE_MS)]);

    cover?.classList.remove('thermal-print');
    body?.classList.remove('thermal-print');
    if (scanLine) {
        scanLine.classList.remove('scanning');
        scanLine.style.animationDuration = '';
    }
    paper.style.animationDuration = '';
    hideFaxMachineOverlay();
    clearFaxSoundCleanup();
    markFaxPrinted(fax.id);

    if (paperCapacity <= 0) {
        await promptRefillPaper();
    }
    return true;
}

async function runFaxSendAnimation(text, destProfile) {
    const hintEl = document.getElementById('faxMachineHint');
    const statusEl = document.getElementById('faxMachineStatus');
    const intakeGlow = document.getElementById('jitflIntakeGlow');
    const rollers = document.getElementById('jitflRollers');
    const lcd = document.getElementById('jitflLcdText');
    const destLabel = document.getElementById('jitflPaperDest');
    const msgBody = document.getElementById('faxSendMessageBody');
    const sendSheet = document.getElementById('faxSendSheet');

    showFaxMachineOverlay(
        'send',
        'KLAR',
        `SJEKK ARKET — NR ${destProfile.station_id} (${destProfile.name.toUpperCase()})`
    );
    playFaxMachineCycle(FAX_CYCLE_MS);

    if (destLabel) {
        destLabel.textContent = `TIL: NR ${destProfile.station_id} — ${destProfile.name.toUpperCase()}`;
    }
    if (msgBody) msgBody.textContent = text;
    sendSheet.classList.remove('phase-feed');
    sendSheet.classList.add('phase-pause');
    if (lcd) lcd.textContent = 'ARK LASTET';

    await delay(FAX_SEND_PAUSE_MS);

    statusEl.innerText = 'SENDER...';
    hintEl.innerText = 'MATER ARK INN I FAXMASKINEN...';
    if (lcd) lcd.textContent = 'SENDING';
    setFaxMachineTransmitting(true);
    intakeGlow?.classList.add('active');
    rollers?.classList.add('active');

    sendSheet.classList.remove('phase-pause');
    void sendSheet.offsetWidth;
    sendSheet.classList.add('phase-feed');

    await delay(FAX_SEND_FEED_MS);

    intakeGlow?.classList.remove('active');
    rollers?.classList.remove('active');
    sendSheet.classList.remove('phase-feed');
    sendSheet.classList.add('phase-pause');
    hideFaxMachineOverlay();
    clearFaxSoundCleanup();
}

function syncIncomingFromFetched(fetchedList) {
    const printed = loadPrintedFaxIds();
    pendingPrintQueue = fetchedList
        .filter((f) => !printed.has(f.id))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    incomingFaxes = fetchedList.filter((f) => printed.has(f.id));
    if (stackViewIndex >= incomingFaxes.length) {
        stackViewIndex = Math.max(0, incomingFaxes.length - 1);
    }
    renderFaxes();
}

async function printPendingIncomingFaxes() {
    if (isFaxMachineBusy) return;

    const printed = loadPrintedFaxIds();
    const toPrint = pendingPrintQueue.filter((f) => !printed.has(f.id));
    pendingPrintQueue = [];
    updateInboxBadge();

    if (toPrint.length === 0) return;

    isFaxMachineBusy = true;
    try {
        for (const fax of toPrint) {
            const ok = await runFaxReceiveAnimation(fax);
            if (!ok) break;
            incomingFaxes = [fax, ...incomingFaxes];
            stackViewIndex = 0;
            renderFaxes();
            playRetroSound('key');
        }
    } finally {
        isFaxMachineBusy = false;
    }
}

const DTMF_FREQS = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '0': [941, 1336]
};

let directoryProfiles = [];
let incomingFaxes = [];
let pendingPrintQueue = [];
let dialedBuffer = "";
let activeRecipientStation = null;
let currentAppScreen = 'start';
let paperCapacity = PAPER_MAX;

const APP_SCREENS = ['start', 'kartotek', 'dialer', 'compose', 'send', 'inbox'];
const NAV_SCREENS = ['kartotek', 'dialer', 'compose', 'send'];
let kartotekIndex = 0;
let stackViewIndex = 0;

async function initFaxApp() {
    const p = currentProfile;
    if (!p) return;

    document.getElementById('sessionUserLabel').innerText = `${p.name} · NR ${p.station_id}`;
    document.getElementById('inboxTrayLabel').innerText = `INNKOMMENDE → NR ${p.station_id}`;

    dialedBuffer = "";
    activeRecipientStation = null;
    paperCapacity = PAPER_MAX;
    stackViewIndex = 0;

    await loadDirectory();
    updateUIVariables();
    updatePaperGauge();
    renderKartotek();
    setAppScreen('start', { skipFaxRefresh: true });
    await refreshIncomingFaxes();
    await setupPushNotifications();

    if (!initFaxApp.visibilityHook) {
        document.addEventListener('visibilitychange', onAppVisibilityChange);
        initFaxApp.visibilityHook = true;
    }
}

function onAppVisibilityChange() {
    if (document.visibilityState !== 'visible' || !currentProfile || isFaxMachineBusy) return;
    refreshIncomingFaxes();
}

async function loadDirectory() {
    const sb = getSupabase();
    const { data, error } = await sb.from('profiles').select('id, name, station_id, fax_label, description').order('station_id');
    if (error) {
        showMsgBox('DATABASE FEIL', error.message);
        directoryProfiles = [];
        return;
    }
    directoryProfiles = (data || []).sort((a, b) => Number(a.station_id) - Number(b.station_id));
}

function setSendHints(text) {
    const hint = document.getElementById('sendReadyHint');
    const hintSend = document.getElementById('sendReadyHintSend');
    if (hint) hint.innerText = text;
    if (hintSend) hintSend.innerText = text;
}

function updateSendButtonState() {
    const btn = document.getElementById('startTransmissionBtn');
    if (!btn) return;

    const text = (document.getElementById('faxContentInput')?.value || '').trim();
    const match = resolveDialMatch(dialedBuffer);
    const connected = match.status === 'connected' && match.profile && match.profile.id !== currentProfile?.id;

    if (connected) {
        activeRecipientStation = match.profile.station_id;
    } else {
        activeRecipientStation = null;
    }

    if (paperCapacity <= 0) {
        setSendHints('Tomt for papir — trykk PAPIR-knappen for å fylle på.');
        btn.disabled = true;
        btn.classList.add('opacity-40');
        return;
    }

    if (!connected) {
        setSendHints('Velg mottaker i KATALOG eller tast NUMMER.');
        btn.disabled = true;
        btn.classList.add('opacity-40');
        return;
    }

    if (!text) {
        setSendHints(`Koblet til ${match.profile.name.toUpperCase()} (NR ${match.profile.station_id}) — skriv melding under SKRIV.`);
        btn.disabled = true;
        btn.classList.add('opacity-40');
        return;
    }

    setSendHints(`Klar: SEND FAX til ${match.profile.name.toUpperCase()} (NR ${match.profile.station_id}).`);
    btn.disabled = false;
    btn.classList.remove('opacity-40');
}

function resolveDialMatch(buffer) {
    if (!buffer) return { profile: null, status: 'idle' };
    const exact = directoryProfiles.find(p => p.station_id === buffer);
    if (exact) return { profile: exact, status: 'connected' };
    if (buffer.length >= 2) return { profile: null, status: 'not_found' };
    const hasLonger = directoryProfiles.some(
        p => p.station_id.startsWith(buffer) && p.station_id.length > buffer.length
    );
    if (hasLonger) return { profile: null, status: 'dialing' };
    return { profile: null, status: 'not_found' };
}

async function refreshIncomingFaxes(options = {}) {
    const sb = getSupabase();
    const station = currentProfile.station_id;
    const { data, error } = await sb
        .from('faxes')
        .select('id, content, created_at, stack_order, sender_user_id')
        .eq('recipient_station_id', station)
        .order('stack_order', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        showMsgBox('DATABASE FEIL', error.message);
        incomingFaxes = [];
        pendingPrintQueue = [];
        renderFaxes();
        return;
    }

    syncIncomingFromFetched(data || []);

    if (options.printPending && pendingPrintQueue.length > 0 && !isFaxMachineBusy) {
        await printPendingIncomingFaxes();
    }
}

function browseStackOlder() {
    if (stackViewIndex >= incomingFaxes.length - 1) return;
    stackViewIndex++;
    playRetroSound('reelslide');
    renderFaxes();
}

function browseStackNewer() {
    if (stackViewIndex <= 0) return;
    stackViewIndex--;
    playRetroSound('reelslide');
    renderFaxes();
}

function updateStackControls() {
    const total = incomingFaxes.length;
    const navBar = document.getElementById('stackNavBar');
    const posLabel = document.getElementById('stackPositionLabel');
    const hint = document.getElementById('stackBrowseHint');
    const btnOlder = document.getElementById('btnStackOlder');
    const btnNewer = document.getElementById('btnStackNewer');

    if (total === 0) {
        navBar.classList.add('hidden');
        posLabel.innerText = 'BUNKE: 0 ARK';
        return;
    }

    navBar.classList.remove('hidden');
    const humanPos = stackViewIndex + 1;
    posLabel.innerText = `BUNKE: ARK ${humanPos} / ${total}`;
    hint.innerText = stackViewIndex === 0
        ? 'ØVERST (NYESTE)'
        : stackViewIndex === total - 1
            ? 'BAK I BUNKEN (ELDEST)'
            : `ARK ${humanPos} — BLAR I GAMLE FAX`;

    btnOlder.disabled = stackViewIndex >= total - 1;
    btnNewer.disabled = stackViewIndex <= 0;
    btnOlder.classList.toggle('opacity-40', btnOlder.disabled);
    btnNewer.classList.toggle('opacity-40', btnNewer.disabled);
}

function renderKartotek() {
    const container = document.getElementById("kartotekCardContainer");
    container.innerHTML = "";

    if (directoryProfiles.length === 0) {
        container.innerHTML = '<span class="text-xs font-mono text-stone-500">[ TOM KATALOG ]</span>';
        return;
    }

    directoryProfiles.forEach((profile, idx) => {
        const card = document.createElement("div");

        const offsetZ = idx === kartotekIndex ? 30 : 10 - Math.abs(idx - kartotekIndex);
        const scale = idx === kartotekIndex ? 1.0 : 0.92;
        const opacity = idx === kartotekIndex ? 1.0 : 0.65;
        const translateY = idx === kartotekIndex ? -10 : 0;
        const translateX = (idx - kartotekIndex) * 10;

        card.className = "kartotek-card kartotek-card--catalog absolute font-mono text-stone-800 transition-all duration-300";
        card.style.zIndex = offsetZ;
        card.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        card.style.opacity = opacity;

        card.innerHTML = `
            <div class="kartotek-card-meta">
                <span class="kartotek-card-label">${escapeHtml(profile.fax_label)}</span>
                ${profile.id === currentProfile.id ? '<span class="kartotek-card-own">[DIN MASKIN]</span>' : ''}
            </div>
            <div class="kartotek-card-main">
                <div class="kartotek-card-name">${escapeHtml(profile.name)}</div>
                <div class="kartotek-card-desc">${escapeHtml(profile.description)}</div>
            </div>
            <div class="kartotek-card-station">Faxnummer ${escapeHtml(profile.station_id)}</div>
        `;

        card.onclick = () => {
            if (profile.id !== currentProfile.id) {
                dialedBuffer = profile.station_id;
                playRetroSound('key');
                updateUIVariables();
                setAppScreen('dialer');
            }
        };

        container.appendChild(card);
    });
}

function prevKartotekCard() {
    if (directoryProfiles.length === 0) return;
    playRetroSound('reelslide');
    kartotekIndex = (kartotekIndex - 1 + directoryProfiles.length) % directoryProfiles.length;
    renderKartotek();
}

function nextKartotekCard() {
    if (directoryProfiles.length === 0) return;
    playRetroSound('reelslide');
    kartotekIndex = (kartotekIndex + 1) % directoryProfiles.length;
    renderKartotek();
}

function setDestLabels(text) {
    const dest = document.getElementById('telefaxDestId');
    const destSend = document.getElementById('telefaxDestIdSend');
    if (dest) dest.innerText = text;
    if (destSend) destSend.innerText = text;
}

function updateUIVariables() {
    const me = currentProfile;
    document.getElementById("currentSenderLabel").innerText = `${me.name} · NR ${me.station_id}`;

    const padded = dialedBuffer.padEnd(2, '_');
    document.getElementById("dialNumberDisplay").innerText = `[ ${padded[0]} ][ ${padded[1]} ]`;

    const { profile: matchedProfile, status } = resolveDialMatch(dialedBuffer);

    if (matchedProfile) {
        if (matchedProfile.id === me.id) {
            document.getElementById("stationMatchInfo").innerHTML = `<span class="text-red-500">EGEN NR</span>`;
            setDestLabels('IKKE KOBLET (EGEN)');
            document.getElementById("dialerBlinker").innerText = "FEIL";
            activeRecipientStation = null;
        } else {
            document.getElementById("stationMatchInfo").innerHTML = `<span class="text-green-400">${matchedProfile.name.toUpperCase()}</span>`;
            setDestLabels(`NR ${matchedProfile.station_id} (${matchedProfile.name})`);
            document.getElementById("dialerBlinker").innerText = "KOBLET";
            activeRecipientStation = matchedProfile.station_id;
        }
    } else {
        activeRecipientStation = null;
        setDestLabels('IKKE KOBLET');
        document.getElementById("dialerBlinker").innerText = "IDLE";
        if (status === 'not_found' && dialedBuffer.length > 0) {
            document.getElementById("stationMatchInfo").innerHTML = `<span class="text-amber-500">UKJENT NR</span>`;
        } else if (status === 'dialing') {
            document.getElementById("stationMatchInfo").innerText = "RINGER...";
        } else {
            document.getElementById("stationMatchInfo").innerText = dialedBuffer.length > 0 ? "RINGER..." : "INGEN NUMMER";
        }
    }

    updateSendButtonState();
}

function pressDialKey(num) {
    if (dialedBuffer.length >= 2) return;
    dialedBuffer += num;

    if (DTMF_FREQS[num]) {
        playRetroSound('dtmf', DTMF_FREQS[num][0], DTMF_FREQS[num][1]);
    }

    updateUIVariables();

    if (dialedBuffer.length === 2) {
        const match = resolveDialMatch(dialedBuffer);
        if (match.status === 'connected' && match.profile && match.profile.id !== currentProfile?.id) {
            setAppScreen('compose', { skipFaxRefresh: true });
        }
    }
}

function clearDialKey() {
    dialedBuffer = "";
    activeRecipientStation = null;
    playRetroSound('key');
    updateUIVariables();
}

function showPhoneBellAlert() {
    playRetroSound('dtmf', 941, 1477);
    showMsgBox("ANALOG BELL", "SENDING LOUD RINGER VOLTAGE DETECT INTO THE TELEPHONE EXCHANGE LINE BOARD.");
}

function refillPaperToFull() {
    playRetroSound('reload');
    paperCapacity = PAPER_MAX;
    updatePaperGauge();
    updateSendButtonState();
}

let confirmAlertYesCallback = null;
let confirmAlertNoCallback = null;

function showConfirmBox(title, text, onYes, onNo) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = text;
    document.getElementById('alertActionsSingle').classList.add('hidden');
    document.getElementById('alertActionsConfirm').classList.remove('hidden');
    confirmAlertYesCallback = onYes;
    confirmAlertNoCallback = onNo || null;
    document.getElementById('customAlert').classList.remove('hidden');
    playRetroSound('dtmf', 697, 1209);
}

function promptRefillPaper() {
    return new Promise((resolve) => {
        showConfirmBox(
            'TOMT FOR PAPIR',
            'Vil du fylle på 6 stk nye ark i Faxmaskinen?',
            () => {
                refillPaperToFull();
                resolve(true);
            },
            () => resolve(false)
        );
    });
}

async function reloadPaper() {
    if (paperCapacity >= PAPER_MAX) {
        showMsgBox('PAPIRMAGASIN FULLT', `Du har allerede ${PAPER_MAX} ark i maskinen.`);
        return;
    }
    if (paperCapacity > 0) {
        showMsgBox('ARK IGJEN', `Du har ${paperCapacity} ark igjen. Fyll på når magasinet er tomt.`);
        return;
    }
    await promptRefillPaper();
}

function updatePaperGauge() {
    document.getElementById('paperPercentText').innerText = `${paperCapacity}/${PAPER_MAX}`;
    const container = document.getElementById('paperIndicatorsContainer');
    container.innerHTML = '';

    for (let i = 0; i < PAPER_MAX; i++) {
        const isLit = i < paperCapacity;
        const led = document.createElement('div');
        led.className = `paper-led ${isLit ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-stone-700'}`;
        container.appendChild(led);
    }
}

window.setAppScreen = setAppScreen;
window.refreshIncomingFaxes = refreshIncomingFaxes;
window.confirmAlertYes = confirmAlertYes;
window.confirmAlertNo = confirmAlertNo;
window.closeAlert = closeAlert;
window.reloadPaper = reloadPaper;
window.openInboxForPrint = openInboxForPrint;
window.shredTopPaper = shredTopPaper;

function updateStartScreenAlert() {
    const wrap = document.getElementById('startFaxMachineWrap');
    const lcd = document.getElementById('startJitflLcdText');
    const rxLed = document.getElementById('startJitflLedRx');
    const idleEl = document.getElementById('startIncomingIdle');
    const actionBtn = document.getElementById('startIncomingAction');
    const actionText = document.getElementById('startIncomingActionText');
    const count = pendingPrintQueue.length;
    const hasPending = count > 0;

    wrap?.classList.toggle('start-fax--incoming', hasPending);
    rxLed?.classList.toggle('lit', hasPending);

    if (lcd) {
        lcd.textContent = hasPending ? 'Ny innkommende FAX' : 'FAXCHAT READY';
    }

    idleEl?.classList.toggle('hidden', hasPending);
    actionBtn?.classList.toggle('hidden', !hasPending);
    actionBtn?.classList.toggle('start-incoming-link--active', hasPending);

    if (actionText && hasPending) {
        actionText.textContent = count === 1
            ? 'NY FAX MOTTATT — GÅ TIL PRINT'
            : `${count} NYE FAXER — GÅ TIL PRINT`;
    }
}

function openInboxForPrint() {
    setAppScreen('inbox');
}

function updateInboxBadge() {
    const badge = document.getElementById('inboxBadge');
    const btn = document.getElementById('btnOpenInbox');
    if (!badge) return;
    const count = pendingPrintQueue.length;
    if (count > 0) {
        badge.innerText = count > 9 ? '9+' : String(count);
        badge.classList.remove('hidden');
        btn?.classList.add('app-inbox-btn--alert');
    } else {
        badge.classList.add('hidden');
        btn?.classList.remove('app-inbox-btn--alert');
    }
    updateStartScreenAlert();
}

function setAppScreen(screen, options = {}) {
    if (!APP_SCREENS.includes(screen)) return;
    if (isFaxMachineBusy && screen !== 'inbox') return;

    currentAppScreen = screen;
    playRetroSound('key');

    APP_SCREENS.forEach((id) => {
        const el = document.getElementById(`screen${id.charAt(0).toUpperCase()}${id.slice(1)}`);
        if (el) el.classList.toggle('is-active', id === screen);
    });

    NAV_SCREENS.forEach((id) => {
        const btn = document.getElementById(`nav${id.charAt(0).toUpperCase()}${id.slice(1)}`);
        if (btn) btn.classList.toggle('active', id === screen);
    });

    if (screen === 'inbox' && !options.skipFaxRefresh) {
        refreshIncomingFaxes({ printPending: true });
    }

    if (screen === 'compose' || screen === 'send' || screen === 'dialer') {
        updateUIVariables();
    }

}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderFaxes() {
    const listEl = document.getElementById("paperStackContainer");
    listEl.innerHTML = "";
    const thread = incomingFaxes;

    if (thread.length === 0) {
        stackViewIndex = 0;
        updateStackControls();
        listEl.innerHTML = `
            <div class="text-center py-20 text-stone-500 font-mono text-xs flex flex-col items-center justify-center gap-2 h-full">
                <i class="fa-solid fa-inbox text-4xl opacity-30"></i>
                <span>[ INGEN FAX MOTTATT PÅ NR ${currentProfile.station_id} ]</span>
            </div>
        `;
        updateInboxBadge();
        return;
    }

    thread.forEach((msg, idx) => {
        const seedAngle = (msg.content.charCodeAt(0) % 7) - 3;
        const seedX = (msg.content.charCodeAt(1) % 15) - 7;
        const layer = idx - stackViewIndex;

        const paper = document.createElement("div");
        paper.id = `fax-sheet-${msg.id}`;

        if (layer < 0) {
            paper.className = "fax-paper-sheet stack-peeled p-6 flex flex-col select-text font-mono text-stone-800";
            paper.style.zIndex = 5 + idx;
        } else {
            const isFront = layer === 0;
            const behindDepth = Math.min(layer, 4);
            paper.className = `fax-paper-sheet p-6 flex flex-col select-text font-mono text-stone-800${isFront ? ' stack-front' : ''}`;
            paper.style.zIndex = 80 - behindDepth;
            const offsetY = 12 + behindDepth * 10;
            const scale = 1 - behindDepth * 0.018;
            const opacity = isFront ? 1 : Math.max(0.35, 0.85 - behindDepth * 0.14);
            paper.style.opacity = String(opacity);
            paper.style.transform = `rotate(${seedAngle * (isFront ? 1 : 0.5)}deg) translate(${seedX}px, ${offsetY}px) scale(${scale})`;
        }

        const pilePos = idx + 1;
        paper.innerHTML = `
            <div class="fax-cover-sheet">${buildFaxCoverHtml(msg)}</div>
            <div class="fax-sheet-body text-xs uppercase leading-relaxed text-left flex-grow break-words tracking-wide" style="font-family: 'Courier Prime', monospace;">
                ${escapeHtml(msg.content)}
            </div>
            <div class="mt-4 pt-2 border-t border-dotted border-stone-300 flex justify-between items-center text-[9px] text-stone-400">
                <span>FX-99 SECURE RX LINE</span>
                <span>LAG ${pilePos}/${thread.length}${layer === 0 ? ' • LESES NÅ' : ''}</span>
            </div>
        `;

        listEl.appendChild(paper);
    });

    updateStackControls();
    updateInboxBadge();
}

function getViewedFax() {
    return incomingFaxes[stackViewIndex] || null;
}

async function shredTopPaper() {
    if (isFaxMachineBusy) return;
    const current = getViewedFax();
    if (!current) return;

    isFaxMachineBusy = true;
    try {
        await runShredAnimation(current);

        const sb = getSupabase();
        const { error } = await sb.from('faxes').delete().eq('id', current.id);
        if (error) {
            showMsgBox('MAKULERING FEIL', error.message);
            return;
        }
        if (stackViewIndex > 0 && stackViewIndex >= incomingFaxes.length - 1) {
            stackViewIndex--;
        }
        await refreshIncomingFaxes();
        playRetroSound('key');
    } finally {
        isFaxMachineBusy = false;
    }
}

function resetShredderDom() {
    const paper = document.getElementById('shredPaperSheet');
    const blades = document.getElementById('shredBlades');
    const strips = document.getElementById('shredStrips');
    const shredLedTx = document.getElementById('shredLedTx');
    const shredLedActive = document.getElementById('shredLedActive');

    paper?.classList.remove('phase-feed');
    blades?.classList.remove('active');
    shredLedTx?.classList.remove('lit');
    shredLedActive?.classList.remove('lit');
    if (strips) strips.innerHTML = '';
    if (document.getElementById('shredPaperBody')) {
        document.getElementById('shredPaperBody').textContent = '';
    }
    if (document.getElementById('shredPaperCover')) {
        document.getElementById('shredPaperCover').innerHTML = '';
    }
}

function populateShredStrips() {
    const bin = document.getElementById('shredStrips');
    if (!bin) return;
    bin.innerHTML = '';
    for (let i = 0; i < 14; i++) {
        const strip = document.createElement('div');
        strip.className = 'jitfl-shred-strip';
        strip.style.animationDelay = `${0.9 + (i % 7) * 0.12}s`;
        bin.appendChild(strip);
    }
}

function hideShredderOverlay() {
    document.getElementById('shredderOverlay')?.classList.add('hidden');
    const status = document.getElementById('shredderStatus');
    const hint = document.getElementById('shredderHint');
    const lcd = document.getElementById('shredLcdText');
    if (status) status.innerText = 'STANDBY';
    if (hint) hint.innerText = 'MATER ARK INN I MAKULERER...';
    if (lcd) lcd.textContent = 'MAKULERER';
    resetShredderDom();
}

async function runShredAnimation(fax) {
    const overlay = document.getElementById('shredderOverlay');
    const paper = document.getElementById('shredPaperSheet');
    const blades = document.getElementById('shredBlades');
    const shredLedTx = document.getElementById('shredLedTx');
    const shredLedActive = document.getElementById('shredLedActive');
    const lcd = document.getElementById('shredLcdText');

    resetShredderDom();
    document.getElementById('shredPaperCover').innerHTML = buildFaxCoverHtml(fax);
    document.getElementById('shredPaperBody').textContent = fax.content;

    overlay.classList.remove('hidden');
    if (lcd) lcd.textContent = 'MAKULERER...';
    document.getElementById('shredderStatus').innerText = 'AKTIV';
    document.getElementById('shredderHint').innerText = 'MAKULERER KONFIDENSIELT ARK — 6 SEK';

    playFaxMachineCycle(FAX_SHRED_MS);

    await delay(350);
    paper?.classList.add('phase-feed');
    blades?.classList.add('active');
    shredLedTx?.classList.add('lit');
    shredLedActive?.classList.add('lit');
    populateShredStrips();

    await delay(FAX_SHRED_MS);

    hideShredderOverlay();
    clearFaxSoundCleanup();
}

async function discardTopPaper() {
    await shredTopPaper();
}

async function sendTopToBack() {
    const current = getViewedFax();
    if (!current || incomingFaxes.length <= 1) return;
    const minOrder = Math.min(...incomingFaxes.map(f => f.stack_order));
    const listEl = document.getElementById("paperStackContainer");
    const sheet = listEl.querySelector(`#fax-sheet-${current.id}`);
    if (!sheet) return;

    playRetroSound('reelslide');
    sheet.classList.add('stack-peeled');

    setTimeout(async () => {
        const sb = getSupabase();
        const { error } = await sb.from('faxes').update({ stack_order: minOrder - 1 }).eq('id', current.id);
        if (error) {
            showMsgBox('OPPDATER FEIL', error.message);
            return;
        }
        stackViewIndex = 0;
        await refreshIncomingFaxes();
    }, 400);
}

async function startTransmission() {
    if (isFaxMachineBusy) return;

    updateSendButtonState();

    const match = resolveDialMatch(dialedBuffer);
    if (match.status === 'connected' && match.profile && match.profile.id !== currentProfile.id) {
        activeRecipientStation = match.profile.station_id;
    }

    if (!activeRecipientStation) {
        showMsgBox("INGEN MOTTAKER", "Velg mottaker først: klikk et navn i telefonkatalogen, eller tast faxnummer på tastaturet til venstre.");
        return;
    }

    if (paperCapacity <= 0) {
        const refilled = await promptRefillPaper();
        if (!refilled) return;
    }

    const inputEl = document.getElementById("faxContentInput");
    const text = inputEl.value.trim().toUpperCase();
    const destProfile = match.profile || directoryProfiles.find((p) => p.station_id === activeRecipientStation);

    if (!text) {
        showMsgBox("BLANK SHEET DETECTED", "AVBRUTT: OPTISK SKANNER DETEKTERTE ET BLANKT ARK. SKRIV MELDE-TEKST FØR DU MATER INN ARKET.");
        return;
    }

    if (text.length > MESSAGE_MAX_LENGTH) {
        showMsgBox('FOR LANG MELDING', `Maks ${MESSAGE_MAX_LENGTH} tegn. Forkort meldingen og prøv igjen.`);
        return;
    }

    if (!destProfile) {
        showMsgBox("INGEN MOTTAKER", "Kunne ikke finne mottaker i katalogen.");
        return;
    }

    const sendBtn = document.getElementById('startTransmissionBtn');
    isFaxMachineBusy = true;
    if (sendBtn) sendBtn.disabled = true;

    setAppScreen('send', { skipFaxRefresh: true });

    try {
        initAudio();
        await runFaxSendAnimation(text, destProfile);

        const sb = getSupabase();
        const { error } = await sb.from('faxes').insert({
            sender_user_id: currentProfile.id,
            recipient_station_id: activeRecipientStation,
            content: text,
            stack_order: Date.now()
        });

        inputEl.value = "";
        updateSendButtonState();

        if (error) {
            showMsgBox('TRANSMISSION FEIL', error.message);
            return;
        }

        paperCapacity--;
        updatePaperGauge();

        if (paperCapacity <= 0) {
            await promptRefillPaper();
        }

        showMsgBox('FAX er Sendt', 'Ingen feilmelding på ISDN/WAP-linje99');
        setAppScreen('compose', { skipFaxRefresh: true });
        await refreshIncomingFaxes();
    } finally {
        isFaxMachineBusy = false;
        updateSendButtonState();
    }
}

function showMsgBox(title, text) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMsg').innerText = text;
    document.getElementById('alertActionsSingle').classList.remove('hidden');
    document.getElementById('alertActionsConfirm').classList.add('hidden');
    confirmAlertYesCallback = null;
    confirmAlertNoCallback = null;
    document.getElementById('customAlert').classList.remove('hidden');
    playRetroSound('dtmf', 697, 1209);
}

function confirmAlertYes() {
    const cb = confirmAlertYesCallback;
    document.getElementById('customAlert').classList.add('hidden');
    document.getElementById('alertActionsSingle').classList.remove('hidden');
    document.getElementById('alertActionsConfirm').classList.add('hidden');
    confirmAlertYesCallback = null;
    confirmAlertNoCallback = null;
    playRetroSound('key');
    if (cb) cb();
}

function confirmAlertNo() {
    const cb = confirmAlertNoCallback;
    document.getElementById('customAlert').classList.add('hidden');
    document.getElementById('alertActionsSingle').classList.remove('hidden');
    document.getElementById('alertActionsConfirm').classList.add('hidden');
    confirmAlertYesCallback = null;
    confirmAlertNoCallback = null;
    playRetroSound('key');
    if (cb) cb();
}

function closeAlert() {
    document.getElementById('customAlert').classList.add('hidden');
    document.getElementById('alertActionsSingle').classList.remove('hidden');
    document.getElementById('alertActionsConfirm').classList.add('hidden');
    confirmAlertYesCallback = null;
    confirmAlertNoCallback = null;
    playRetroSound('key');
}
