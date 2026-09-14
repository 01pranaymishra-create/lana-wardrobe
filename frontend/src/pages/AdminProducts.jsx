import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token =
          localStorage.getItem("lana_token");

        const response = await fetch(
          "https://api.lanawardrobe.in/api/admin/products",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load products."
          );
        }

        setProducts(data.products || []);
      } catch (error) {
        console.error(
          "Admin products error:",
          error
        );

        setError(
          error.message ||
            "Failed to load products."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // =========================
  // DELETE PRODUCT
  // =========================

  const handleDeleteProduct = async (
    productId,
    productName
  ) => {
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete "${productName}"?`
    );

    if (!confirmed) {
      return;
    }

    try {
      const token =
        localStorage.getItem("lana_token");

      const response = await fetch(
        `https://api.lanawardrobe.in/api/admin/products/${productId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to delete product."
        );
      }

      alert("Product deleted successfully.");

      setProducts((previousProducts) =>
        previousProducts.filter(
          (product) =>
            product.id !== productId
        )
      );
    } catch (error) {
      console.error(
        "Delete product error:",
        error
      );

      alert(
        error.message ||
          "Failed to delete product."
      );
    }
  };

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <main className="admin-page">
        <p>Loading products...</p>
      </main>
    );
  }

  // =========================
  // ERROR
  // =========================

  if (error) {
    return (
      <main className="admin-page">
        <p>{error}</p>
      </main>
    );
  }

  // =========================
  // PAGE
  // =========================

  return (
    <main className="admin-page">
      <section className="admin-products-header">
        <div>
          <p>LANA WARDROBE ADMIN</p>

          <h1>Manage Products</h1>

          <p>
            Add, edit and manage your
            store products.
          </p>
        </div>

        <Link
          to="/admin/products/add"
          className="admin-add-product-button"
        >
          + Add Product
        </Link>
      </section>

      <section className="admin-products-list">
        {products.length === 0 ? (
          <div className="admin-empty-state">
            No products found.
          </div>
        ) : (
          products.map((product) => (
            <article
              className="admin-product-card"
              key={product.id}
            >
              {/* PRODUCT IMAGE */}

              <div className="admin-product-image">
                {product.image_url ? (
                  <img
                    src={
                      product.image_url.startsWith(
                        "http"
                      )
                        ? product.image_url
                        : `https://api.lanawardrobe.in${product.image_url}`
                    }
                    alt={product.name}
                  />
                ) : (
                  <span>No Image</span>
                )}
              </div>

              {/* PRODUCT INFO */}

              <div className="admin-product-info">
                <h3>{product.name}</h3>

                <p>
                  Category:{" "}
                  {product.category}
                </p>

                <p>
                  Stock: {product.stock}
                </p>

                <p>
                  Price: ₹{product.price}
                </p>

                {product.discount_price && (
                  <p>
                    Discount Price: ₹
                    {product.discount_price}
                  </p>
                )}

                <div className="admin-product-flags">
                  {product.new_arrival && (
                    <span>
                      New Arrival
                    </span>
                  )}

                  {product.best_seller && (
                    <span>
                      Best Seller
                    </span>
                  )}

                  {product.featured && (
                    <span>
                      Featured
                    </span>
                  )}
                </div>
              </div>

              {/* PRODUCT ACTIONS */}

              <div className="admin-product-actions">
                <Link
                  to={`/product/${product.id}`}
                >
                  View
                </Link>

                <Link
                  to={`/admin/products/edit/${product.id}`}
                >
                  Edit
                </Link>

                <button
                  type="button"
                  className="admin-product-delete-btn"
                  onClick={() =>
                    handleDeleteProduct(
                      product.id,
                      product.name
                    )
                  }
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}

export default AdminProducts;