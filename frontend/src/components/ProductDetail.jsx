const date = (value) => new Date(value).toLocaleString();

export default function ProductDetail({ detail }) {
  if (!detail) return null;
  const { product, history, logs, alerts } = detail;
  return <section>
    <h2>{product.name}</h2>
    <a href={product.store_url} target="_blank" rel="noreferrer">Open product in the INE store ↗</a>
    <h3>Alerts</h3>
    <p className="muted">Bonus 1: in-app price-drop and back-in-stock alerts.</p>
    {alerts.length ? <ul className="alerts">{alerts.map((alert) =>
      <li key={alert.id}><strong>{alert.kind.replaceAll("_", " ")}</strong> · {alert.message}<br/><small>{date(alert.created_at)}</small></li>
    )}</ul> : <p>No alerts yet. Alerts start after a previous successful scrape exists.</p>}

    <h3>Price and stock history</h3>
    <p className="muted">Most recent 100 records (older records remain stored in Supabase).</p>
    <div className="table-wrap"><table>
      <thead><tr><th>Time</th><th>Price</th><th>Stock</th></tr></thead>
      <tbody>{history.map((row) => <tr key={row.id}>
        <td>{date(row.scraped_at)}</td><td>{row.currency} {Number(row.price).toFixed(2)}</td><td>{row.in_stock ? "In stock" : "Out of stock"}</td>
      </tr>)}</tbody>
    </table></div>
    {!history.length && <p>No successful scrapes yet.</p>}

    <h3>Scrape attempts</h3>
    <p className="muted">Most recent 100 attempts, including retries and failures.</p>
    <div className="table-wrap"><table>
      <thead><tr><th>Time</th><th>Attempt</th><th>Outcome</th><th>Duration</th><th>Error</th></tr></thead>
      <tbody>{logs.map((row) => <tr key={row.id}>
        <td>{date(row.attempted_at)}</td><td>{row.attempt_no}</td><td>{row.outcome}</td><td>{row.duration_ms} ms</td><td>{row.error_message || "—"}</td>
      </tr>)}</tbody>
    </table></div>
    {!logs.length && <p>No attempts recorded yet.</p>}
  </section>;
}
