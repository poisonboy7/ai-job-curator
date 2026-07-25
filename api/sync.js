const requestCounters = new Map();

function getPositiveInteger(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getClientIp(req) {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string') {
        return forwardedFor.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
}

function isRateLimited(ip, maxRequests, windowMs) {
    const now = Date.now();
    const current = requestCounters.get(ip);

    if (!current || current.resetAt <= now) {
        requestCounters.set(ip, { count: 1, resetAt: now + windowMs });
        return false;
    }

    current.count += 1;
    return current.count > maxRequests;
}

function isValidEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
        return res.status(415).json({ message: 'JSON 요청만 허용됩니다.' });
    }

    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    const requestOrigin = req.headers.origin;

    if (allowedOrigins.length > 0 && !allowedOrigins.includes(requestOrigin)) {
        return res.status(403).json({ message: '허용되지 않은 요청 출처입니다.' });
    }

    const maxRequests = getPositiveInteger(process.env.RATE_LIMIT_MAX, 10);
    const rateLimitWindowMs = getPositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, 60_000);
    if (isRateLimited(getClientIp(req), maxRequests, rateLimitWindowMs)) {
        return res.status(429).json({ message: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const payload = req.body;
    const serializedPayload = JSON.stringify(payload ?? {});
    const maxBodyBytes = getPositiveInteger(process.env.MAX_BODY_BYTES, 4_500_000);

    if (Buffer.byteLength(serializedPayload, 'utf8') > maxBodyBytes) {
        return res.status(413).json({ message: '업로드 데이터가 너무 큽니다.' });
    }

    if (!payload || !isValidEmail(payload.email)) {
        return res.status(400).json({ message: '올바른 이메일 주소가 필요합니다.' });
    }

    const isUnsubscribe = payload.subscribe === false || payload.subscribe === 'false';
    if (!isUnsubscribe) {
        if (typeof payload.address !== 'string' || !payload.address.trim()) {
            return res.status(400).json({ message: '희망 기준 주소가 필요합니다.' });
        }
        if (typeof payload.resume?.text_content !== 'string' || !payload.resume.text_content.trim()) {
            return res.status(400).json({ message: '이력서 텍스트가 필요합니다.' });
        }
    }

    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
        return res.status(500).json({ message: '서버에 WEBHOOK_URL이 설정되지 않았습니다.' });
    }

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: serializedPayload,
            signal: AbortSignal.timeout(30_000)
        });

        const responseText = await response.text();
        let data;
        try {
            data = responseText ? JSON.parse(responseText) : {};
        } catch {
            data = { message: responseText || '웹훅에서 빈 응답을 반환했습니다.' };
        }

        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Webhook proxy error:', error instanceof Error ? error.message : error);
        return res.status(502).json({ message: '내부 자동화 서버와 연결하지 못했습니다.' });
    }
}
