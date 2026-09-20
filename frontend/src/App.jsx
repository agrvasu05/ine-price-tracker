import { useEffect, useState } from "react";
import { api } from "./api.js";
import SearchPanel from "./components/SearchPanel.jsx";
import ProductDetail from "./components/ProductDetail.jsx";

export default function App() {
  const [products, setProducts] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api.listProducts().then(({ products }) => {
      if (cancelled) return;
      setProducts(products);
      setSelectedId((id) => id || products[0]?.id || "");
    }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError("");
    if (selectedId) api.productDetail(selectedId).then((data) => {
      if (!cancelled) setDetail(data);
    }).catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [selectedId, refresh]);

  return (
    <main>
      <header className="header">
        <div>
          <p className="eyebrow">INE · SOFTWARE ENGINEER INTERN</p>
          <h1>Product Price Tracker</h1>
          <p>Track price and availability at the INE mock store, every two hours.</p>
        </div>
        <button className="secondary" onClick={() => setRefresh((value) => value + 1)}>Refresh data</button>
      </header>
      <SearchPanel onTracked={(id) => { setSelectedId(id); setRefresh((value) => value + 1); }} />
      <section>
        <h2>Tracked products</h2>
        <p className="muted">Select a product to see its full history, scrape logs and alerts.</p>
        {/* Bonus 2: multi-product overview using the most recent successful values. */}
        <div className="product-grid">
          {products.map((product) => (
            <button key={product.id} className={`product-card ${selectedId === product.id ? "selected" : ""}`}
              onClick={() => setSelectedId(product.id)}>
              <strong>{product.name}</strong>
              <span>{product.last_price == null ? "No price recorded yet" : `${product.last_currency} ${Number(product.last_price).toFixed(2)}`}</span>
              <span>{product.last_in_stock == null ? "Stock unknown" : product.last_in_stock ? "In stock" : "Out of stock"}</span>
            </button>
          ))}
        </div>
        {!products.length && <p>No tracked products yet. Search above to add one.</p>}
      </section>
      {error && <p role="alert" className="error">{error}</p>}
      {selectedId && !detail && !error && <p>Loading product details…</p>}
      <ProductDetail detail={detail} />
    </main>
  );
}
