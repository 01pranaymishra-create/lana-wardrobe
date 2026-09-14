import { useProducts } from "../context/ProductContext";
import ProductCard from "../components/ProductCard";

function BestSellers() {
  const { products, loading } = useProducts();

  const bestSellers = products.filter(
    (product) => product.bestSeller
  );

  if (loading) {
    return (
      <main className="collection-page">
        <p>Loading best sellers...</p>
      </main>
    );
  }

  return (
    <main className="collection-page">
      <section className="collection-header">
        <p>LANA WARDROBE</p>
        <h1>Best Sellers</h1>
        <p>
          Most-loved styles from our collection.
        </p>
      </section>

      <section className="collection-grid">
        {bestSellers.length === 0 ? (
          <p>No best seller products yet.</p>
        ) : (
          bestSellers.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
            />
          ))
        )}
      </section>
    </main>
  );
}

export default BestSellers;