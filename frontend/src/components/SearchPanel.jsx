import { useState } from "react";
import { api } from "../api.js";

export default function SearchPanel({ onTracked }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searched, setSearched] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [message, setMessage] = useState("");

  async function search(event) {
    event.preventDefault();
    setBusy(true); setMessage(""); setResults([]); setSearched(false);
    try {
      const data = await api.searchStore(query.trim());
      setResults(data.products); setSearched(true);
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }

  async function track(product) {
    setTracking(true); setMessage("");
    try {
      const result = await api.trackProduct(product);
      onTracked(result.product.id);
      setMessage(result.initialScrape?.ok === false
        ? `Product saved, but the first scrape failed: ${result.initialScrape.error}. See its logs.`
        : result.alreadyTracked ? "Product is already tracked." : "Product tracked.");
    } catch (error) { setMessage(error.message); }
    finally { setTracking(false); }
  }

  return <section>
    <h2>Find a product</h2>
    <form onSubmit={search}>
      <label htmlFor="query">Product name</label>{" "}
      <input id="query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Partial or full name" required />{" "}
      <button disabled={busy || tracking || !query.trim()}>{busy ? "Searching…" : "Search"}</button>
    </form>
    {busy && <p>The first search loads the store catalogue and may take a little longer.</p>}
    {tracking && <p>Saving product and checking its first price…</p>}
    {message && <p role="status">{message}</p>}
    {searched && !results.length && <p>No matching products.</p>}
    <ul className="results">{results.map((product) => <li key={product.url}>
      <span>{product.name}</span><button disabled={tracking} onClick={() => track(product)}>Track</button>
    </li>)}</ul>
  </section>;
}
