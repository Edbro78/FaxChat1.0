/* FaxChat service worker — pushvarsler (PWA fra hjemskjerm) */

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

/** Vis aldri fax-innhold i varselet — kun avsender og klokkeslett. */
function safeNotificationBody(payload) {
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
        const senderName = displaySenderName(namePart);
        const timeKl = payload.timeKl || formatKl(new Date());
        return `Ny FAX fra ${senderName} kl ${timeKl}`;
    }

    return 'Ny FAX mottatt — åpne FaxChat for å lese.';
}

self.addEventListener('push', (event) => {
    let payload = { title: 'NY FAX MOTTATT', body: 'Åpne FaxChat for å lese.', url: '/' };
    try {
        if (event.data) {
            payload = { ...payload, ...event.data.json() };
        }
    } catch (_) { /* ignore */ }

    const options = {
        body: safeNotificationBody(payload),
        icon: payload.icon || '/assets/fax-machine.png',
        badge: payload.badge || '/assets/fax-machine.png',
        tag: payload.tag || 'faxchat-incoming',
        renotify: true,
        data: { url: payload.url || '/' },
        vibrate: [120, 60, 120]
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
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
