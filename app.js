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
    bootstrapAuth();
});

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

const DTMF_FREQS = {
    '1': [697, 1209], '2': [697, 1336], '3': [697, 1477],
    '4': [770, 1209], '5': [770, 1336], '6': [770, 1477],
    '7': [852, 1209], '8': [852, 1336], '9': [852, 1477],
    '0': [941, 1336]
};

let directoryProfiles = [];
let incomingFaxes = [];
let dialedBuffer = "";
let activeRecipientStation = null;
let currentMode = "read";
let paperCapacity = 3;
let kartotekIndex = 0;
let stackViewIndex = 0;

async function initFaxApp() {
    const p = currentProfile;
    if (!p) return;

    document.getElementById('sessionUserLabel').innerText = `${p.name} · NR ${p.station_id}`;
    document.getElementById('sessionStationLabel').innerText = `NR ${p.station_id}`;
    document.getElementById('inboxTrayLabel').innerText = `INNKOMMENDE → NR ${p.station_id}`;

    dialedBuffer = "";
    activeRecipientStation = null;
    paperCapacity = 3;
    stackViewIndex = 0;

    await loadDirectory();
    updateUIVariables();
    updatePaperGauge();
    renderKartotek();
    setMode('read');
    await refreshIncomingFaxes();
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

function updateSendButtonState() {
    const btn = document.getElementById('startTransmissionBtn');
    const hint = document.getElementById('sendReadyHint');
    if (!btn || !hint) return;

    const text = (document.getElementById('faxContentInput')?.value || '').trim();
    const match = resolveDialMatch(dialedBuffer);
    const connected = match.status === 'connected' && match.profile && match.profile.id !== currentProfile?.id;

    if (connected) {
        activeRecipientStation = match.profile.station_id;
    } else {
        activeRecipientStation = null;
    }

    if (paperCapacity <= 0) {
        hint.innerText = 'Tomt for papir — klikk «LEGG INN MER PAPIR» først.';
        btn.disabled = true;
        btn.classList.add('opacity-40');
        return;
    }

    if (!connected) {
        hint.innerText = 'Velg mottaker: bla i katalogen og klikk et navn, eller tast faxnummer på tastaturet.';
        btn.disabled = true;
        btn.classList.add('opacity-40');
        return;
    }

    if (!text) {
        hint.innerText = `Koblet til ${match.profile.name.toUpperCase()} (NR ${match.profile.station_id}) — skriv meldingen først.`;
        btn.disabled = true;
        btn.classList.add('opacity-40');
        return;
    }

    hint.innerText = `Klar til sending til ${match.profile.name.toUpperCase()} (NR ${match.profile.station_id}).`;
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

async function refreshIncomingFaxes() {
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
    } else {
        incomingFaxes = data || [];
    }
    if (stackViewIndex >= incomingFaxes.length) {
        stackViewIndex = Math.max(0, incomingFaxes.length - 1);
    }
    renderFaxes();
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
        const translateX = (idx - kartotekIndex) * 15;

        card.className = "kartotek-card absolute w-11/12 max-w-[340px] p-3 text-xs font-mono text-stone-800 transition-all duration-300";
        card.style.zIndex = offsetZ;
        card.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        card.style.opacity = opacity;

        card.innerHTML = `
            <div class="flex justify-between items-center -mt-6 mb-2">
                <span class="bg-[#9e937d] text-stone-100 px-2 py-0.5 font-bold uppercase rounded-t-sm text-[9px] tracking-widest">
                    ${profile.fax_label}
                </span>
                ${profile.id === currentProfile.id ? '<span class="text-[9px] text-[#2b251f] font-bold">[DIN MASKIN]</span>' : ''}
            </div>
            <div class="flex justify-between items-start mt-2">
                <div>
                    <div class="font-extrabold text-sm uppercase text-stone-950">${profile.name}</div>
                    <div class="text-[9px] text-stone-500 uppercase">${profile.description}</div>
                </div>
                <div class="text-right">
                    <span class="bg-stone-900 text-yellow-500 font-extrabold px-2 py-1 rounded text-xs">
                        NR ${profile.station_id}
                    </span>
                </div>
            </div>
        `;

        card.onclick = () => {
            if (profile.id !== currentProfile.id) {
                dialedBuffer = profile.station_id;
                playRetroSound('key');
                updateUIVariables();
                setMode('send');
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

function updateUIVariables() {
    const me = currentProfile;
    document.getElementById("currentSenderLabel").innerText = `${me.name} · NR ${me.station_id}`;
    document.getElementById("telefaxSenderId").innerText = `NR ${me.station_id} (${me.name})`;

    const padded = dialedBuffer.padEnd(2, '_');
    document.getElementById("dialNumberDisplay").innerText = `[ ${padded[0]} ][ ${padded[1]} ]`;

    const { profile: matchedProfile, status } = resolveDialMatch(dialedBuffer);

    if (matchedProfile) {
        if (matchedProfile.id === me.id) {
            document.getElementById("stationMatchInfo").innerHTML = `<span class="text-red-500">LOOP ERROR</span>`;
            document.getElementById("telefaxDestId").innerText = "NOT CONNECTED (SELF)";
            document.getElementById("dialerBlinker").innerText = "LOOPBACK ERROR";
            activeRecipientStation = null;
        } else {
            document.getElementById("stationMatchInfo").innerHTML = `<span class="text-green-400">CONNECT: ${matchedProfile.name.toUpperCase()}</span>`;
            document.getElementById("telefaxDestId").innerText = `NR ${matchedProfile.station_id} (${matchedProfile.name})`;
            document.getElementById("dialerBlinker").innerText = "CONNECTED";
            activeRecipientStation = matchedProfile.station_id;
        }
    } else {
        activeRecipientStation = null;
        document.getElementById("telefaxDestId").innerText = "NOT CONNECTED";
        document.getElementById("dialerBlinker").innerText = "IDLE";
        if (status === 'not_found' && dialedBuffer.length > 0) {
            document.getElementById("stationMatchInfo").innerHTML = `<span class="text-amber-500">NR IKKE FUNNET</span>`;
        } else if (status === 'dialing') {
            document.getElementById("stationMatchInfo").innerText = "RINGER...";
        } else {
            document.getElementById("stationMatchInfo").innerText = dialedBuffer.length > 0 ? "RINGER..." : "INGEN NUMMER VALGT";
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

function reloadPaper() {
    if (paperCapacity === 3) {
        showMsgBox("PAPER TRUNK FULL", "DET ANALOGE PAPIRMAGASINET ER FULLT. DU HAR ALLEREDE 3 ARK TILGJENGELIG.");
        return;
    }
    playRetroSound('reload');
    paperCapacity = 3;
    updatePaperGauge();
    showMsgBox("PAPER RECHARGED", "NY TERMISK RULL MATET INN I SKRIVERHODET. SYSTEMKLAR FOR TRANSMISJON.");
}

function updatePaperGauge() {
    document.getElementById("paperPercentText").innerText = `${paperCapacity} / 3`;
    const container = document.getElementById("paperIndicatorsContainer");
    container.innerHTML = "";

    for (let i = 0; i < 3; i++) {
        const isLit = i < paperCapacity;
        const led = document.createElement("div");
        led.className = `w-full h-3 border border-stone-800 ${isLit ? 'bg-green-500 shadow-[0_0_5px_#22c55e]' : 'bg-stone-700'}`;
        container.appendChild(led);
    }
}

function setMode(mode) {
    currentMode = mode;
    playRetroSound('key');

    const readBtn = document.getElementById("modeBtnRead");
    const sendBtn = document.getElementById("modeBtnSend");
    const readPanel = document.getElementById("readModePanel");
    const sendPanel = document.getElementById("sendModePanel");
    const dialerPanel = document.getElementById("dialerPanel");
    const workspacePanel = document.getElementById("workspacePanel");

    if (mode === 'read') {
        readBtn.classList.add('active');
        sendBtn.classList.remove('active');
        readPanel.classList.remove('hidden');
        sendPanel.classList.add('hidden');
        dialerPanel.classList.add('hidden');
        workspacePanel.classList.remove('lg:col-span-8');
        workspacePanel.classList.add('lg:col-span-12');
        refreshIncomingFaxes();
    } else {
        readBtn.classList.remove('active');
        sendBtn.classList.add('active');
        readPanel.classList.add('hidden');
        sendPanel.classList.remove('hidden');
        dialerPanel.classList.remove('hidden');
        workspacePanel.classList.add('lg:col-span-8');
        workspacePanel.classList.remove('lg:col-span-12');
        updateUIVariables();
    }
}

function formatFaxDate(iso) {
    const date = new Date(iso);
    const day = String(date.getDate()).padStart(2, '0');
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const hour = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${months[date.getMonth()]}-${date.getFullYear()} ${hour}:${min}`;
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
        return;
    }

    thread.forEach((msg, idx) => {
        const senderProfile = directoryProfiles.find(p => p.id === msg.sender_user_id);
        const senderLabel = senderProfile
            ? `${senderProfile.fax_label} // ${senderProfile.name.toUpperCase()}`
            : 'UKJENT AVSENDER';
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
            <div class="border-b border-dashed border-stone-300 pb-2 mb-3 text-[10px] text-stone-500 flex justify-between">
                <span>NR_${senderProfile?.station_id || '??'} // ${escapeHtml(senderLabel)}</span>
                <span>DATE: ${formatFaxDate(msg.created_at)}</span>
            </div>
            <div class="text-xs uppercase leading-relaxed text-left flex-grow break-words tracking-wide" style="font-family: 'Courier Prime', monospace;">
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
}

function getViewedFax() {
    return incomingFaxes[stackViewIndex] || null;
}

async function discardTopPaper() {
    const current = getViewedFax();
    if (!current) return;
    const listEl = document.getElementById("paperStackContainer");
    const sheet = listEl.querySelector(`#fax-sheet-${current.id}`);
    if (!sheet) return;

    playRetroSound('reelslide');
    sheet.style.transform = "translate(500px, -200px) rotate(25deg)";
    sheet.style.opacity = "0";

    setTimeout(async () => {
        const sb = getSupabase();
        const { error } = await sb.from('faxes').delete().eq('id', current.id);
        if (error) showMsgBox('SLETT FEIL', error.message);
        if (stackViewIndex > 0 && stackViewIndex >= incomingFaxes.length - 1) {
            stackViewIndex--;
        }
        await refreshIncomingFaxes();
    }, 400);
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
        showMsgBox("OUT OF THERMAL PAPER", "FEIL: MASKINEN GIKK AKKURAT TOM FOR PAPIR! VENNLIGST KLIKK 'LEGG INN MER PAPIR' KNAPPEN FOR EN NY RULL.");
        return;
    }

    const inputEl = document.getElementById("faxContentInput");
    const text = inputEl.value.trim().toUpperCase();

    if (!text) {
        showMsgBox("BLANK SHEET DETECTED", "AVBRUTT: OPTISK SKANNER DETEKTERTE ET BLANKT ARK. SKRIV MELDE-TEKST FØR DU MATER INN ARKET.");
        return;
    }

    const overlay = document.getElementById("transmittingOverlay");
    const progress = document.getElementById("transmissionProgress");
    const header = document.getElementById("transmissionHeader");
    const log = document.getElementById("transmissionLog");

    overlay.classList.remove("hidden");
    progress.style.width = "0%";
    header.innerText = "COAX DIALING...";
    log.innerHTML = "<div>[SYS] COUPLER RELAY DETECTED...</div>";

    playScreamingFaxHandshake();

    const steps = [
        { time: 600, label: "COMMENCING MODEM HANDSHAKE...", progress: 20 },
        { time: 1300, label: "SENDING 1100Hz CALLING TONE (CNG)...", progress: 40 },
        { time: 2100, label: "RECEIVING 2100Hz ANSWERBACK (CED)...", progress: 60 },
        { time: 3000, label: "SYNCHRONIZING BAUD RATE SPECTRUMS...", progress: 75 },
        { time: 4200, label: "TRANSMITTING OPTICAL SHEET BUFFER...", progress: 90 },
        { time: 5100, label: "TRANSMISSION SUCCESSFUL (OK)", progress: 100 }
    ];

    steps.forEach(step => {
        setTimeout(() => {
            header.innerText = step.label;
            progress.style.width = `${step.progress}%`;
            log.innerHTML += `<div>[OK] ${step.label}</div>`;
        }, step.time);
    });

    setTimeout(async () => {
        const sb = getSupabase();
        const { error } = await sb.from('faxes').insert({
            sender_user_id: currentProfile.id,
            recipient_station_id: activeRecipientStation,
            content: text,
            stack_order: Date.now()
        });

        overlay.classList.add("hidden");
        inputEl.value = "";

        if (error) {
            showMsgBox('TRANSMISSION FEIL', error.message);
            return;
        }

        paperCapacity--;
        updatePaperGauge();
        setMode('read');

        let printStep = 0;
        const interval = setInterval(() => {
            if (printStep < 4) {
                playRetroSound('type');
                printStep++;
            } else {
                clearInterval(interval);
            }
        }, 200);
    }, 5500);
}

function showMsgBox(title, text) {
    document.getElementById("alertTitle").innerText = title;
    document.getElementById("alertMsg").innerText = text;
    document.getElementById("customAlert").classList.remove("hidden");
    playRetroSound('dtmf', 697, 1209);
}

function closeAlert() {
    document.getElementById("customAlert").classList.add("hidden");
    playRetroSound('key');
}
