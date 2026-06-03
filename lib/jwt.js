const crypto = require('crypto');

function base64url(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function signSupabaseJwt(userId, jwtSecret, expiresInSec = 60 * 60 * 24 * 7) {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = base64url(JSON.stringify({
        aud: 'authenticated',
        exp: now + expiresInSec,
        iat: now,
        sub: userId,
        role: 'authenticated'
    }));
    const data = `${header}.${payload}`;
    const signature = crypto
        .createHmac('sha256', jwtSecret)
        .update(data)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    return `${data}.${signature}`;
}

module.exports = { signSupabaseJwt };
