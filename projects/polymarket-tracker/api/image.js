// Vercel Serverless Function - Proxy images to avoid CORS issues
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  try {
    console.log(`[Proxy] Image Request: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://polymarket.com/',
        'Origin': 'https://polymarket.com',
      },
    });

    if (!response.ok) {
      console.error(`[Proxy] Image Response ${response.status}`);
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    // Get image buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Set content type from response or default to jpeg
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    
    console.log(`[Proxy] Image Response 200 - ${buffer.length} bytes`);
    
    return res.status(200).send(buffer);
  } catch (error) {
    console.error(`[Proxy] Image Error:`, error.message);
    return res.status(500).json({ error: 'Failed to fetch image', message: error.message });
  }
}

