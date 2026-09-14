import { Link } from "react-router-dom";

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
                  : `https://api.lanawardrobe.in${product.imageUrl}`
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
                  â‚¹{product.discountPrice}
                </span>

                <span className="original-price">
                  â‚¹{product.price}
                </span>
              </>
            ) : (
              <span className="discount-price">
                â‚¹{product.price}
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
