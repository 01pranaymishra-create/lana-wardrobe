import { useState } from "react";
import { useNavigate } from "react-router-dom";

function AdminAddProduct() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    price: "",
    discountPrice: "",
    description: "",
    stock: "",
    sizes: "",
    colors: "",
    newArrival: false,
    bestSeller: false,
    featured: false,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const token =
        localStorage.getItem("lana_token");

      const sizes = formData.sizes
        .split(",")
        .map((size) => size.trim())
        .filter(Boolean);

      const colors = formData.colors
        .split(",")
        .map((color) => color.trim())
        .filter(Boolean);

      const response = await fetch(
        "https://api.lanawardrobe.in/api/admin/products",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },

          body: JSON.stringify({
            name: formData.name,
            category: formData.category,
            price: formData.price,
            discountPrice: formData.discountPrice,
            description: formData.description,
            stock: formData.stock,
            sizes,
            colors,
            newArrival: formData.newArrival,
            bestSeller: formData.bestSeller,
            featured: formData.featured,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to add product."
        );
      }

      alert("Product added successfully.");

      navigate("/admin/products");

    } catch (error) {
      console.error(
        "Add product error:",
        error
      );

      setError(
        error.message ||
          "Failed to add product."
      );

    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-page">
      <section className="admin-product-form-section">

        <div className="admin-product-form-header">
          <p>LANA WARDROBE ADMIN</p>

          <h1>Add Product</h1>

          <p>
            Create a new product for your store.
          </p>
        </div>

        <form
          className="admin-product-form"
          onSubmit={handleSubmit}
        >

          {error && (
            <p className="admin-form-error">
              {error}
            </p>
          )}

          <div className="admin-form-grid">

            <div className="admin-form-field">
              <label>Product Name</label>

              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="admin-form-field">
              <label>Category</label>

              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="men, women, unisex..."
                required
              />
            </div>

            <div className="admin-form-field">
              <label>Price</label>

              <input
                type="number"
                name="price"
                min="0"
                value={formData.price}
                onChange={handleChange}
                required
              />
            </div>

            <div className="admin-form-field">
              <label>Discount Price</label>

              <input
                type="number"
                name="discountPrice"
                min="0"
                value={formData.discountPrice}
                onChange={handleChange}
              />
            </div>

            <div className="admin-form-field">
              <label>Stock</label>

              <input
                type="number"
                name="stock"
                min="0"
                value={formData.stock}
                onChange={handleChange}
              />
            </div>

            <div className="admin-form-field">
              <label>Sizes</label>

              <input
                type="text"
                name="sizes"
                value={formData.sizes}
                onChange={handleChange}
                placeholder="S, M, L, XL"
              />
            </div>

            <div className="admin-form-field full-width">
              <label>Colors</label>

              <input
                type="text"
                name="colors"
                value={formData.colors}
                onChange={handleChange}
                placeholder="Black, White, Blue"
              />
            </div>

            <div className="admin-form-field full-width">
              <label>Description</label>

              <textarea
                name="description"
                rows="5"
                value={formData.description}
                onChange={handleChange}
              />
            </div>

          </div>

          <div className="admin-form-checkboxes">

            <label>
              <input
                type="checkbox"
                name="newArrival"
                checked={formData.newArrival}
                onChange={handleChange}
              />
              New Arrival
            </label>

            <label>
              <input
                type="checkbox"
                name="bestSeller"
                checked={formData.bestSeller}
                onChange={handleChange}
              />
              Best Seller
            </label>

            <label>
              <input
                type="checkbox"
                name="featured"
                checked={formData.featured}
                onChange={handleChange}
              />
              Featured
            </label>

          </div>

          <div className="admin-form-actions">

            <button
              type="button"
              onClick={() =>
                navigate("/admin/products")
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "Adding..."
                : "Add Product"}
            </button>

          </div>

        </form>
      </section>
    </main>
  );
}

export default AdminAddProduct;
