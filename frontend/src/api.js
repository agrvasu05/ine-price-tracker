const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export const api = {
  searchStore: (query) => request(`/store/search?q=${encodeURIComponent(query)}`),
  listProducts: () => request("/products"),
  productDetail: (id) => request(`/products/${id}`),
  trackProduct: (product) => request("/products", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: product.name, url: product.url })
  })
};
