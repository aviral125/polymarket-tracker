// Local development proxy configuration
// This file is used by create-react-app's dev server to proxy API requests
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // Proxy /api/activity to data-api.polymarket.com
  app.use(
    '/api/activity',
    createProxyMiddleware({
      target: 'https://data-api.polymarket.com',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '',
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      },
    })
  );

  // Proxy /api/profile to polymarket.com
  app.use(
    '/api/profile',
    createProxyMiddleware({
      target: 'https://polymarket.com',
      changeOrigin: true,
      pathRewrite: (path, req) => {
        const address = new URL(req.url, 'http://localhost').searchParams.get('address');
        return `/api/profile/userData?address=${address}`;
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
        proxyReq.setHeader('Referer', 'https://polymarket.com/');
        proxyReq.setHeader('Origin', 'https://polymarket.com');
      },
    })
  );

  // Proxy /api/image for CORS-free image loading
  app.use(
    '/api/image',
    createProxyMiddleware({
      target: 'https://polymarket-upload.s3.us-east-2.amazonaws.com',
      changeOrigin: true,
      pathRewrite: (path, req) => {
        const imageUrl = new URL(req.url, 'http://localhost').searchParams.get('url');
        if (imageUrl) {
          return new URL(imageUrl).pathname;
        }
        return '/';
      },
      onProxyReq: (proxyReq) => {
        proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');
      },
      onProxyRes: (proxyRes, req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
      },
    })
  );
};

