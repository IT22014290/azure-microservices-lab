# Azure Microservices Lab — SE4010 (SLIIT 2026)
### Complete Lab Documentation

---

**Name:** Samishka H T
**ID No:** IT22014290
**Repo Link:** [https://github.com/IT22014290/azure-microservices-lab](https://github.com/IT22014290/azure-microservices-lab)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Project Structure](#3-project-structure)
4. [Source Code](#4-source-code)
   - 4.1 [Gateway Service](#41-gateway-service)
   - 4.2 [Products Service](#42-products-service)
   - 4.3 [Frontend (React)](#43-frontend-react)
5. [Docker Configuration](#5-docker-configuration)
6. [CI/CD Pipeline (GitHub Actions)](#6-cicd-pipeline-github-actions)
7. [Local Development Setup](#7-local-development-setup)
8. [Azure Deployment — Step by Step](#8-azure-deployment--step-by-step)
   - Task 1: Login to Azure
   - Task 2: Resource Group & Container Registry
   - Task 3: Build & Push Docker Images
   - Task 4: Deploy Container Apps
   - Task 5: Deploy Static Web App
   - Task 6: Verify & Cleanup
9. [API Reference](#9-api-reference)
10. [Screenshots](#10-screenshots)

---

## 1. Project Overview

This lab demonstrates a complete **cloud-native three-tier microservices architecture** deployed on Microsoft Azure. The application consists of:

- A **React frontend** hosted on Azure Static Web Apps
- An **API Gateway** service running on Azure Container Apps
- A **Products microservice** running on Azure Container Apps (internal only)
- An **Azure Container Registry** storing Docker images
- **GitHub Actions** automating the frontend deployment pipeline

**Module:** SE4010 — Cloud-Native and DevOps Engineering
**Institution:** SLIIT (Sri Lanka Institute of Information Technology)
**Year:** 2026

---

## 2. Architecture

```
Browser
  │
  ▼  HTTPS
Azure Static Web App  (React frontend)
  │
  ▼  HTTPS / REACT_APP_API_URL
Gateway Service  (Azure Container App · Node.js · port 3000)
  │
  ▼  internal HTTP / PRODUCTS_SERVICE_URL
Products Service  (Azure Container App · Node.js · port 3001)

Both Container Apps pull their images from:
Azure Container Registry  (sliitmicroregistry)
```

**Data flow:**
1. The browser loads the React app from Azure Static Web Apps (global CDN).
2. The React app calls the Gateway via the public URL set in `REACT_APP_API_URL`.
3. The Gateway proxies `/api/products/*` requests to Products Service using the internal FQDN (`PRODUCTS_SERVICE_URL`).
4. Products Service is internal — it is **not** reachable from the public internet.

---

## 3. Project Structure

```
azure-microservices-lab/
├── .github/
│   └── workflows/
│       ├── azure-static-web-apps-lemon-bay-015f9eb00.yml
│       └── azure-static-web-apps-purple-beach-0949d1200.yml
├── Screenshots/
│   ├── Gateway check.png
│   ├── Gateway check 2.png
│   ├── Gateway Health Response.png
│   ├── Fontend 1.png
│   ├── Frontend 2.png
│   ├── Github action tab.png
│   ├── az resource list.png
│   └── container app logs.png
├── frontend/
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.js
│       ├── App.css
│       └── index.js
├── gateway/
│   ├── server.js
│   ├── Dockerfile
│   ├── .dockerignore
│   └── package.json
├── products-service/
│   ├── server.js
│   ├── Dockerfile
│   ├── .dockerignore
│   └── package.json
├── .gitignore
├── README.md
└── LAB_DOCUMENTATION.md  ← this file
```

---

## 4. Source Code

### 4.1 Gateway Service

**File:** `gateway/server.js`

The Gateway is a Node.js/Express API that serves as the single entry point for all client requests. It proxies product-related calls to the internal Products Service.

```javascript
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL;

// Middleware
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Proxy /api/products/* → products-service
if (PRODUCTS_SERVICE_URL) {
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
  app.get('/api/products*', (req, res) => {
    res.status(503).json({
      error: 'Products service not configured',
      hint: 'Set the PRODUCTS_SERVICE_URL environment variable on the gateway Container App',
    });
  });
}

// Root – service info
app.get('/', (req, res) => {
  res.json({
    service: 'Gateway Service',
    version: '2.0.0',
    description: 'API Gateway for Azure Microservices Lab',
    endpoints: [
      { method: 'GET', path: '/',                description: 'Service info' },
      { method: 'GET', path: '/health',          description: 'Health check' },
      { method: 'GET', path: '/api/info',        description: 'API information' },
      { method: 'GET', path: '/api/services',    description: 'List available services' },
      { method: 'GET', path: '/api/products',    description: 'List all products (proxied)' },
      { method: 'GET', path: '/api/products/:id',description: 'Get product by ID (proxied)' },
    ],
  });
});

// Health check
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
```

**`gateway/package.json`**

```json
{
  "name": "gateway-service",
  "version": "1.0.0",
  "main": "server.js",
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6",
    "morgan": "^1.10.0"
  }
}
```

---

### 4.2 Products Service

**File:** `products-service/server.js`

A standalone Node.js/Express microservice that serves a mock Azure-services product catalog. It is deployed with **internal ingress**, so it is only reachable from within the Container Apps environment.

```javascript
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Mock product catalog — Azure services
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

// List all products (supports ?category= filter)
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
```

**`products-service/package.json`**

```json
{
  "name": "products-service",
  "version": "1.0.0",
  "main": "server.js",
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "morgan": "^1.10.0"
  }
}
```

---

### 4.3 Frontend (React)

**File:** `frontend/src/App.js`

React 18 single-page application that visualizes:
- Gateway health status
- List of deployed services
- Product catalog fetched from the gateway
- Lab architecture diagram
- Gateway runtime info

The app reads `REACT_APP_API_URL` at build time to know the gateway address.

**Key API calls made by the frontend:**

| Call | Endpoint |
|------|----------|
| Gateway health | `${API_URL}/health` |
| Deployed services | `${API_URL}/api/services` |
| Gateway info | `${API_URL}/api/info` |
| Product catalog | `${API_URL}/api/products` |

**`frontend/package.json`**

```json
{
  "name": "sliit-microservices-frontend",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1",
    "web-vitals": "^3.4.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test":  "react-scripts test",
    "eject": "react-scripts eject"
  }
}
```

**`frontend/public/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0078d4" />
    <meta name="description" content="Azure Microservices Lab — SE4010 SLIIT" />
    <title>Azure Microservices Lab</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
```

---

## 5. Docker Configuration

### Gateway Dockerfile

**File:** `gateway/Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
```

### Products Service Dockerfile

**File:** `products-service/Dockerfile`

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 3001

CMD ["node", "server.js"]
```

### .dockerignore (both services)

```
node_modules
npm-debug.log
.git
.gitignore
README.md
```

**Notes:**
- Both images use `node:18-alpine` for a minimal, secure base.
- Only production dependencies are installed (`npm install --production`).
- `node_modules` is excluded from the build context to speed up builds.

---

## 6. CI/CD Pipeline (GitHub Actions)

### Workflow: `azure-static-web-apps-lemon-bay-015f9eb00.yml`

**File:** `.github/workflows/azure-static-web-apps-lemon-bay-015f9eb00.yml`

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches:
      - main
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches:
      - main

jobs:
  build_and_deploy_job:
    if: github.event_name == 'push' || (github.event_name == 'pull_request' && github.event.action != 'closed')
    runs-on: ubuntu-latest
    name: Build and Deploy Job
    steps:
      - uses: actions/checkout@v3
        with:
          submodules: true
          lfs: false

      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_LEMON_BAY_015F9EB00 }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/frontend"
          output_location: "build"
        env:
          REACT_APP_API_URL: https://gateway.redwave-597fbb8a.eastasia.azurecontainerapps.io

  close_pull_request_job:
    if: github.event_name == 'pull_request' && github.event.action == 'closed'
    runs-on: ubuntu-latest
    name: Close Pull Request Job
    steps:
      - name: Close Pull Request
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN_LEMON_BAY_015F9EB00 }}
          action: "close"
```

**How it works:**
1. On every push to `main`, GitHub Actions checks out the repo, builds the React app in `frontend/`, and deploys the `build/` folder to Azure Static Web Apps.
2. `REACT_APP_API_URL` is injected at build time so the frontend bundle points to the correct gateway URL.
3. On PR close, the preview deployment is cleaned up automatically.

---

## 7. Local Development Setup

### Prerequisites

- Node.js >= 18
- Docker Desktop
- Azure CLI (`az`)

### Step 1 — Start Products Service

```bash
cd products-service
npm install
npm start
# Listening on http://localhost:3001
```

### Step 2 — Start Gateway

```bash
cd gateway
npm install
PRODUCTS_SERVICE_URL=http://localhost:3001 npm start
# Listening on http://localhost:3000
```

### Step 3 — Start Frontend

```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:3000 npm start
# Opens http://localhost:3000 (or 3002 if 3000 is in use)
```

### Quick Test (local)

```bash
# Health check
curl http://localhost:3000/health

# Products list via gateway proxy
curl http://localhost:3000/api/products

# Single product
curl http://localhost:3000/api/products/1

# Direct products-service
curl http://localhost:3001/products
```

---

## 8. Azure Deployment — Step by Step

### Environment Variables (set once)

```bash
REGISTRY=sliitmicroregistry   # Your ACR name (must be globally unique)
RG=microservices-rg
LOCATION=eastus
```

---

### Task 1 — Login to Azure

```bash
az login
az account show
```

After `az login`, a browser window opens for interactive sign-in. `az account show` confirms the active subscription.

---

### Task 2 — Resource Group & Container Registry

```bash
# Create resource group
az group create --name $RG --location $LOCATION

# Create Azure Container Registry (Basic SKU)
az acr create --resource-group $RG --name $REGISTRY --sku Basic

# Authenticate Docker to ACR
az acr login --name $REGISTRY
```

**What this creates:**
- A resource group `microservices-rg` in East US
- A private Docker registry at `sliitmicroregistry.azurecr.io`

---

### Task 3 — Build & Push Docker Images

```bash
# Build and push gateway image
docker build -t $REGISTRY.azurecr.io/gateway:v1 ./gateway
docker push  $REGISTRY.azurecr.io/gateway:v1

# Build and push products-service image
docker build -t $REGISTRY.azurecr.io/products-service:v1 ./products-service
docker push  $REGISTRY.azurecr.io/products-service:v1

# Verify both images are in ACR
az acr repository list --name $REGISTRY --output table
```

Expected output of the verify command:

```
Result
-----------------
gateway
products-service
```

---

### Task 4 — Deploy Container Apps

```bash
# Register required Azure resource providers
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

# Create the Container Apps managed environment
az containerapp env create \
  --name micro-env \
  --resource-group $RG \
  --location $LOCATION

# Enable ACR admin credentials and retrieve password
az acr update -n $REGISTRY --admin-enabled true
ACR_PASSWORD=$(az acr credential show --name $REGISTRY --query "passwords[0].value" -o tsv)

# Deploy products-service with INTERNAL ingress
az containerapp create \
  --name products-service \
  --resource-group $RG \
  --environment micro-env \
  --image $REGISTRY.azurecr.io/products-service:v1 \
  --target-port 3001 \
  --ingress internal \
  --registry-server $REGISTRY.azurecr.io \
  --registry-username $REGISTRY \
  --registry-password $ACR_PASSWORD

# Retrieve the internal FQDN of products-service
PRODUCTS_FQDN=$(az containerapp show \
  --name products-service \
  --resource-group $RG \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo "Products internal URL: https://$PRODUCTS_FQDN"

# Deploy gateway with EXTERNAL ingress, passing products-service URL
az containerapp create \
  --name gateway \
  --resource-group $RG \
  --environment micro-env \
  --image $REGISTRY.azurecr.io/gateway:v1 \
  --target-port 3000 \
  --ingress external \
  --registry-server $REGISTRY.azurecr.io \
  --registry-username $REGISTRY \
  --registry-password $ACR_PASSWORD \
  --env-vars PRODUCTS_SERVICE_URL=https://$PRODUCTS_FQDN

# Retrieve the public gateway URL
GATEWAY_FQDN=$(az containerapp show \
  --name gateway \
  --resource-group $RG \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo "Gateway URL: https://$GATEWAY_FQDN"
```

**Key points:**
- `products-service` uses `--ingress internal` — it is only reachable from within `micro-env`.
- `gateway` uses `--ingress external` — it gets a public HTTPS URL.
- The gateway is given `PRODUCTS_SERVICE_URL` as an env var so it can proxy product requests.

---

### Task 5 — Deploy Static Web App

```bash
# Create the Static Web App linked to your GitHub repo
az staticwebapp create \
  --name sliit-frontend-app \
  --resource-group $RG \
  --location eastus \
  --source https://github.com/<your-username>/<your-repo> \
  --branch main \
  --app-location "/frontend" \
  --output-location "build"

# Point the frontend at the gateway
az staticwebapp appsettings set \
  --name sliit-frontend-app \
  --resource-group $RG \
  --setting-names REACT_APP_API_URL=https://$GATEWAY_FQDN

# Get the frontend public URL
az staticwebapp show \
  --name sliit-frontend-app \
  --resource-group $RG \
  --query defaultHostname \
  --output tsv
```

> Alternatively, the GitHub Actions workflow (`azure-static-web-apps-lemon-bay-015f9eb00.yml`) handles automated deployments on every push to `main`.

---

### Task 6 — Verify & Cleanup

```bash
# List all resources in the group
az resource list --resource-group $RG --output table

# Test gateway health endpoint
curl https://$GATEWAY_FQDN/health

# Test products endpoint (proxied through gateway → products-service)
curl https://$GATEWAY_FQDN/api/products

# Stream gateway logs
az containerapp logs show \
  --name gateway \
  --resource-group $RG \
  --follow false

# Stream products-service logs
az containerapp logs show \
  --name products-service \
  --resource-group $RG \
  --follow false

# ⚠️  CLEANUP — deletes ALL resources in the group
az group delete --name $RG --yes
```

---

## 9. API Reference

### Gateway Service (public — external ingress)

| Method | Path | Description | Example Response |
|--------|------|-------------|-----------------|
| GET | `/` | Service info & endpoint list | `{ "service": "Gateway Service", "version": "2.0.0", ... }` |
| GET | `/health` | Health check | `{ "status": "ok", "uptime": 123.4, "timestamp": "...", "productsServiceConfigured": true }` |
| GET | `/api/info` | Gateway runtime info | `{ "name": "...", "version": "2.0.0", "region": "eastus", "runtime": "Node.js v18.x" }` |
| GET | `/api/services` | List all deployed services | `{ "services": [ { "name": "gateway", ... }, ... ] }` |
| GET | `/api/products` | All products (proxied) | `{ "success": true, "count": 6, "data": [...] }` |
| GET | `/api/products/:id` | Single product (proxied) | `{ "success": true, "data": { "id": 1, "name": "...", ... } }` |

### Products Service (internal — only reachable from gateway)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/products` | List all products (supports `?category=` filter) |
| GET | `/products/:id` | Get single product by ID |

**Product categories:** `Containers`, `Web`, `Compute`, `Storage`, `Observability`

**Filter example:**
```bash
curl "https://$GATEWAY_FQDN/api/products?category=Containers"
```

---

## 10. Screenshots

The following screenshots document the live deployment and verification steps.

---

### Gateway Endpoint Check

![Gateway check](Screenshots/Gateway%20check.png)

*Figure 1 — Initial gateway endpoint verification showing the root `/` response.*

---

### Gateway Check 2

![Gateway check 2](Screenshots/Gateway%20check%202.png)

*Figure 2 — Additional gateway endpoint verification.*

---

### Gateway Health Response

![Gateway Health Response](Screenshots/Gateway%20Health%20Response.png)

*Figure 3 — Gateway `/health` endpoint returning `{ "status": "ok" }` with uptime and timestamp.*

---

### Frontend UI — View 1

![Frontend 1](Screenshots/Fontend%201.png)

*Figure 4 — React frontend loaded from Azure Static Web Apps showing gateway health and services.*

---

### Frontend UI — View 2

![Frontend 2](Screenshots/Frontend%202.png)

*Figure 5 — React frontend displaying the product catalog fetched through the gateway.*

---

### GitHub Actions Workflow

![Github action tab](Screenshots/Github%20action%20tab.png)

*Figure 6 — GitHub Actions tab showing the automated CI/CD pipeline successfully deploying the frontend to Azure Static Web Apps.*

---

### Azure Resource List

![az resource list](Screenshots/az%20resource%20list.png)

*Figure 7 — Output of `az resource list --resource-group microservices-rg --output table` showing all provisioned resources: ACR, Container Apps environment, gateway, products-service, and Static Web App.*

---

### Container App Logs

![container app logs](Screenshots/container%20app%20logs.png)

*Figure 8 — Container App logs from the gateway service showing incoming HTTP requests proxied to the products-service.*

---

## Summary

| Component | Azure Service | Ingress | Port |
|-----------|--------------|---------|------|
| Frontend | Azure Static Web Apps | Public (CDN) | 443 |
| Gateway | Azure Container Apps | External (public) | 3000 → 443 |
| Products Service | Azure Container Apps | Internal only | 3001 |
| Image Registry | Azure Container Registry | N/A | N/A |

**Key takeaways:**
- The **API Gateway pattern** centralizes routing, hiding internal services from the public internet.
- **Internal ingress** on the Products Service ensures it can only be reached by the gateway within the same Container Apps environment.
- **GitHub Actions** automates the frontend deployment so any push to `main` triggers a rebuild and re-deploy.
- The entire infrastructure can be torn down with a single `az group delete` command.
