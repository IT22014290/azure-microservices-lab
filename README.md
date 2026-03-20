# Azure Microservices Lab — SE4010 (SLIIT 2026)

Complete project for the Azure Microservices Deployment Lab.

## Architecture

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

## Project Structure

```
azure-microservices-lab/
├── gateway/               # API gateway – routes requests to backend services
│   ├── server.js
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
├── products-service/      # Backend microservice – product catalog
│   ├── server.js
│   ├── package.json
│   ├── Dockerfile
│   └── .dockerignore
└── frontend/              # React static web app
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js
    │   ├── App.css
    │   └── index.js
    └── package.json
```

## Quick Start (Local)

### Products Service
```bash
cd products-service
npm install
npm start
# Runs on http://localhost:3001
```

### Gateway (set PRODUCTS_SERVICE_URL so it can proxy)
```bash
cd gateway
npm install
PRODUCTS_SERVICE_URL=http://localhost:3001 npm start
# Runs on http://localhost:3000
```

### Frontend
```bash
cd frontend
npm install
REACT_APP_API_URL=http://localhost:3000 npm start
# Runs on http://localhost:3002
```

---

## Azure Deployment Commands

### Variables (update with your values)
```bash
REGISTRY=sliitmicroregistry        # append your student ID if name is taken
RG=microservices-rg
LOCATION=eastus
```

### Task 1 – Login
```bash
az login
az account show
```

### Task 2 – Resource Group & ACR
```bash
az group create --name $RG --location $LOCATION

az acr create --resource-group $RG --name $REGISTRY --sku Basic

az acr login --name $REGISTRY
```

### Task 3 – Build & Push Docker Images
```bash
# Gateway image
docker build -t $REGISTRY.azurecr.io/gateway:v1 ./gateway
docker push  $REGISTRY.azurecr.io/gateway:v1

# Products service image
docker build -t $REGISTRY.azurecr.io/products-service:v1 ./products-service
docker push  $REGISTRY.azurecr.io/products-service:v1

# Verify both images in ACR
az acr repository list --name $REGISTRY --output table
```

### Task 4 – Deploy Container Apps
```bash
# Register providers
az provider register --namespace Microsoft.App --wait
az provider register --namespace Microsoft.OperationalInsights --wait

# Create Container Apps environment
az containerapp env create \
  --name micro-env \
  --resource-group $RG \
  --location $LOCATION

# Enable ACR admin credentials
az acr update -n $REGISTRY --admin-enabled true
ACR_PASSWORD=$(az acr credential show --name $REGISTRY --query "passwords[0].value" -o tsv)

# Deploy products-service (internal ingress – only reachable within the environment)
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

# Get the internal FQDN of products-service
PRODUCTS_FQDN=$(az containerapp show \
  --name products-service \
  --resource-group $RG \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo "Products internal URL: https://$PRODUCTS_FQDN"

# Deploy gateway (external ingress – publicly accessible)
# Passes PRODUCTS_SERVICE_URL so the gateway can proxy /api/products/* to the backend
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

# Get the public gateway URL
GATEWAY_FQDN=$(az containerapp show \
  --name gateway \
  --resource-group $RG \
  --query properties.configuration.ingress.fqdn \
  --output tsv)

echo "Gateway URL: https://$GATEWAY_FQDN"
```

### Task 5 – Deploy Static Web App
```bash
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

# Get frontend URL
az staticwebapp show \
  --name sliit-frontend-app \
  --resource-group $RG \
  --query defaultHostname \
  --output tsv
```

### Task 6 – Verify & Cleanup
```bash
# List all resources (expect: ACR, Container Apps Env, gateway, products-service, Static Web App)
az resource list --resource-group $RG --output table

# Test endpoints
curl https://$GATEWAY_FQDN/health
curl https://$GATEWAY_FQDN/api/products

# View logs
az containerapp logs show --name gateway          --resource-group $RG --follow false
az containerapp logs show --name products-service --resource-group $RG --follow false

# CLEANUP — run only after saving screenshots
az group delete --name $RG --yes
```

---

## API Endpoints

### Gateway (public)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Service info & available endpoints |
| GET | `/health` | Health check — returns `{ "status": "ok" }` |
| GET | `/api/info` | Gateway runtime info |
| GET | `/api/services` | List of all deployed services |
| GET | `/api/products` | Product list (proxied → products-service) |
| GET | `/api/products/:id` | Single product (proxied → products-service) |

### Products Service (internal)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/products` | List all products (supports `?category=` filter) |
| GET | `/products/:id` | Get product by ID |
