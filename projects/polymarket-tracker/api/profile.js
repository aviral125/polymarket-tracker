// Vercel Serverless Function - Proxy to Polymarket Profile API
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ error: 'Missing address parameter' });
  }

  try {
    const targetUrl = `https://polymarket.com/api/profile/userData?address=${address}`;
    
    console.log(`[Proxy] Profile Request: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://polymarket.com/',
        'Origin': 'https://polymarket.com',
      },
    });

    if (!response.ok) {
      console.error(`[Proxy] Profile Response ${response.status}`);
      return res.status(response.status).json({ error: 'Failed to fetch profile data' });
    }

    const data = await response.json();
    console.log(`[Proxy] Profile Response 200`);
    
    return res.status(200).json(data);
  } catch (error) {
    console.error(`[Proxy] Profile Error:`, error.message);
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}

