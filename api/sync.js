// api/sync.js
export default async function handler(req, res) {
    // POST 요청이 아니면 커트
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // 💡 브라우저가 아닌 Vercel '백엔드 서버' 구역이므로 여기서는 process.env를 안전하게 읽을 수 있습니다.
    const REAL_WEBHOOK_URL = process.env.WEBHOOK_URL; 

    if (!REAL_WEBHOOK_URL) {
        return res.status(500).json({ message: 'Vercel 대시보드에 WEBHOOK_URL이 등록되지 않았습니다.' });
    }

    try {
        // 프론트엔드에서 보낸 데이터를 그대로 받아서 진짜 ngrok 주소로 토스
        const response = await fetch(REAL_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: '내부 프록시 서버 연동 중 에러가 발생했습니다.' });
    }
}