import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://api.lanawardrobe.in";

function AdminEditProduct() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [formData, setFormData] = useState({
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
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [existingImages, setExistingImages] =
    useState([]);

  const [selectedImages, setSelectedImages] =
    useState([]);

  const [imagePreviews, setImagePreviews] =
    useState([]);

  const [uploadingImages, setUploadingImages] =
    useState(false);

  // =========================
  // LOAD EXISTING IMAGES
  // =========================

  const fetchExistingImages = useCallback(
    async () => {
      try {
        const response = await fetch(
          `${API_URL}/api/products/${id}/images`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load product images."
          );
        }

        setExistingImages(
          data.images || []
        );
      } catch (error) {
        console.error(
          "Existing images fetch error:",
          error
        );
      }
    },
    [id]
  );

  // =========================
  // LOAD PRODUCT
  // =========================

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const token =
          localStorage.getItem(
            "lana_token"
          );

        const response = await fetch(
          `${API_URL}/api/admin/products/${id}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load product."
          );
        }

        const product =
          data.product;

        setFormData({
          name:
            product.name || "",

          category:
            product.category || "",

          price:
            product.price ?? "",

          discountPrice:
            product.discount_price ??
            "",

          description:
            product.description || "",

          sizes:
            Array.isArray(
              product.sizes
            )
              ? product.sizes.join(
                  ", "
                )
              : "",

          colors:
            Array.isArray(
              product.colors
            )
              ? product.colors.join(
                  ", "
                )
              : "",

              colorStock:
                Array.isArray(product.color_stock)
                  ? product.color_stock.map((item) => ({
                      color_name:
                        item.color_name || "",
                      stock_quantity:
                        item.stock_quantity ?? 0,
                    }))
                  : [],

          newArrival:
            Boolean(
              product.new_arrival
            ),

          bestSeller:
            Boolean(
              product.best_seller
            ),

          featured:
            Boolean(
              product.featured
            ),
        });

        setError("");
      } catch (error) {
        console.error(
          "Fetch product error:",
          error
        );

        setError(
          error.message ||
            "Failed to load product."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
    fetchExistingImages();
  }, [id, fetchExistingImages]);

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

    setFormData((previous) => ({
      ...previous,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  };

const buildColorStock = (colorsText) => {
  const colorNames = colorsText
    .split(",")
    .map((color) => color.trim())
    .filter(Boolean);

  setFormData((prev) => ({
    ...prev,
    colorStock: colorNames.map(
      (colorName) => {
        const existing =
          prev.colorStock.find(
            (item) =>
              item.color_name.toLowerCase() ===
              colorName.toLowerCase()
          );

        return {
          color_name: colorName,
          stock_quantity:
            existing?.stock_quantity ?? "",
        };
      }
    ),
  }));
};

  // =========================
  // MULTIPLE IMAGE SELECTION
  // =========================

  const handleImageChange = (e) => {
    const files = Array.from(
      e.target.files
    );

    if (files.length === 0) {
      return;
    }

    /*
      We currently allow maximum
      8 images total per product.
    */
    if (
      existingImages.length +
        files.length >
      8
    ) {
      alert(
        `This product can have a maximum of 8 images. You already have ${existingImages.length} image(s).`
      );

      e.target.value = "";
      return;
    }

    // Clear previous local previews
    imagePreviews.forEach(
      (preview) => {
        URL.revokeObjectURL(
          preview
        );
      }
    );

    setSelectedImages(files);

    const previews =
      files.map((file) =>
        URL.createObjectURL(file)
      );

    setImagePreviews(
      previews
    );
  };

  // =========================
  // UPLOAD PRODUCT IMAGES
  // =========================

  const handleImageUpload =
    async () => {
      if (
        selectedImages.length === 0
      ) {
        alert(
          "Please choose at least one image."
        );

        return;
      }

      try {
        setUploadingImages(true);

        const token =
          localStorage.getItem(
            "lana_token"
          );

        const uploadData =
          new FormData();

        selectedImages.forEach(
          (image) => {
            uploadData.append(
              "productImages",
              image
            );
          }
        );

        const response =
          await fetch(
            `${API_URL}/api/admin/products/${id}/images`,
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body: uploadData,
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Image upload failed."
          );
        }

        alert(
          `${data.images.length} image(s) uploaded successfully.`
        );

        // Refresh saved images immediately
        await fetchExistingImages();

        // Remove temporary previews
        imagePreviews.forEach(
          (preview) => {
            URL.revokeObjectURL(
              preview
            );
          }
        );

        setSelectedImages([]);
        setImagePreviews([]);
      } catch (error) {
        console.error(
          "Product images upload error:",
          error
        );

        alert(
          error.message ||
            "Failed to upload product images."
        );
      } finally {
        setUploadingImages(
          false
        );
      }
    };

const handleSetPrimary = async (imageId) => {
  try {
    const token = localStorage.getItem("lana_token");

    const response = await fetch(
      `${API_URL}/api/admin/products/${id}/images/${imageId}/primary`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Failed to set primary image."
      );
    }

    alert("Primary image updated successfully.");

    await fetchExistingImages();
  } catch (error) {
    console.error("Set primary image error:", error);

    alert(
      error.message ||
        "Failed to set primary image."
    );
  }
};

const handleDeleteImage = async (imageId) => {
  const confirmed = window.confirm(
    "Are you sure you want to delete this image?"
  );

  if (!confirmed) {
    return;
  }

  try {
    const token = localStorage.getItem("lana_token");

    const response = await fetch(
      `${API_URL}/api/admin/products/${id}/images/${imageId}`,
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
        data.message || "Failed to delete image."
      );
    }

    alert("Image deleted successfully.");

    await fetchExistingImages();
  } catch (error) {
    console.error("Delete image error:", error);

    alert(
      error.message ||
        "Failed to delete image."
    );
  }
};

  // =========================
  // SAVE PRODUCT DETAILS
  // =========================

  const handleSubmit =
    async (e) => {
      e.preventDefault();

      try {
        setSaving(true);
        setError("");

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

        const response =
          await fetch(
            `https://api.lanawardrobe.in/api/admin/products/${id}`,
            {
              method: "PUT",

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

                  colorStock:
                    formData.colorStock,

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
              "Failed to update product."
          );
        }

        alert(
          "Product updated successfully."
        );

        navigate(
          "/admin/products"
        );
      } catch (error) {
        console.error(
          "Update product error:",
          error
        );

        setError(
          error.message ||
            "Failed to update product."
        );
      } finally {
        setSaving(false);
      }
    };

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <main className="admin-page">
        <p>
          Loading product...
        </p>
      </main>
    );
  }

  // =========================
  // PAGE
  // =========================

  return (
    <main className="admin-page">

      <section className="admin-product-form-section">

        <div className="admin-product-form-header">

          <p>
            LANA WARDROBE ADMIN
          </p>

          <h1>
            Edit Product
          </h1>

          <p>
            Update product information.
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
                  formData.discountPrice
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
                placeholder=
                  "S, M, L, XL"
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
                onChange={(e) => {
                  handleChange(e);
                  buildColorStock(
                    e.target.value
                  );
                }}
                placeholder=
                  "Black, White, Blue"
              />
            </div>

            {formData.colorStock.length > 0 && (
              <div className="admin-form-field full-width">
                <label>
                  Color-wise Stock
                </label>

                <div className="admin-color-stock-list">
                  {formData.colorStock.map(
                    (item, index) => (
                      <div
                        key={`${item.color_name}-${index}`}
                        className="admin-color-stock-row"
                      >
                        <span>
                          {item.color_name}
                        </span>

                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={
                            item.stock_quantity
                          }
                          onChange={(e) => {
                            const value =
                              e.target.value;

                            setFormData(
                              (prev) => ({
                                ...prev,

                                colorStock:
                                  prev.colorStock.map(
                                    (
                                      colorItem,
                                      colorIndex
                                    ) =>
                                      colorIndex ===
                                      index
                                        ? {
                                            ...colorItem,
                                            stock_quantity:
                                              value,
                                          }
                                        : colorItem
                                  ),
                              })
                            );
                          }}
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
                  formData.description
                }
                onChange={
                  handleChange
                }
              />
            </div>

          </div>

          {/* =========================
              PRODUCT IMAGES
          ========================= */}

          <div className="admin-product-image-upload">

            <h3>
              Product Images
            </h3>

            <p>
              Maximum 8 images per product.
            </p>

            {/* EXISTING SAVED IMAGES */}

            {existingImages.length >
              0 && (
              <div className="admin-existing-images">

                <h4>
                  Existing Images
                </h4>

                <div className="admin-image-previews">

                 {existingImages.map((image) => (
  <div
    className="admin-image-upload-box admin-existing-image-card"
    key={image.id ?? image.image_url}
  >
    <img
      src={
        image.image_url.startsWith("http")
          ? image.image_url
          : `${API_URL}${image.image_url}`
      }
      alt="Product"
    />

    {image.is_primary ? (
      <span className="admin-primary-image-label">
        Primary
      </span>
    ) : (
      <button
        type="button"
        className="admin-set-primary-btn"
        onClick={() =>
          handleSetPrimary(image.id)
        }
      >
        Set Primary
      </button>
    )}

    <button
      type="button"
      className="admin-delete-image-btn"
      onClick={() =>
        handleDeleteImage(image.id)
      }
    >
      Delete
    </button>
  </div>
))}

                </div>

              </div>
            )}

            {/* NEW IMAGE PREVIEWS */}

            {imagePreviews.length >
              0 && (
              <div className="admin-new-image-previews">

                <h4>
                  New Images
                </h4>

                <div className="admin-image-previews">

                  {imagePreviews.map(
                    (
                      preview,
                      index
                    ) => (
                      <div
                        className="admin-image-upload-box"
                        key={
                          preview
                        }
                      >
                        <img
                          src={
                            preview
                          }
                          alt={`Preview ${
                            index + 1
                          }`}
                        />
                      </div>
                    )
                  )}

                </div>

              </div>
            )}

            {existingImages.length ===
              0 &&
              imagePreviews.length ===
                0 && (
                <div className="admin-image-previews">

                  <div className="admin-image-upload-box">

                    <div className="admin-image-placeholder">
                      No product images
                    </div>

                  </div>

                </div>
              )}

            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp"
              onChange={
                handleImageChange
              }
            />

            <button
              type="button"
              onClick={
                handleImageUpload
              }
              disabled={
                selectedImages.length ===
                  0 ||
                uploadingImages
              }
            >
              {uploadingImages
                ? "Uploading..."
                : "Upload Images"}
            </button>

          </div>

          {/* =========================
              PRODUCT FLAGS
          ========================= */}

          <div className="admin-form-checkboxes">

            <label>
              <input
                type="checkbox"
                name="newArrival"
                checked={
                  formData.newArrival
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
                  formData.bestSeller
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

          {/* =========================
              ACTIONS
          ========================= */}

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
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Changes"}
            </button>

          </div>

        </form>

      </section>

    </main>
  );
}

export default AdminEditProduct;