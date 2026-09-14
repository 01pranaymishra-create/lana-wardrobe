import { useParams } from "react-router-dom";
import { useProducts } from "../context/ProductContext";
import ProductCard from "../components/ProductCard";

function Category() {
  const { products, loading, error } = useProducts();  
  const { category } = useParams();

  const categoryProducts = products.filter(
    (product) => product.category === category
  );

  const categoryNames = {
    men: "Men",
    women: "Women",
    unisex: "Unisex",
    sports: "Sports T-Shirts",
  };

  const displayName = categoryNames[category] || "Products";
  if (loading) {
  return (
    <main className="category-page">
      <div style={{ padding: "80px", textAlign: "center" }}>
        Loading products...
      </div>
    </main>
  );
}

if (error) {
  return (
    <main className="category-page">
      <div style={{ padding: "80px", textAlign: "center" }}>
        {error}
      </div>
    </main>
  );
}

  return (
    <main className="category-page">
      <section className="category-page-header">
        <p>LANA WARDROBE</p>
        <h1>{displayName}</h1>
        <p>Explore our {displayName} collection.</p>
      </section>

      <section className="category-products">
        {categoryProducts.length > 0 ? (
          <div className="product-grid">
            {categoryProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        ) : (
          <div className="no-products">
            <h2>No products available yet</h2>
            <p>New styles will be added soon.</p>
          </div>
        )}
      </section>
    </main>
  );
}

export default Category;
