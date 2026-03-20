import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || '';

function StatusBadge({ status }) {
  const isOk = status === 'ok' || status === 'running' || status === 'active';
  return (
    <span className={`badge ${isOk ? 'badge-ok' : 'badge-warn'}`}>
      {isOk ? '● Online' : '● Offline'}
    </span>
  );
}

function ServiceCard({ name, type, description, status }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{name}</h3>
        <StatusBadge status={status} />
      </div>
      <p className="card-type">{type}</p>
      <p className="card-desc">{description}</p>
    </div>
  );
}

function ProductCard({ name, category, description, price, unit, status }) {
  const categoryColors = {
    Containers:    { bg: '#e8f4fd', border: '#0078d4' },
    Web:           { bg: '#e8fdf4', border: '#107c10' },
    Compute:       { bg: '#fdf4e8', border: '#ff8c00' },
    Storage:       { bg: '#f4e8fd', border: '#8764b8' },
    Observability: { bg: '#fde8e8', border: '#d83b01' },
  };
  const style = categoryColors[category] || { bg: '#f8f9ff', border: '#ccc' };
  return (
    <div className="product-card" style={{ background: style.bg, borderColor: style.border }}>
      <div className="product-header">
        <span className="product-category" style={{ color: style.border }}>{category}</span>
        <StatusBadge status={status} />
      </div>
      <h3 className="product-name">{name}</h3>
      <p className="product-desc">{description}</p>
      <div className="product-price">
        <span className="price-amount">
          {price === 0 ? 'Free' : `$${price.toFixed(4)}`}
        </span>
        {price > 0 && <span className="price-unit">{unit}</span>}
      </div>
    </div>
  );
}

export default function App() {
  const [health, setHealth]     = useState(null);
  const [services, setServices] = useState([]);
  const [info, setInfo]         = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, servicesRes, infoRes, productsRes] = await Promise.all([
        fetch(`${API_URL}/health`),
        fetch(`${API_URL}/api/services`),
        fetch(`${API_URL}/api/info`),
        fetch(`${API_URL}/api/products`),
      ]);

      if (!healthRes.ok) throw new Error(`Gateway returned ${healthRes.status}`);

      const [healthData, servicesData, infoData, productsData] = await Promise.all([
        healthRes.json(),
        servicesRes.json(),
        infoRes.json(),
        productsRes.json(),
      ]);

      setHealth(healthData);
      setServices(servicesData.services || []);
      setInfo(infoData);
      setProducts(productsData.data || []);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">☁</div>
          <div>
            <h1>Azure Microservices Lab</h1>
            <p>SE4010 – Current Trends in Software Engineering | SLIIT 2026</p>
          </div>
        </div>
      </header>

      <main className="main">

        {/* ── Gateway Health ── */}
        <section className="section">
          <h2>Gateway Health</h2>
          {loading && <p className="loading">Connecting to gateway...</p>}
          {error && (
            <div className="alert alert-error">
              <strong>Gateway unreachable:</strong> {error}
              {!API_URL && (
                <p className="hint">
                  Set <code>REACT_APP_API_URL</code> to your gateway FQDN to connect.
                </p>
              )}
            </div>
          )}
          {health && (
            <div className="health-grid">
              <div className="health-item">
                <span className="label">Status</span>
                <StatusBadge status={health.status} />
              </div>
              <div className="health-item">
                <span className="label">Uptime</span>
                <span className="value">{Math.floor(health.uptime)}s</span>
              </div>
              <div className="health-item">
                <span className="label">Environment</span>
                <span className="value">{health.environment}</span>
              </div>
              <div className="health-item">
                <span className="label">Products Service</span>
                <StatusBadge status={health.productsServiceConfigured ? 'ok' : 'error'} />
              </div>
              <div className="health-item">
                <span className="label">Timestamp</span>
                <span className="value">{new Date(health.timestamp).toLocaleString()}</span>
              </div>
            </div>
          )}
          {lastChecked && (
            <p className="last-checked">
              Last checked: {lastChecked}{' '}
              <button className="btn-refresh" onClick={fetchAll}>Refresh</button>
            </p>
          )}
        </section>

        {/* ── Deployed Services ── */}
        <section className="section">
          <h2>Deployed Services</h2>
          {services.length > 0 ? (
            <div className="cards-grid">
              {services.map((svc) => (
                <ServiceCard key={svc.name} {...svc} />
              ))}
            </div>
          ) : (
            !loading && <p className="empty">No services data available.</p>
          )}
        </section>

        {/* ── Product Catalog (from products-service via gateway) ── */}
        <section className="section">
          <h2>Product Catalog <span className="section-tag">products-service</span></h2>
          {loading && <p className="loading">Loading products from backend...</p>}
          {!loading && products.length > 0 ? (
            <div className="products-grid">
              {products.map((p) => (
                <ProductCard key={p.id} {...p} />
              ))}
            </div>
          ) : (
            !loading && !error && (
              <div className="alert alert-warn">
                Products service returned no data. Ensure the <code>products-service</code> Container
                App is deployed and <code>PRODUCTS_SERVICE_URL</code> is set on the gateway.
              </div>
            )
          )}
        </section>

        {/* ── Architecture Diagram ── */}
        <section className="section">
          <h2>Lab Architecture</h2>
          <div className="arch-diagram">
            <div className="arch-box frontend-box">
              <div className="arch-icon">🌐</div>
              <strong>Static Web App</strong>
              <small>Azure Static Web Apps</small>
              <small>React Frontend</small>
            </div>
            <div className="arch-arrow">→ HTTPS →</div>
            <div className="arch-box gateway-box">
              <div className="arch-icon">⚡</div>
              <strong>Gateway Service</strong>
              <small>Azure Container Apps</small>
              <small>Node.js · Port 3000</small>
            </div>
            <div className="arch-arrow">→ proxy →</div>
            <div className="arch-box products-box">
              <div className="arch-icon">🛒</div>
              <strong>Products Service</strong>
              <small>Azure Container Apps</small>
              <small>Node.js · Port 3001</small>
            </div>
            <div className="arch-arrow arch-arrow-down">↑ pull images ↑</div>
            <div className="arch-box acr-box">
              <div className="arch-icon">📦</div>
              <strong>Container Registry</strong>
              <small>Azure ACR (Basic)</small>
              <small>sliitmicroregistry</small>
            </div>
          </div>
        </section>

        {/* ── Gateway Info ── */}
        {info && (
          <section className="section">
            <h2>Gateway Info</h2>
            <table className="info-table">
              <tbody>
                {Object.entries(info).map(([key, val]) => (
                  <tr key={key}>
                    <td className="info-key">{key}</td>
                    <td className="info-val">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

      </main>

      <footer className="footer">
        <p>SLIIT – Faculty of Computing | SE4010 Azure Microservices Deployment Lab | 2026</p>
      </footer>
    </div>
  );
}
