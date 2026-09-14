import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useProducts } from "../context/ProductContext";

function Shop() {
  const { products, loading, error } = useProducts();
  const [searchParams] = useSearchParams();

  const searchTerm =
    searchParams.get("search")?.toLowerCase().trim() || "";
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [sortOption, setSortOption] = useState("");

  const handleCategoryChange = (category) => {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category]
    );
  };

  const handleSizeChange = (size) => {
    setSelectedSizes((current) =>
      current.includes(size)
        ? current.filter((item) => item !== size)
        : [...current, size]
    );
  };

  let filteredProducts = products.filter((product) => {
  const categoryMatches =
    selectedCategories.length === 0 ||
    selectedCategories.includes(product.category);

  const sizeMatches =
    selectedSizes.length === 0 ||
    selectedSizes.some((size) =>
      product.sizes.includes(size)
    );

  const searchMatches =
    searchTerm === "" ||
    product.name.toLowerCase().includes(searchTerm) ||
    product.category.toLowerCase().includes(searchTerm) ||
    product.description.toLowerCase().includes(searchTerm) ||
    product.colors.some((color) =>
      color.toLowerCase().includes(searchTerm)
    );

  return categoryMatches && sizeMatches && searchMatches;
});

  if (sortOption === "low-high") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) =>
        (a.discountPrice || a.price) -
        (b.discountPrice || b.price)
    );
  }

  if (sortOption === "high-low") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) =>
        (b.discountPrice || b.price) -
        (a.discountPrice || a.price)
    );
  }

  if (sortOption === "newest") {
    filteredProducts = [...filteredProducts].sort(
      (a, b) => b.id - a.id
    );
  }
  if (loading) {
  return (
    <main className="shop-page">
      <div style={{ padding: "80px", textAlign: "center" }}>
        Loading products...
      </div>
    </main>
  );
}

if (error) {
  return (
    <main className="shop-page">
      <div style={{ padding: "80px", textAlign: "center" }}>
        {error}
      </div>
    </main>
  );
}

  return (
    <main className="shop-page">
      <section className="shop-header">
        <p>OUR COLLECTION</p>
        <h1>Shop All</h1>
        <p>
          Discover the latest collection from Lana Wardrobe.
        </p>
      </section>

      <section className="shop-content">
        <aside className="filters">
          <h3>Filters</h3>

          <div className="filter-group">
            <h4>Category</h4>

            <label>
              <input
                type="checkbox"
                checked={selectedCategories.includes("men")}
                onChange={() => handleCategoryChange("men")}
              />
              Men
            </label>

            <label>
              <input
                type="checkbox"
                checked={selectedCategories.includes("women")}
                onChange={() => handleCategoryChange("women")}
              />
              Women
            </label>

            <label>
              <input
                type="checkbox"
                checked={selectedCategories.includes("unisex")}
                onChange={() => handleCategoryChange("unisex")}
              />
              Unisex
            </label>

            <label>
              <input
                type="checkbox"
                checked={selectedCategories.includes("sports")}
                onChange={() => handleCategoryChange("sports")}
              />
              Sports T-Shirts
            </label>
          </div>

          <div className="filter-group">
            <h4>Size</h4>

            {["S", "M", "L", "XL"].map((size) => (
              <label key={size}>
                <input
                  type="checkbox"
                  checked={selectedSizes.includes(size)}
                  onChange={() => handleSizeChange(size)}
                />
                {size}
              </label>
            ))}
          </div>

          <button
            className="clear-filters"
            onClick={() => {
              setSelectedCategories([]);
              setSelectedSizes([]);
              setSortOption("");
            }}
          >
            Clear All Filters
          </button>
        </aside>

        <div className="shop-products">
          <div className="shop-toolbar">
            <span>{filteredProducts.length} Products</span>

            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value)}
            >
              <option value="">Sort By</option>
              <option value="low-high">
                Price: Low to High
              </option>
              <option value="high-low">
                Price: High to Low
              </option>
              <option value="newest">
                Newest
              </option>
            </select>
          </div>

          <div className="product-grid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

export default Shop;