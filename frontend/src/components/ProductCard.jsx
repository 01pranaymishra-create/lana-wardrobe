import { Link } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://api.lanawardrobe.in";

function ProductCard({ product }) {
  return (
    <Link
      to={`/product/${product.id}`}
      className="product-card-link"
    >
      <div className="product-card">
        <div className="product-placeholder">
          {product.imageUrl ? (
            <img
              src={
                product.imageUrl.startsWith("http")
                  ? product.imageUrl
                  : `${API_URL}${product.imageUrl}`
              }
              alt={product.name}
              className="product-image"
            />
          ) : (
            <span>PRODUCT IMAGE</span>
          )}
        </div>

        <div className="product-info">
          <h3>{product.name}</h3>

          <div className="product-price">
            {product.discountPrice ? (
              <>
                <span className="discount-price">
                  ₹{product.discountPrice}
                </span>

                <span className="original-price">
                  ₹{product.price}
                </span>
              </>
            ) : (
              <span className="discount-price">
                ₹{product.price}
              </span>
            )}
          </div>

          {product.stock > 0 ? (
            <p className="stock-status">
              In Stock
            </p>
          ) : (
            <p className="out-of-stock">
              Out of Stock
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export default ProductCard;