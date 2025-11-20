const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Enable CORS
app.use(cors());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Proxy server is running' });
});

    // Proxy endpoint
    app.use('/api/profile', createProxyMiddleware({
      target: 'https://polymarket.com',
      changeOrigin: true,
      secure: true,
      pathRewrite: (path, req) => {
        const address = req.query.address;
        return `/api/profile/userData?address=${address}`;
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] Profile Request: ${req.url} -> https://polymarket.com/api/profile/userData`);
        // Add headers to mimic a browser request to avoid potential blocks
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        proxyReq.setHeader('Referer', 'https://polymarket.com/');
        proxyReq.setHeader('Origin', 'https://polymarket.com');
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log(`[Proxy] Profile Response ${proxyRes.statusCode}`);
      }
    }));

    app.use('/api', createProxyMiddleware({
  target: 'https://data-api.polymarket.com',
  changeOrigin: true,
  secure: true,
  timeout: 30000,
  pathRewrite: {
    '^/api': '', // Remove /api prefix
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] ${req.method} ${req.url} -> ${proxyReq.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Proxy] Response ${proxyRes.statusCode} for ${req.url}`);
  },
  onError: (err, req, res) => {
    console.error(`[Proxy] Error:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Proxy error', message: err.message });
    }
  },
}));

app.listen(PORT, () => {
  console.log(`✅ Proxy server running on http://localhost:${PORT}`);
  console.log(`✅ Proxying /api/* to https://data-api.polymarket.com/*`);
  console.log(`✅ Health check: http://localhost:${PORT}/health`);
});

