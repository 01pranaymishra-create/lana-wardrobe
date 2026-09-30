import { useState } from "react";
import { useNavigate } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://api.lanawardrobe.in";

function AdminAddProduct() {
  const navigate = useNavigate();

  const [formData, setFormData] =
    useState({
      name: "",
      category: "",
      price: "",
      discountPrice: "",
      description: "",
      sizes: "",
      colors: "",
      colorStock: [],
      newArrival: false,
      bestSeller: false,
      featured: false,
    });

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  // =========================
  // NORMAL FORM CHANGES
  // =========================

  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

  // =========================
  // COLORS + COLOR STOCK
  // =========================

  const handleColorsChange = (e) => {
    const colorsText =
      e.target.value;

    const colorNames =
      colorsText
        .split(",")
        .map((color) =>
          color.trim()
        )
        .filter(Boolean);

    setFormData((prev) => {
      const nextColorStock =
        colorNames.map(
          (colorName) => {
            const existing =
              prev.colorStock.find(
                (item) =>
                  String(
                    item.color_name
                  ).toLowerCase() ===
                  colorName.toLowerCase()
              );

            return {
              color_name:
                colorName,

              stock_quantity:
                existing
                  ? existing.stock_quantity
                  : "",
            };
          }
        );

      return {
        ...prev,
        colors: colorsText,
        colorStock:
          nextColorStock,
      };
    });
  };

  // =========================
  // COLOR STOCK CHANGE
  // =========================

  const handleColorStockChange = (
    index,
    value
  ) => {
    // Prevent negative stock.
    if (
      value !== "" &&
      Number(value) < 0
    ) {
      return;
    }

    setFormData((prev) => ({
      ...prev,

      colorStock:
        prev.colorStock.map(
          (item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  stock_quantity:
                    value,
                }
              : item
        ),
    }));
  };

  // =========================
  // SUBMIT
  // =========================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const token =
        localStorage.getItem(
          "lana_token"
        );

      const sizes =
        formData.sizes
          .split(",")
          .map((size) =>
            size.trim()
          )
          .filter(Boolean);

      const colors =
        formData.colors
          .split(",")
          .map((color) =>
            color.trim()
          )
          .filter(Boolean);

      if (colors.length === 0) {
        throw new Error(
          "Please add at least one color."
        );
      }

      if (
        formData.colorStock.length !==
        colors.length
      ) {
        throw new Error(
          "Color-wise stock is incomplete."
        );
      }

      const colorStock =
        formData.colorStock.map(
          (item) => ({
            color_name:
              item.color_name,

            stock_quantity:
              Number(
                item.stock_quantity
              ),
          })
        );

      const invalidStock =
        colorStock.some(
          (item) =>
            !Number.isInteger(
              item.stock_quantity
            ) ||
            item.stock_quantity < 0
        );

      if (invalidStock) {
        throw new Error(
          "Please enter a valid stock quantity for every color."
        );
      }

      const response =
        await fetch(
          `${API_URL}/api/admin/products`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                name:
                  formData.name,

                category:
                  formData.category,

                price:
                  formData.price,

                discountPrice:
                  formData.discountPrice,

                description:
                  formData.description,

                sizes,

                colors,

                colorStock,

                newArrival:
                  formData.newArrival,

                bestSeller:
                  formData.bestSeller,

                featured:
                  formData.featured,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to add product."
        );
      }

      alert(
        "Product added successfully."
      );

      navigate(
        "/admin/products"
      );
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
          <p>
            LANA WARDROBE ADMIN
          </p>

          <h1>
            Add Product
          </h1>

          <p>
            Create a new product
            for your store.
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
              <label>
                Product Name
              </label>

              <input
                type="text"
                name="name"
                value={
                  formData.name
                }
                onChange={
                  handleChange
                }
                required
              />
            </div>

            <div className="admin-form-field">
              <label>
                Category
              </label>

              <input
                type="text"
                name="category"
                value={
                  formData.category
                }
                onChange={
                  handleChange
                }
                placeholder="men, women, unisex..."
                required
              />
            </div>

            <div className="admin-form-field">
              <label>
                Price
              </label>

              <input
                type="number"
                name="price"
                min="0"
                value={
                  formData.price
                }
                onChange={
                  handleChange
                }
                required
              />
            </div>

            <div className="admin-form-field">
              <label>
                Discount Price
              </label>

              <input
                type="number"
                name="discountPrice"
                min="0"
                value={
                  formData
                    .discountPrice
                }
                onChange={
                  handleChange
                }
              />
            </div>

            <div className="admin-form-field">
              <label>
                Sizes
              </label>

              <input
                type="text"
                name="sizes"
                value={
                  formData.sizes
                }
                onChange={
                  handleChange
                }
                placeholder="S, M, L, XL"
              />
            </div>

            <div className="admin-form-field full-width">
              <label>
                Colors
              </label>

              <input
                type="text"
                name="colors"
                value={
                  formData.colors
                }
                onChange={
                  handleColorsChange
                }
                placeholder="Black, White, Blue"
              />
            </div>

            {formData
              .colorStock
              .length > 0 && (
              <div className="admin-form-field full-width">
                <label>
                  Color-wise Stock
                </label>

                <div className="admin-color-stock-list">
                  {formData
                    .colorStock
                    .map(
                      (
                        item,
                        index
                      ) => (
                        <div
                          key={`${item.color_name}-${index}`}
                          className="admin-color-stock-row"
                        >
                          <span>
                            {
                              item.color_name
                            }
                          </span>

                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={
                              item.stock_quantity
                            }
                            onChange={(
                              e
                            ) =>
                              handleColorStockChange(
                                index,
                                e
                                  .target
                                  .value
                              )
                            }
                            placeholder="Stock"
                            required
                          />
                        </div>
                      )
                    )}
                </div>
              </div>
            )}

            <div className="admin-form-field full-width">
              <label>
                Description
              </label>

              <textarea
                name="description"
                rows="5"
                value={
                  formData
                    .description
                }
                onChange={
                  handleChange
                }
              />
            </div>
          </div>

          <div className="admin-form-checkboxes">
            <label>
              <input
                type="checkbox"
                name="newArrival"
                checked={
                  formData
                    .newArrival
                }
                onChange={
                  handleChange
                }
              />
              New Arrival
            </label>

            <label>
              <input
                type="checkbox"
                name="bestSeller"
                checked={
                  formData
                    .bestSeller
                }
                onChange={
                  handleChange
                }
              />
              Best Seller
            </label>

            <label>
              <input
                type="checkbox"
                name="featured"
                checked={
                  formData.featured
                }
                onChange={
                  handleChange
                }
              />
              Featured
            </label>
          </div>

          <div className="admin-form-actions">
            <button
              type="button"
              onClick={() =>
                navigate(
                  "/admin/products"
                )
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