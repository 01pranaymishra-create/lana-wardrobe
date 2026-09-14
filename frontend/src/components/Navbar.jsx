import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/lana-logo.png";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const [searchTerm, setSearchTerm] = useState("");
  const {
  user,
  isLoggedIn,
  logout,
} = useAuth();

  const navigate = useNavigate();

  const { cartItems } = useCart();
  const { wishlistItems } = useWishlist();

  const wishlistCount = wishlistItems.length;

  const cartCount = cartItems.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const handleSearch = (e) => {
    e.preventDefault();

    const trimmedSearch = searchTerm.trim();

    if (!trimmedSearch) return;

    navigate(
      `/shop?search=${encodeURIComponent(trimmedSearch)}`
    );
  };

  return (
    <header className="navbar">

      {/* LOGO */}
      <Link to="/" className="logo">
        <img
          src={logo}
          alt="Lana Wardrobe"
          className="navbar-logo"
        />
      </Link>

      {/* MAIN NAVIGATION */}
      <nav className="main-nav">

        <Link to="/">Home</Link>

        {/* SHOP DROPDOWN */}
        <div className="nav-dropdown">

          <button
            type="button"
            className="nav-dropdown-button"
          >
            Shop <span>âŒ„</span>
          </button>

          <div className="dropdown-menu">

            <Link to="/shop">
              Shop All
            </Link>

            <Link to="/latest">
              New Arrivals
            </Link>

            <Link to="/best-sellers">
              Best Sellers
            </Link>

            <Link to="/offers">
              Offers
            </Link>

          </div>
        </div>

        {/* PRODUCTS DROPDOWN */}
        <div className="nav-dropdown">

          <button
            type="button"
            className="nav-dropdown-button"
          >
            Products <span>âŒ„</span>
          </button>

          <div className="dropdown-menu">

            <Link to="/category/men">
              Men
            </Link>

            <Link to="/category/women">
              Women
            </Link>

            <Link to="/category/unisex">
              Unisex
            </Link>

            <Link to="/category/sports">
              Sports T-Shirts
            </Link>

          </div>
        </div>

        {/* CUSTOMIZE & BULK DROPDOWN */}
        <div className="nav-dropdown">

          <button
            type="button"
            className="nav-dropdown-button"
          >
            Customize & Bulk <span>âŒ„</span>
          </button>

          <div className="dropdown-menu">

            <Link to="/customize">
              Customize T-Shirt
            </Link>

            <Link to="/bulk-orders">
              Bulk Orders
            </Link>

          </div>
        </div>

        <Link to="/contact-us">
        Contact Us
        </Link>

      </nav>

      {/* RIGHT SIDE */}
      <div className="nav-right">

        {/* SEARCH */}
        <form
          className="navbar-search"
          onSubmit={handleSearch}
        >
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) =>
              setSearchTerm(e.target.value)
            }
          />

          <button
            type="submit"
            aria-label="Search"
          >
            ðŸ”
          </button>
        </form>

        {/* NAVBAR ACTIONS */}
        <div className="nav-actions">

          {/* WISHLIST */}
          <Link
            to="/wishlist"
            className="wishlist-link"
            aria-label="Wishlist"
          >
            <span className="wishlist-icon">
              â™¡
            </span>

            {wishlistCount > 0 && (
              <span className="wishlist-count">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* CART */}
          <Link
            to="/cart"
            className="cart-link"
            aria-label="Cart"
          >
            <span className="cart-icon">
              ðŸ›’
            </span>

            {cartCount > 0 && (
              <span className="cart-count">
                {cartCount}
              </span>
            )}
          </Link>

          {/* ACCOUNT */}
<div className="account-menu">

  {isLoggedIn ? (
    <>
      <button
        type="button"
        className="account-button"
        aria-label="Account"
      >
        ðŸ‘¤
      </button>

      <div className="account-dropdown">

        <div className="account-user">
          <strong>
            {user?.full_name}
          </strong>

          <span>
            {user?.email}
          </span>
        </div>

        <Link to="/account">
          My Account
        </Link>

        <Link to="/orders">
          Your Orders
        </Link>

        <button
  type="button"
  onClick={() => {
    logout();

    navigate("/login", {
      replace: true,
    });
  }}
>
  Logout
</button>

      </div>
    </>
  ) : (
    <div className="account-menu">

      <button
        type="button"
        className="account-button"
        aria-label="Account"
      >
        ðŸ‘¤
      </button>

      <div className="account-dropdown">

        <Link to="/login">
          Login
        </Link>

        <Link to="/signup">
          Create Account
        </Link>

      </div>

    </div>
  )}

</div>

        </div>

      </div>

    </header>
  );
}

export default Navbar;
