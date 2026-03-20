const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Mock product catalog – Azure cloud services used in this lab
const products = [
  {
    id: 1,
    name: 'Azure Container Apps',
    category: 'Containers',
    description: 'Serverless container hosting – used to run the Gateway Service',
    price: 0.000024,
    unit: 'per vCPU-second',
    status: 'active',
  },
  {
    id: 2,
    name: 'Azure Container Registry',
    category: 'Containers',
    description: 'Private Docker image registry – stores gateway and products images',
    price: 0.167,
    unit: 'per day (Basic SKU)',
    status: 'active',
  },
  {
    id: 3,
    name: 'Azure Static Web Apps',
    category: 'Web',
    description: 'Managed hosting for static frontends with global CDN',
    price: 0.0,
    unit: 'free tier',
    status: 'active',
  },
  {
    id: 4,
    name: 'Azure Virtual Machine',
    category: 'Compute',
    description: 'General-purpose IaaS compute for custom workloads',
    price: 0.096,
    unit: 'per hour (B2s)',
    status: 'active',
  },
  {
    id: 5,
    name: 'Azure Blob Storage',
    category: 'Storage',
    description: 'Scalable object storage for unstructured data',
    price: 0.018,
    unit: 'per GB/month',
    status: 'active',
  },
  {
    id: 6,
    name: 'Azure Monitor',
    category: 'Observability',
    description: 'Full-stack monitoring, alerting and log analytics',
    price: 0.258,
    unit: 'per GB ingested',
    status: 'active',
  },
];

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'products-service',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// List all products
app.get('/products', (req, res) => {
  const { category } = req.query;
  const data = category
    ? products.filter((p) => p.category.toLowerCase() === category.toLowerCase())
    : products;
  res.json({ success: true, count: data.length, data });
});

// Get single product by id
app.get('/products/:id', (req, res) => {
  const product = products.find((p) => p.id === parseInt(req.params.id, 10));
  if (!product) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  res.json({ success: true, data: product });
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
  console.log(`Products service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});
