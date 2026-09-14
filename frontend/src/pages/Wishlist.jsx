import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { useWishlist } from "../context/WishlistContext";

function Wishlist() {
  const {
    wishlistItems,
    removeFromWishlist,
  } = useWishlist();

  return (
    <main className="wishlist-page">
      <section className="wishlist-header">
        <p>SAVED FOR LATER</p>
        <h1>Your Wishlist</h1>
        <p>
          Keep your favourite Lana Wardrobe styles in one place.
        </p>
      </section>

      {wishlistItems.length === 0 ? (
        <section className="empty-wishlist">
          <h2>Your wishlist is empty</h2>

          <p>
            Save products you love and come back to them anytime.
          </p>

          <Link to="/shop" className="shop-button">
            EXPLORE PRODUCTS â†’
          </Link>
        </section>
      ) : (
        <section className="wishlist-products">
          <div className="product-grid">
            {wishlistItems.map((product) => (
              <div
                className="wishlist-item"
                key={product.id}
              >
                <ProductCard product={product} />

                <button
                  className="remove-wishlist-item"
                  onClick={() =>
                    removeFromWishlist(product.id)
                  }
                >
                  Remove from Wishlist
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default Wishlist;
