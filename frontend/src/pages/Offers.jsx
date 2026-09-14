import { useProducts } from "../context/ProductContext";
import ProductCard from "../components/ProductCard";

function Offers() {
  const { products, loading } = useProducts();

  const offerProducts = products.filter(
  (product) =>
    product.discountPrice !== null &&
    product.discountPrice !== undefined &&
    Number(product.discountPrice) <
      Number(product.price)
);

  if (loading) {
    return (
      <main className="collection-page">
        <p>Loading offers...</p>
      </main>
    );
  }

  return (
    <main className="collection-page">
      <section className="collection-header">
        <p>LANA WARDROBE</p>
        <h1>Offers</h1>
        <p>
          Shop products currently available at special prices.
        </p>
      </section>

      <section className="collection-grid">
        {offerProducts.length === 0 ? (
          <p>No offers available right now.</p>
        ) : (
          offerProducts.map((product) => (
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

export default Offers;