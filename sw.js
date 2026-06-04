/* FaxChat service worker — pushvarsler (PWA fra hjemskjerm) */

self.addEventListener('push', (event) => {
    let payload = { title: 'NY FAX MOTTATT', body: 'Åpne FaxChat for å lese.', url: '/' };
    try {
        if (event.data) {
            payload = { ...payload, ...event.data.json() };
        }
    } catch (_) { /* ignore */ }

    const options = {
        body: payload.body,
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
