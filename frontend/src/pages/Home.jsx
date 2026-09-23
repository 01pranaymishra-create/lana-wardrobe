import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import banner1 from "../assets/banner1.jpeg";
import banner2 from "../assets/banner2.jpeg";
import banner3 from "../assets/banner3.jpeg";

import menCategory from "../assets/categories/men.jpeg";
import womenCategory from "../assets/categories/women.jpeg";
import unisexCategory from "../assets/categories/unisex.jpeg";
import sportsCategory from "../assets/categories/sports.jpeg";
import customizeCategory from "../assets/categories/customize.jpeg";

import ProductCard from "../components/ProductCard";
import { useProducts } from "../context/ProductContext";

function Home() {
  const { products, loading, error } = useProducts();

  const banners = [
    {
      image: banner1,
      title: "NEW ARRIVAL",
      subtitle: "Latest T-Shirt Collection",
    },
    {
      image: banner2,
      title: "TRENDING NOW",
      subtitle: "Fresh Styles for You",
    },
    {
      image: banner3,
      title: "JUST DROPPED",
      subtitle: "Explore New Designs",
    },
  ];

  const [currentBanner, setCurrentBanner] = useState(0);

  const featuredProducts = products.filter(
    (product) => product.featured
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((current) =>
        current === banners.length - 1
          ? 0
          : current + 1
      );
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <main>
        <div
          style={{
            padding: "80px",
            textAlign: "center",
          }}
        >
          Loading products...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main>
        <div
          style={{
            padding: "80px",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      </main>
    );
  }

  return (
    <main>
      {/* Hero Section */}

      <section className="hero-section">
        <div className="hero-content">
          <p className="hero-small">
            NEW COLLECTION 2026
          </p>

          <h1>
            Made for Youth.
            <br />
            <span>Made with Love.</span>
          </h1>

          <p className="hero-description">
            Discover fashion designed for youth,
            comfort, confidence, and everyday style.
          </p>

          <Link
            to="/shop"
            className="shop-button"
          >
            SHOP NOW →
          </Link>
        </div>

        {/* Promotional Carousel */}

        <div className="hero-image">
          <Link
            to="/latest"
            className="promo-card"
          >
            <img
              key={currentBanner}
              src={banners[currentBanner].image}
              alt={banners[currentBanner].subtitle}
              className="promo-image"
            />

            <div className="promo-overlay">
              <p>
                {banners[currentBanner].title}
              </p>

              <h2>
                {banners[currentBanner].subtitle}
              </h2>

              <span>
                Explore Now →
              </span>
            </div>
          </Link>

          <div className="carousel-dots">
            {banners.map((_, index) => (
              <button
                key={index}
                type="button"
                className={
                  index === currentBanner
                    ? "carousel-dot active"
                    : "carousel-dot"
                }
                onClick={() =>
                  setCurrentBanner(index)
                }
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}

      <section className="categories-section">
        <div className="section-heading">
          <p>EXPLORE</p>

          <h2>
            Shop By Category
          </h2>
        </div>

        <div className="category-grid">

          <Link
            to="/category/men"
            className="category-card"
          >
            <div className="category-placeholder">
              <img
                src={menCategory}
                alt="Men T-Shirts"
                className="category-image"
              />
            </div>

            <h3>Men</h3>

            <p>
              Explore Collection →
            </p>
          </Link>

          <Link
            to="/category/women"
            className="category-card"
          >
            <div className="category-placeholder">
              <img
                src={womenCategory}
                alt="Women T-Shirts"
                className="category-image"
              />
            </div>

            <h3>Women</h3>

            <p>
              Explore Collection →
            </p>
          </Link>

          <Link
            to="/category/unisex"
            className="category-card"
          >
            <div className="category-placeholder">
              <img
                src={unisexCategory}
                alt="Unisex T-Shirts"
                className="category-image"
              />
            </div>

            <h3>Unisex</h3>

            <p>
              Explore Collection →
            </p>
          </Link>

          {/* Sports - Coming Soon */}

          <div className="category-card sports-card">
            <div className="category-placeholder sports-category">
              <img
                src={sportsCategory}
                alt="Sports T-Shirts"
                className="category-image"
              />

              <div className="sports-coming-soon">
                COMING SOON
              </div>
            </div>

            <h3>
              Sports T-Shirts
            </h3>

            <p className="coming-soon-text">
              Coming Soon
            </p>
          </div>

          <Link
            to="/customize"
            className="category-card"
          >
            <div className="category-placeholder">
              <img
                src={customizeCategory}
                alt="Customize T-Shirt"
                className="category-image"
              />
            </div>

            <h3>
              Customize T-Shirt
            </h3>

            <p>
              Create Your Own →
            </p>
          </Link>

        </div>
      </section>

      {/* Featured Products */}

      <section className="featured-section">
        <div className="section-heading">
          <p>
            CURATED FOR YOU
          </p>

          <h2>
            Featured Collection
          </h2>
        </div>

        <div className="product-grid">
          {featuredProducts.map(
            (product) => (
              <ProductCard
                key={product.id}
                product={product}
              />
            )
          )}
        </div>

        <div className="featured-view-all">
          <Link
            to="/shop"
            className="shop-button"
          >
            VIEW ALL PRODUCTS →
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Home;