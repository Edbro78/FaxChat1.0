/* FaxChat service worker v8 — pushvarsler (PWA fra hjemskjerm) */

const SW_VERSION = 8;

self.addEventListener('install', (event) => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

function formatKl(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Oslo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hour}${minute}`;
}

function displaySenderName(name) {
    if (!name) return 'Ukjent';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/** Bygg varseltekst uten å vise fax-innhold — ignorerer payload.body som visningskilde. */
function buildPushHeadline(payload) {
    if (payload.senderName && payload.timeKl) {
        return `Ny FAX fra ${displaySenderName(payload.senderName)} kl ${payload.timeKl}`;
    }

    const body = (payload.body || '').trim();
    if (/^Ny FAX fra .+ kl \d{4}$/i.test(body)) {
        return body;
    }

    const colon = body.indexOf(': ');
    if (colon > 0) {
        const header = body.slice(0, colon).trim();
        const namePart = header.replace(/\s*\(NR\s+\d+\)\s*$/i, '').trim();
        if (namePart) {
            const senderName = displaySenderName(namePart);
            const timeKl = payload.timeKl || formatKl(new Date());
            return `Ny FAX fra ${senderName} kl ${timeKl}`;
        }
    }

    return 'Ny FAX mottatt — åpne FaxChat for å lese.';
}

self.addEventListener('push', (event) => {
    let payload = { title: 'NY FAX MOTTATT', url: '/' };
    try {
        if (event.data) {
            payload = { ...payload, ...event.data.json() };
        }
    } catch (_) { /* ignore */ }

    const headline = buildPushHeadline(payload);

    event.waitUntil(
        self.registration.showNotification(headline, {
            body: '',
            icon: payload.icon || '/assets/icon-192.png',
            badge: payload.badge || '/assets/icon-192.png',
            tag: payload.tag || 'faxchat-incoming',
            renotify: true,
            data: { url: payload.url || '/', swVersion: SW_VERSION },
            vibrate: [120, 60, 120]
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
