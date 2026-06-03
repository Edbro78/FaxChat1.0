const FAX_USERNAME_PATTERN = /^[A-Za-z][A-Za-z0-9]*\d{2}$/;

function parseFaxUsername(input) {
    const raw = (input || '').trim();
    if (!FAX_USERNAME_PATTERN.test(raw)) return null;

    const match = raw.match(/^([A-Za-z][A-Za-z0-9]*)(\d{2})$/);
    const nameRaw = match[1];
    const stationId = match[2];
    const name = nameRaw.charAt(0).toUpperCase() + nameRaw.slice(1).toLowerCase();
    const username = name + stationId;

    return { name, stationId, username, faxLabel: username };
}

module.exports = { parseFaxUsername, FAX_USERNAME_PATTERN };
