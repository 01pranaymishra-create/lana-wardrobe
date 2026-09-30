import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const ProductContext = createContext();

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://api.lanawardrobe.in";

export function ProductProvider({
  children,
}) {
  const [products, setProducts] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);

        const response = await fetch(
          `${API_URL}/api/products`
        );

        if (!response.ok) {
          throw new Error(
            "Failed to fetch products"
          );
        }

        const data =
          await response.json();

        const formattedProducts =
          data.products.map(
            (product) => ({
              id: product.id,
              name: product.name,
              category:
                product.category,

              price:
                Number(product.price),

              discountPrice:
                product.discount_price
                  ? Number(
                      product.discount_price
                    )
                  : null,

              description:
                product.description,

              stock:
                Number(
                  product.stock
                ) || 0,

              sizes:
                product.sizes || [],

              colors:
                product.colors || [],

              colorStock:
                Array.isArray(
                  product.color_stock
                )
                  ? product.color_stock.map(
                      (item) => ({
                        colorName:
                          item.color_name ||
                          "",

                        stockQuantity:
                          Number(
                            item.stock_quantity
                          ) || 0,
                      })
                    )
                  : [],

              imageUrl:
                product.image_url,

              newArrival:
                product.new_arrival,

              bestSeller:
                product.best_seller,

              featured:
                product.featured,

              createdAt:
                product.created_at,
            })
          );

        setProducts(
          formattedProducts
        );

        setError("");
      } catch (error) {
        console.error(
          "Product loading error:",
          error
        );

        setError(
          "Unable to load products."
        );
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
  return useContext(
    ProductContext
  );
}