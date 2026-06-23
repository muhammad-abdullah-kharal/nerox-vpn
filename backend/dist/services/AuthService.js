"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const db_1 = __importDefault(require("../config/db"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const DEFAULT_GOOGLE_WEB_CLIENT_ID = '595221930597-pj8dta32veg34qvtnp4u9jjlt1b51aft.apps.googleusercontent.com';
const DEFAULT_APPLE_CLIENT_ID = 'org.reactjs.native.example.Nerox';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';
const jwksCache = {};
const getEnvList = (...names) => {
    const values = names.flatMap(name => (process.env[name] || '').split(','));
    return values.map(value => value.trim()).filter(Boolean);
};
const getAllowedGoogleClientIds = () => {
    const configured = getEnvList('GOOGLE_CLIENT_IDS', 'GOOGLE_WEB_CLIENT_ID');
    return configured.length ? configured : [DEFAULT_GOOGLE_WEB_CLIENT_ID];
};
const getAllowedAppleClientIds = () => {
    const configured = getEnvList('APPLE_CLIENT_IDS', 'APPLE_CLIENT_ID', 'APPLE_BUNDLE_ID');
    return configured.length ? configured : [DEFAULT_APPLE_CLIENT_ID];
};
const fetchJwks = async (url) => {
    const cached = jwksCache[url];
    if (cached && cached.expiresAt > Date.now()) {
        return cached.keys;
    }
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Could not fetch provider signing keys (${response.status}).`);
    }
    const body = (await response.json());
    if (!Array.isArray(body.keys)) {
        throw new Error('Provider signing keys response was invalid.');
    }
    jwksCache[url] = {
        expiresAt: Date.now() + 60 * 60 * 1000,
        keys: body.keys,
    };
    return body.keys;
};
const getPublicKeyForToken = async (token, jwksUrl) => {
    const decoded = jsonwebtoken_1.default.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
        throw new Error('Identity token header is invalid.');
    }
    const keys = await fetchJwks(jwksUrl);
    let jwk = keys.find(key => key.kid === decoded.header.kid);
    if (!jwk) {
        delete jwksCache[jwksUrl];
        const refreshedKeys = await fetchJwks(jwksUrl);
        jwk = refreshedKeys.find(key => key.kid === decoded.header.kid);
    }
    if (!jwk) {
        throw new Error('No matching provider signing key was found.');
    }
    const keyObject = crypto_1.default.createPublicKey({ key: jwk, format: 'jwk' });
    return keyObject.export({ type: 'spki', format: 'pem' });
};
const verifyProviderJwt = async (token, jwksUrl, audience, issuer) => {
    const publicKey = await getPublicKeyForToken(token, jwksUrl);
    const jwtAudience = audience.length === 1 ? audience[0] : audience;
    const jwtIssuer = Array.isArray(issuer) && issuer.length > 1
        ? issuer
        : Array.isArray(issuer)
            ? issuer[0]
            : issuer;
    const payload = jsonwebtoken_1.default.verify(token, publicKey, {
        algorithms: ['RS256'],
        audience: jwtAudience,
        issuer: jwtIssuer,
        clockTolerance: 10,
    });
    if (!payload || typeof payload === 'string') {
        throw new Error('Identity token payload is invalid.');
    }
    return payload;
};
const isTrueClaim = (value) => value === true || value === 'true';
const verifyGoogleToken = async (idToken) => {
    const payload = await verifyProviderJwt(idToken, GOOGLE_JWKS_URL, getAllowedGoogleClientIds(), ['accounts.google.com', 'https://accounts.google.com']);
    if (!payload.sub) {
        throw new Error('Google identity token is missing a subject.');
    }
    if (!isTrueClaim(payload.email_verified)) {
        throw new Error('Google account email is not verified.');
    }
    return {
        provider: 'google',
        subject: payload.sub,
        email: typeof payload.email === 'string'
            ? payload.email.toLowerCase().trim()
            : undefined,
        emailVerified: true,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        picture: typeof payload.picture === 'string' ? payload.picture : undefined,
    };
};
const verifyAppleToken = async (identityToken, rawNonce) => {
    const payload = await verifyProviderJwt(identityToken, APPLE_JWKS_URL, getAllowedAppleClientIds(), 'https://appleid.apple.com');
    if (!payload.sub) {
        throw new Error('Apple identity token is missing a subject.');
    }
    if (rawNonce) {
        const expectedNonce = crypto_1.default
            .createHash('sha256')
            .update(rawNonce)
            .digest('hex');
        if (!payload.nonce ||
            (payload.nonce !== expectedNonce && payload.nonce !== rawNonce)) {
            throw new Error('Apple identity token nonce is invalid.');
        }
    }
    return {
        provider: 'apple',
        subject: payload.sub,
        email: typeof payload.email === 'string'
            ? payload.email.toLowerCase().trim()
            : undefined,
        emailVerified: payload.email_verified === undefined ||
            isTrueClaim(payload.email_verified),
    };
};
const createAuthToken = (userId, role) => jsonwebtoken_1.default.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: '30d',
});
const sendResendEmail = async (to, subject, text) => {
    const apiKey = process.env.RESEND_API_KEY || process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@neroxvpn.com';
    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: `Nerox VPN <${from}>`,
            to: [to],
            subject,
            text,
        }),
    });
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Resend API Error: ${response.status} ${errorBody}`);
    }
};
class AuthService {
    static normalizeUsernameSeed(seed) {
        const normalized = seed
            .toLowerCase()
            .replace(/[^a-z0-9_]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 24);
        return normalized || 'user';
    }
    static async generateUniqueUsername(client, seed) {
        const base = this.normalizeUsernameSeed(seed);
        for (let attempt = 0; attempt < 6; attempt += 1) {
            const suffix = attempt === 0 ? '' : `_${Math.random().toString(36).substring(2, 6)}`;
            const candidate = `${base}${suffix}`.slice(0, 32);
            const existing = await client.query('SELECT 1 FROM users WHERE username = $1', [candidate]);
            if (existing.rows.length === 0) {
                return candidate;
            }
        }
        return `${base}_${Date.now().toString(36)}`.slice(0, 40);
    }
    // ─── Register (Sign Up) ───────────────────────────────────────────────
    static async register(email, password, username, referralCodeApplied) {
        // Check if email already exists
        const existing = await db_1.default.query('SELECT user_id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            throw new Error('An account with this email already exists.');
        }
        const referralCode = Math.random()
            .toString(36)
            .substring(2, 10)
            .toUpperCase();
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const passwordHash = await bcryptjs_1.default.hash(password, 10);
        const { rows } = await db_1.default.query(`INSERT INTO users (username, email, password_hash, plan_type, trial_ends_at, referral_code, is_verified, verification_code, verification_expires_at)
       VALUES ($1, $2, $3, 'free', NOW() + INTERVAL '7 days', $4, false, $5, NOW() + INTERVAL '15 minutes')
       RETURNING user_id, role, email`, [username, email, passwordHash, referralCode, verificationCode]);
        const user = rows[0];
        // Handle incoming referral code
        if (referralCodeApplied) {
            try {
                const { ReferralService } = require('./ReferralService');
                await ReferralService.applyReferral(user.user_id, referralCodeApplied);
            }
            catch (err) {
                console.warn(`[AuthService] Could not apply referral code ${referralCodeApplied}:`, err);
                // We don't block registration if referral fails
            }
        }
        try {
            await sendResendEmail(email, 'Verify your Nerox VPN Account', `Your verification code is: ${verificationCode}\n\nIt expires in 15 minutes.`);
        }
        catch (err) {
            console.warn('[AuthService] Failed to send verification email', err);
        }
        return { requireVerification: true, email: user.email };
    }
    // ─── Login (Sign In) ──────────────────────────────────────────────────
    static async login(email, passwordRaw) {
        const { rows } = await db_1.default.query('SELECT user_id, password_hash, is_verified, locked_until, role FROM users WHERE email = $1', [email]);
        if (rows.length === 0) {
            throw new Error('No account found with this email.');
        }
        const user = rows[0];
        // Check if account is locked
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
            throw new Error(`Account is locked due to too many failed attempts. Try again in ${remainingMinutes} minutes.`);
        }
        const isValid = await bcryptjs_1.default.compare(passwordRaw, user.password_hash);
        if (!isValid) {
            // Logic to increment failed attempts could go here
            throw new Error('Invalid email or password.');
        }
        if (!user.is_verified) {
            // Send an OTP and require verification before letting them login fully
            await this.sendOtp(email);
            return { requireVerification: true, email };
        }
        // Fully verified and correct password, generate token
        const token = createAuthToken(user.user_id, user.role);
        return { token };
    }
    static async socialLogin(provider, token, userInput, rawNonce, deviceInfo) {
        const profile = provider === 'google'
            ? await verifyGoogleToken(token)
            : await verifyAppleToken(token, rawNonce);
        const providerColumn = provider === 'google' ? 'google_sub' : 'apple_sub';
        const email = (profile.email || userInput?.email || '')
            .toLowerCase()
            .trim();
        const displayName = profile.name ||
            userInput?.name ||
            (email
                ? email.split('@')[0]
                : `${provider}_${profile.subject.slice(0, 8)}`);
        const avatarUrl = profile.picture || userInput?.photo || null;
        const client = await db_1.default.connect();
        let user = null;
        let isNewUser = false;
        try {
            await client.query('BEGIN');
            const byProvider = await client.query(`SELECT user_id, role FROM users WHERE ${providerColumn} = $1`, [profile.subject]);
            user = byProvider.rows[0] || null;
            if (!user && email) {
                const byEmail = await client.query('SELECT user_id, role FROM users WHERE email = $1', [email]);
                user = byEmail.rows[0] || null;
            }
            if (user) {
                await client.query(`UPDATE users
             SET ${providerColumn} = COALESCE(${providerColumn}, $1),
                 is_verified = true,
                 verification_code = NULL,
                 verification_expires_at = NULL,
                 display_name = COALESCE(display_name, $2),
                 avatar_url = COALESCE(avatar_url, $3),
                 last_login_provider = $4,
                 updated_at = NOW()
           WHERE user_id = $5`, [profile.subject, displayName, avatarUrl, provider, user.user_id]);
            }
            else {
                if (!email) {
                    throw new Error('Apple did not return an email address. Please share your email on first sign in and try again.');
                }
                const referralCode = Math.random()
                    .toString(36)
                    .substring(2, 10)
                    .toUpperCase();
                const username = await this.generateUniqueUsername(client, displayName || email);
                const { rows } = await client.query(`INSERT INTO users (
             username,
             display_name,
             email,
             password_hash,
             plan_type,
             trial_ends_at,
             referral_code,
             is_verified,
             verification_code,
             verification_expires_at,
             ${providerColumn},
             last_login_provider,
             avatar_url
           )
           VALUES ($1, $2, $3, NULL, 'free', NOW() + INTERVAL '7 days', $4, true, NULL, NULL, $5, $6, $7)
           RETURNING user_id, role`, [
                    username,
                    displayName,
                    email,
                    referralCode,
                    profile.subject,
                    provider,
                    avatarUrl,
                ]);
                user = rows[0];
                isNewUser = true;
            }
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
        if (!user) {
            throw new Error('Could not create or load the social account.');
        }
        await this.registerDevice(user.user_id, deviceInfo);
        return {
            token: createAuthToken(user.user_id, user.role),
            isNewUser,
        };
    }
    static async sendOtp(email) {
        const { rows } = await db_1.default.query('SELECT user_id, is_verified FROM users WHERE email = $1', [email]);
        if (rows.length === 0)
            throw new Error('No account found with this email.');
        const user = rows[0];
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        await db_1.default.query(`UPDATE users SET verification_code = $1, verification_expires_at = NOW() + INTERVAL '15 minutes' WHERE user_id = $2`, [verificationCode, user.user_id]);
        try {
            await sendResendEmail(email, 'Verify your Nerox VPN Account', `Your verification code is: ${verificationCode}\n\nIt expires in 15 minutes.`);
        }
        catch (err) {
            console.warn('Failed to send verification email', err);
            throw new Error('Failed to send verification email. Please try again or check your SMTP configuration.');
        }
        return { success: true, requireVerification: true };
    }
    static async verifyOtp(email, code) {
        const { rows } = await db_1.default.query('SELECT user_id, verification_code, verification_expires_at, role FROM users WHERE email = $1', [email]);
        if (rows.length === 0)
            throw new Error('No account found with this email.');
        const user = rows[0];
        if (!user.verification_code || user.verification_code !== code) {
            throw new Error('Invalid verification code.');
        }
        if (new Date(user.verification_expires_at) < new Date()) {
            throw new Error('Verification code has expired. Please request a new one.');
        }
        await db_1.default.query('UPDATE users SET is_verified = true, verification_code = NULL, verification_expires_at = NULL WHERE user_id = $1', [user.user_id]);
        return createAuthToken(user.user_id, user.role);
    }
    static async resetPassword(userId, newPasswordRaw) {
        const newPasswordHash = await bcryptjs_1.default.hash(newPasswordRaw, 10);
        await db_1.default.query('UPDATE users SET password_hash = $1, failed_attempts = 0, locked_until = NULL WHERE user_id = $2', [newPasswordHash, userId]);
    }
    static async registerDevice(userId, deviceInfo) {
        if (!deviceInfo || !deviceInfo.deviceId)
            return;
        await db_1.default.query(`INSERT INTO user_devices (user_id, device_id, model, os, last_active_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, device_id) DO UPDATE SET 
         model = EXCLUDED.model, 
         os = EXCLUDED.os, 
         last_active_at = NOW()`, [userId, deviceInfo.deviceId, deviceInfo.model, deviceInfo.os]);
    }
}
exports.AuthService = AuthService;
