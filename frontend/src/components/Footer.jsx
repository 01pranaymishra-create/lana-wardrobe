import { Link } from "react-router-dom";

function Footer() {
  return (
    <footer className="footer">

      {/* BRAND */}
      <div>
        <h2>LANA WARDROBE</h2>
        <p>Made for Youth. Made with Love.</p>
      </div>

      {/* QUICK LINKS */}
      <div>
        <h3>Quick Links</h3>

        <Link to="/shop">
          Shop
        </Link>

        <Link to="/about-us">
          About Us
        </Link>
      </div>

      {/* CUSTOMIZE & BULK */}
      <div>
        <h3>Customize & Bulk</h3>

        <Link to="/customize">
          Customize T-Shirt
        </Link>

        <Link to="/bulk-orders">
          Bulk Orders
        </Link>
      </div>

      {/* CUSTOMER CARE */}
      <div>
        <h3>Customer Care</h3>

        <Link to="/contact-us">
          Contact Us
        </Link>

        <Link to="/shipping-returns">
             Shipping & Returns
        </Link>

        <Link to="/privacy-policy">
          Privacy Policy
        </Link>
      </div>

    </footer>
  );
}

export default Footer;