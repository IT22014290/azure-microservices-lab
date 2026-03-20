const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// URL of the products backend microservice (set via env var in Container Apps)
const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// ── Proxy routes (must be registered before direct routes) ──────────────────

if (PRODUCTS_SERVICE_URL) {
  // Forward /api/products/* → products-service /products/*
  app.use(
    '/api/products',
    createProxyMiddleware({
      target: PRODUCTS_SERVICE_URL,
      changeOrigin: true,
      pathRewrite: { '^/api/products': '/products' },
      onError: (err, req, res) => {
        console.error('Proxy error (products-service):', err.message);
        res.status(502).json({
          error: 'Products service unavailable',
          message: err.message,
        });
      },
    })
  );
} else {
  // Placeholder when products service URL is not configured
  app.get('/api/products*', (req, res) => {
    res.status(503).json({
      error: 'Products service not configured',
      hint: 'Set the PRODUCTS_SERVICE_URL environment variable on the gateway Container App',
    });
  });
}

// ── Direct gateway routes ───────────────────────────────────────────────────

// Root – service info
app.get('/', (req, res) => {
  res.json({
    service: 'Gateway Service',
    version: '2.0.0',
    description: 'API Gateway for Azure Microservices Lab',
    endpoints: [
      { method: 'GET', path: '/',                   description: 'Service info' },
      { method: 'GET', path: '/health',             description: 'Health check' },
      { method: 'GET', path: '/api/info',           description: 'API information' },
      { method: 'GET', path: '/api/services',       description: 'List available services' },
      { method: 'GET', path: '/api/products',       description: 'List all products (proxied to products-service)' },
      { method: 'GET', path: '/api/products/:id',   description: 'Get product by ID (proxied to products-service)' },
    ],
  });
});

// Health check endpoint (required by lab Task 6)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'production',
    productsServiceConfigured: !!PRODUCTS_SERVICE_URL,
  });
});

// API info
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Azure Microservices Lab – Gateway',
    version: '2.0.0',
    region: process.env.AZURE_REGION || 'eastus',
    runtime: `Node.js ${process.version}`,
    productsServiceUrl: PRODUCTS_SERVICE_URL || 'not configured',
  });
});

// List available services
app.get('/api/services', (req, res) => {
  res.json({
    services: [
      {
        name: 'gateway',
        status: 'running',
        type: 'Azure Container App',
        description: 'Routes incoming HTTP requests to backend microservices',
      },
      {
        name: 'products-service',
        status: PRODUCTS_SERVICE_URL ? 'running' : 'not configured',
        type: 'Azure Container App',
        description: 'Backend microservice – serves the product catalog via /api/products',
      },
      {
        name: 'frontend',
        status: 'running',
        type: 'Azure Static Web App',
        description: 'Serves the React frontend to end users',
      },
    ],
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Gateway service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Products service URL: ${PRODUCTS_SERVICE_URL || 'NOT CONFIGURED'}`);
});
