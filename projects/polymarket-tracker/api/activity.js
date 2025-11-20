// Vercel Serverless Function - Proxy to Polymarket Data API
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Forward query parameters
    const queryString = new URLSearchParams(req.query).toString();
    const targetUrl = `https://data-api.polymarket.com/activity?${queryString}`;
    
    console.log(`[Proxy] Activity Request: ${targetUrl}`);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!response.ok) {
      console.error(`[Proxy] Activity Response ${response.status}`);
      return res.status(response.status).json({ error: 'Failed to fetch activity data' });
    }

    const data = await response.json();
    console.log(`[Proxy] Activity Response 200 - ${data.length} items`);
    
    return res.status(200).json(data);
  } catch (error) {
    console.error(`[Proxy] Activity Error:`, error.message);
    return res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}

