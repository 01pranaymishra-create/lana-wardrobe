import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/lana-logo.png";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [shopOpen, setShopOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);

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

    closeMobileMenu();
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setShopOpen(false);
    setProductsOpen(false);
    setCustomizeOpen(false);
  };

  return (
    <header className="navbar">

      {/* LOGO */}
      <Link
        to="/"
        className="logo"
        onClick={closeMobileMenu}
      >
        <img
          src={logo}
          alt="Lana Wardrobe"
          className="navbar-logo"
        />
      </Link>

      {/* MAIN NAVIGATION */}
      <nav
        className={`main-nav ${
          mobileMenuOpen ? "mobile-open" : ""
        }`}
      >
        {/* MOBILE CLOSE BUTTON */}
        <button
          type="button"
          className="mobile-menu-close"
          onClick={closeMobileMenu}
          aria-label="Close menu"
        >
          ✕
        </button>

        <Link
          to="/"
          onClick={closeMobileMenu}
        >
          Home
        </Link>

        {/* SHOP DROPDOWN */}
        <div className="nav-dropdown">
          <button
            type="button"
            className="nav-dropdown-button"
            onClick={() =>
              setShopOpen((prev) => !prev)
            }
          >
            Shop
            <span>
              {shopOpen ? "▲" : "▼"}
            </span>
          </button>

          <div
            className={`dropdown-menu ${
              shopOpen
                ? "mobile-dropdown-open"
                : ""
            }`}
          >
            <Link
              to="/shop"
              onClick={closeMobileMenu}
            >
              Shop All
            </Link>

            <Link
              to="/latest"
              onClick={closeMobileMenu}
            >
              New Arrivals
            </Link>

            <Link
              to="/best-sellers"
              onClick={closeMobileMenu}
            >
              Best Sellers
            </Link>

            <Link
              to="/offers"
              onClick={closeMobileMenu}
            >
              Offers
            </Link>
          </div>
        </div>

        {/* PRODUCTS DROPDOWN */}
        <div className="nav-dropdown">
          <button
            type="button"
            className="nav-dropdown-button"
            onClick={() =>
              setProductsOpen((prev) => !prev)
            }
          >
            Products
            <span>
              {productsOpen ? "▲" : "▼"}
            </span>
          </button>

          <div
            className={`dropdown-menu ${
              productsOpen
                ? "mobile-dropdown-open"
                : ""
            }`}
          >
            <Link
              to="/category/men"
              onClick={closeMobileMenu}
            >
              Men
            </Link>

            <Link
              to="/category/women"
              onClick={closeMobileMenu}
            >
              Women
            </Link>

            <Link
              to="/category/unisex"
              onClick={closeMobileMenu}
            >
              Unisex
            </Link>

            <Link
              to="/category/sports"
              onClick={closeMobileMenu}
            >
              Sports T-Shirts
            </Link>
          </div>
        </div>

        {/* CUSTOMIZE & BULK DROPDOWN */}
        <div className="nav-dropdown">
          <button
            type="button"
            className="nav-dropdown-button"
            onClick={() =>
              setCustomizeOpen((prev) => !prev)
            }
          >
            Customize & Bulk
            <span>
              {customizeOpen ? "▲" : "▼"}
            </span>
          </button>

          <div
            className={`dropdown-menu ${
              customizeOpen
                ? "mobile-dropdown-open"
                : ""
            }`}
          >
            <Link
              to="/customize"
              onClick={closeMobileMenu}
            >
              Customize T-Shirt
            </Link>

            <Link
              to="/bulk-orders"
              onClick={closeMobileMenu}
            >
              Bulk Orders
            </Link>
          </div>
        </div>

        <Link
          to="/contact-us"
          onClick={closeMobileMenu}
        >
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
            🔍
          </button>
        </form>

        {/* NAVBAR ACTIONS */}
        <div className="nav-actions">

          {/* WISHLIST */}
          <Link
            to="/wishlist"
            className="wishlist-link"
            aria-label="Wishlist"
            onClick={closeMobileMenu}
          >
            <span className="wishlist-icon">
              ♡
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
            onClick={closeMobileMenu}
          >
            <span className="cart-icon">
              🛒
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
                  👤
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

                  <Link
                    to="/account"
                    onClick={closeMobileMenu}
                  >
                    My Account
                  </Link>

                  <Link
                    to="/orders"
                    onClick={closeMobileMenu}
                  >
                    Your Orders
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      closeMobileMenu();

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
              <>
                <button
                  type="button"
                  className="account-button"
                  aria-label="Account"
                >
                  👤
                </button>

                <div className="account-dropdown">

                  <Link
                    to="/login"
                    onClick={closeMobileMenu}
                  >
                    Login
                  </Link>

                  <Link
                    to="/signup"
                    onClick={closeMobileMenu}
                  >
                    Create Account
                  </Link>

                </div>
              </>
            )}

          </div>

        </div>

        {/* MOBILE HAMBURGER */}
        {!mobileMenuOpen && (
          <button
            type="button"
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenuOpen(true)
            }
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            ☰
          </button>
        )}

      </div>

    </header>
  );
}

export default Navbar;