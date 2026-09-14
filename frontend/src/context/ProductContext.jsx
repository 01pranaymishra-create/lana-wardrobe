import { createContext, useContext, useEffect, useState } from "react";

const ProductContext = createContext();

export function ProductProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          " https://lana-wardrobe-production.up.railway.app/api/products"
        );

        if (!response.ok) {
          throw new Error("Failed to fetch products");
        }

        const data = await response.json();

        /*
          PostgreSQL uses names like:
          discount_price
          new_arrival

          Our React frontend currently expects:
          discountPrice
          newArrival

          So we convert them here.
        */

        const formattedProducts = data.products.map((product) => ({
          id: product.id,
          name: product.name,
          category: product.category,

          price: Number(product.price),

          discountPrice: product.discount_price
            ? Number(product.discount_price)
            : null,

          description: product.description,
          stock: product.stock,

          sizes: product.sizes || [],
          colors: product.colors || [],

          imageUrl: product.image_url,

          newArrival: product.new_arrival,
          bestSeller: product.best_seller,
          featured: product.featured,

          createdAt: product.created_at,
        }));

        setProducts(formattedProducts);
        setError("");
      } catch (error) {
        console.error("Product loading error:", error);

        setError("Unable to load products.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return (
    <ProductContext.Provider
      value={{
        products,
        loading,
        error,
      }}
    >
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  return useContext(ProductContext);
}