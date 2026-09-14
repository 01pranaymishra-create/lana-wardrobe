import ProductCard from "../components/ProductCard";
import { useProducts } from "../context/ProductContext";

function Latest() {
  const { products, loading, error } = useProducts();

  const latestProducts = products.filter(
    (product) => product.newArrival
  );

  // Show while products are being fetched from PostgreSQL
  if (loading) {
    return (
      <main className="latest-page">
        <div style={{ padding: "80px", textAlign: "center" }}>
          Loading products...
        </div>
      </main>
    );
  }

  // Show if backend/database cannot be reached
  if (error) {
    return (
      <main className="latest-page">
        <div style={{ padding: "80px", textAlign: "center" }}>
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="latest-page">
      <section className="latest-header">
        <p>JUST DROPPED</p>

        <h1>New Arrivals</h1>

        <p>
          Explore the latest T-shirt designs from Lana Wardrobe.
        </p>
      </section>

      <section className="latest-products">
        <div className="product-grid">
          {latestProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

export default Latest;