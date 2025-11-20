const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  console.log('[setupProxy] ===== PROXY SETUP STARTING =====');
  console.log('[setupProxy] Setting up proxy for /activity -> https://data-api.polymarket.com');
  
  const proxyMiddleware = createProxyMiddleware({
    target: 'https://data-api.polymarket.com',
    changeOrigin: true,
    secure: true,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
      console.log('[Proxy] >>> Forwarding:', req.method, req.url);
      console.log('[Proxy] >>> To:', proxyReq.path);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log('[Proxy] <<< Response:', proxyRes.statusCode, 'for', req.url);
    },
    onError: (err, req, res) => {
      console.error('[Proxy] ERROR proxying', req.url, ':', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Proxy error', message: err.message });
      }
    },
  });
  
  app.use('/activity', proxyMiddleware);
  console.log('[setupProxy] ===== PROXY CONFIGURED SUCCESSFULLY =====');
};

