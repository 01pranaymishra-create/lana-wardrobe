import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { useProducts } from "../context/ProductContext";
import { useAuth } from "../context/AuthContext";

function ProductDetails() {
  const {
    products,
    loading,
    error,
  } = useProducts();

  const { id } = useParams();
  const navigate = useNavigate();

  const {
    isLoggedIn,
  } = useAuth();

  const {
    addToCart,
  } = useCart();

  const {
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  } = useWishlist();

  const product = products.find(
    (item) =>
      item.id === Number(id)
  );

  const productIsInWishlist =
    isInWishlist(product?.id);

  // ========================================
  // PRODUCT OPTIONS
  // ========================================

  const [
    selectedSize,
    setSelectedSize,
  ] = useState("");

  const [
    selectedColor,
    setSelectedColor,
  ] = useState("");

  const [
    quantity,
    setQuantity,
  ] = useState(1);

  // ========================================
  // PRODUCT IMAGES
  // ========================================

  const [
    productImages,
    setProductImages,
  ] = useState([]);

  const [
    selectedImage,
    setSelectedImage,
  ] = useState("");

  // ========================================
  // REVIEWS
  // ========================================

  const [
    reviews,
    setReviews,
  ] = useState([]);

  const [
    reviewSummary,
    setReviewSummary,
  ] = useState({
    total_reviews: 0,
    average_rating: 0,
    five_star: 0,
    four_star: 0,
    three_star: 0,
    two_star: 0,
    one_star: 0,
  });

  const [
    reviewsLoading,
    setReviewsLoading,
  ] = useState(true);

  const [
    selectedRating,
    setSelectedRating,
  ] = useState(0);

  const [
    reviewTitle,
    setReviewTitle,
  ] = useState("");

  const [
    reviewText,
    setReviewText,
  ] = useState("");

  const [
    submittingReview,
    setSubmittingReview,
  ] = useState(false);

  const [
    reviewMessage,
    setReviewMessage,
  ] = useState("");

  // ========================================
  // FETCH PRODUCT IMAGES
  // ========================================

  useEffect(() => {
    const fetchProductImages =
      async () => {
        try {
          const response =
            await fetch(
              ` https://lana-wardrobe-production.up.railway.app/api/products/${id}/images`
            );

          const data =
            await response.json();

          if (!response.ok) {
            throw new Error(
              data.message ||
                "Failed to load product images."
            );
          }

          const images =
            data.images || [];

          setProductImages(
            images
          );

          if (
            images.length > 0
          ) {
            setSelectedImage(
              images[0].image_url
            );
          } else if (
            product?.imageUrl
          ) {
            setSelectedImage(
              product.imageUrl
            );
          }
        } catch (error) {
          console.error(
            "Product gallery error:",
            error
          );
        }
      };

    fetchProductImages();
  }, [
    id,
    product?.imageUrl,
  ]);

  // ========================================
  // FETCH PRODUCT REVIEWS
  // ========================================

  const fetchReviews =
    async () => {
      try {
        setReviewsLoading(true);

        const response =
          await fetch(
            ` https://lana-wardrobe-production.up.railway.app/api/products/${id}/reviews`
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load reviews."
          );
        }

        setReviews(
          data.reviews || []
        );

        setReviewSummary(
          data.summary || {
            total_reviews: 0,
            average_rating: 0,
            five_star: 0,
            four_star: 0,
            three_star: 0,
            two_star: 0,
            one_star: 0,
          }
        );
      } catch (error) {
        console.error(
          "Reviews error:",
          error
        );
      } finally {
        setReviewsLoading(
          false
        );
      }
    };

  useEffect(() => {
    fetchReviews();
  }, [id]);

  // ========================================
  // SUBMIT REVIEW
  // ========================================

  const handleSubmitReview =
    async (event) => {
      event.preventDefault();

      setReviewMessage("");

      if (!isLoggedIn) {
        navigate("/login", {
          state: {
            from:
              `/product/${id}`,
          },
        });

        return;
      }

      if (
        selectedRating < 1 ||
        selectedRating > 5
      ) {
        setReviewMessage(
          "Please select a rating."
        );

        return;
      }

      try {
        setSubmittingReview(
          true
        );

        const token =
          localStorage.getItem(
            "lana_token"
          );

        const response =
          await fetch(
            ` https://lana-wardrobe-production.up.railway.app/api/products/${id}/reviews`,
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
                  rating:
                    selectedRating,

                  reviewTitle,

                  reviewText,
                }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to submit review."
          );
        }

        setReviewMessage(
          "Thank you! Your review was submitted successfully."
        );

        setSelectedRating(0);
        setReviewTitle("");
        setReviewText("");

        await fetchReviews();

      } catch (error) {
        setReviewMessage(
          error.message
        );

      } finally {
        setSubmittingReview(
          false
        );
      }
    };

  // ========================================
  // STAR DISPLAY
  // ========================================

  const renderStars = (
    rating
  ) => {
    const numericRating =
      Number(rating) || 0;

    return Array.from(
      { length: 5 },
      (_, index) => (
        <span
          key={index}
          className={
            index <
            Math.round(
              numericRating
            )
              ? "review-star filled"
              : "review-star"
          }
        >
          ★
        </span>
      )
    );
  };

  // ========================================
  // LOADING
  // ========================================

  if (loading) {
    return (
      <main className="product-details-page">
        <div
          style={{
            padding: "80px",
            textAlign:
              "center",
          }}
        >
          Loading product...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="product-details-page">
        <div
          style={{
            padding: "80px",
            textAlign:
              "center",
          }}
        >
          {error}
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-details-page">
        <h1>
          Product not found
        </h1>
      </main>
    );
  }

  return (
    <main className="product-details-page">

      {/* =====================================
          PRODUCT DETAILS
      ===================================== */}

      <section className="product-details-container">

        {/* PRODUCT GALLERY */}

        <div className="product-gallery">

          <div className="product-details-image">

            {selectedImage ? (
              <img
                src={
                  selectedImage.startsWith(
                    "http"
                  )
                    ? selectedImage
                    : ` https://lana-wardrobe-production.up.railway.app${selectedImage}`
                }
                alt={
                  product.name
                }
              />
            ) : (
              <div className="product-large-placeholder">
                PRODUCT IMAGE
              </div>
            )}

          </div>

          {productImages.length >
            1 && (
            <div className="product-gallery-thumbnails">

              {productImages.map(
                (image) => (
                  <button
                    type="button"

                    key={
                      image.id ??
                      image.image_url
                    }

                    className={
                      selectedImage ===
                      image.image_url
                        ? "product-thumbnail active"
                        : "product-thumbnail"
                    }

                    onClick={() =>
                      setSelectedImage(
                        image.image_url
                      )
                    }
                  >
                    <img
                      src={
                        image.image_url.startsWith(
                          "http"
                        )
                          ? image.image_url
                          : ` https://lana-wardrobe-production.up.railway.app${image.image_url}`
                      }

                      alt={
                        product.name
                      }
                    />
                  </button>
                )
              )}

            </div>
          )}

        </div>

        {/* PRODUCT INFO */}

        <div className="product-details-info">

          <p className="product-category">
            {product.category.toUpperCase()}
          </p>

          <h1>
            {product.name}
          </h1>

          {/* RATING SUMMARY */}

          <div className="product-rating-summary">

            <div className="review-stars">
              {renderStars(
                reviewSummary.average_rating
              )}
            </div>

            <span>
              {Number(
                reviewSummary.average_rating ||
                  0
              ).toFixed(1)}
            </span>

            <span>
              (
              {
                reviewSummary.total_reviews
              }{" "}
              {Number(
                reviewSummary.total_reviews
              ) === 1
                ? "Review"
                : "Reviews"}
              )
            </span>

          </div>

          <div className="details-price">

            <span className="details-sale-price">
              ₹
              {product.discountPrice ||
                product.price}
            </span>

            {product.discountPrice && (
              <span className="details-original-price">
                ₹{product.price}
              </span>
            )}

          </div>

          <p className="product-description">
            {product.description}
          </p>

          {/* SIZE */}

          <div className="product-option">

            <h3>
              Select Size
            </h3>

            <div className="option-buttons">

              {product.sizes.map(
                (size) => (
                  <button
                    type="button"
                    key={size}

                    className={
                      selectedSize ===
                      size
                        ? "selected"
                        : ""
                    }

                    onClick={() =>
                      setSelectedSize(
                        size
                      )
                    }
                  >
                    {size}
                  </button>
                )
              )}

            </div>

          </div>

          {/* COLOR */}

          <div className="product-option">

            <h3>
              Select Color
            </h3>

            <div className="option-buttons">

              {product.colors.map(
                (color) => (
                  <button
                    type="button"
                    key={color}

                    className={
                      selectedColor ===
                      color
                        ? "selected"
                        : ""
                    }

                    onClick={() =>
                      setSelectedColor(
                        color
                      )
                    }
                  >
                    {color}
                  </button>
                )
              )}

            </div>

          </div>

          {/* QUANTITY */}

          <div className="quantity-section">

            <h3>
              Quantity
            </h3>

            <div className="quantity-control">

              <button
                type="button"
                onClick={() =>
                  setQuantity(
                    (
                      current
                    ) =>
                      Math.max(
                        1,
                        current -
                          1
                      )
                  )
                }
              >
                −
              </button>

              <span>
                {quantity}
              </span>

              <button
                type="button"
                onClick={() =>
                  setQuantity(
                    (
                      current
                    ) =>
                      current +
                      1
                  )
                }
              >
                +
              </button>

            </div>

          </div>

          {/* ACTIONS */}

          <div className="product-actions">

            <button
              type="button"
              className="add-cart-button"

              onClick={() => {

                if (
                  !isLoggedIn
                ) {
                  navigate(
                    "/login",
                    {
                      state: {
                        from:
                          `/product/${product.id}`,
                      },
                    }
                  );

                  return;
                }

                if (
                  !selectedSize
                ) {
                  alert(
                    "Please select a size."
                  );

                  return;
                }

                if (
                  !selectedColor
                ) {
                  alert(
                    "Please select a color."
                  );

                  return;
                }

                addToCart(
                  product,
                  selectedSize,
                  selectedColor,
                  quantity
                );

                alert(
                  "Product added to cart!"
                );
              }}
            >
              ADD TO CART
            </button>

            <button
              type="button"
              className="wishlist-button"

              onClick={() => {

                if (
                  !isLoggedIn
                ) {
                  navigate(
                    "/login",
                    {
                      state: {
                        from:
                          `/product/${product.id}`,
                      },
                    }
                  );

                  return;
                }

                if (
                  productIsInWishlist
                ) {
                  removeFromWishlist(
                    product.id
                  );
                } else {
                  addToWishlist(
                    product
                  );
                }
              }}
            >
              {productIsInWishlist
                ? "♥ REMOVE FROM WISHLIST"
                : "♡ ADD TO WISHLIST"}
            </button>

          </div>

          <p className="product-stock">
            {product.stock} items
            available
          </p>

        </div>

      </section>

      {/* =====================================
          RATINGS & REVIEWS
      ===================================== */}

      <section className="product-reviews-section">

        <h2>
          Ratings & Reviews
        </h2>

        {/* OVERALL SUMMARY */}

        <div className="review-overall">

          <div className="review-overall-score">

            <strong>
              {Number(
                reviewSummary.average_rating ||
                  0
              ).toFixed(1)}
            </strong>

            <div className="review-stars">
              {renderStars(
                reviewSummary.average_rating
              )}
            </div>

            <p>
              Based on{" "}
              {
                reviewSummary.total_reviews
              }{" "}
              {Number(
                reviewSummary.total_reviews
              ) === 1
                ? "review"
                : "reviews"}
            </p>

          </div>

          <div className="review-breakdown">

            {[5, 4, 3, 2, 1].map(
              (star) => {
                const keyMap = {
                  5: "five_star",
                  4: "four_star",
                  3: "three_star",
                  2: "two_star",
                  1: "one_star",
                };

                return (
                  <div
                    key={star}
                    className="review-breakdown-row"
                  >
                    <span>
                      {star} ★
                    </span>

                    <div className="review-progress-bar">

                      <div
                        className="review-progress-fill"

                        style={{
                          width:
                            Number(
                              reviewSummary.total_reviews
                            ) >
                            0
                              ? `${
                                  (
                                    Number(
                                      reviewSummary[
                                        keyMap[
                                          star
                                        ]
                                      ] ||
                                        0
                                    ) /
                                    Number(
                                      reviewSummary.total_reviews
                                    )
                                  ) *
                                  100
                                }%`
                              : "0%",
                        }}
                      />

                    </div>

                    <span>
                      {
                        reviewSummary[
                          keyMap[
                            star
                          ]
                        ]
                      }
                    </span>

                  </div>
                );
              }
            )}

          </div>

        </div>

        {/* WRITE REVIEW */}

        <div className="write-review-box">

          <h3>
            Write a Review
          </h3>

          {!isLoggedIn ? (
            <div className="review-login-message">

              <p>
                Please log in to
                review this product.
              </p>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    "/login",
                    {
                      state: {
                        from:
                          `/product/${product.id}`,
                      },
                    }
                  )
                }
              >
                LOGIN TO REVIEW
              </button>

            </div>
          ) : (
            <form
              onSubmit={
                handleSubmitReview
              }
              className="review-form"
            >

              <div className="review-rating-input">

                <label>
                  Your Rating
                </label>

                <div className="review-star-buttons">

                  {[1, 2, 3, 4, 5].map(
                    (star) => (
                      <button
                        type="button"
                        key={star}

                        className={
                          star <=
                          selectedRating
                            ? "selected"
                            : ""
                        }

                        onClick={() =>
                          setSelectedRating(
                            star
                          )
                        }
                      >
                        ★
                      </button>
                    )
                  )}

                </div>

              </div>

              <div className="review-form-field">

                <label>
                  Review Title
                </label>

                <input
                  type="text"
                  value={
                    reviewTitle
                  }

                  maxLength="150"

                  placeholder="Give your review a title"

                  onChange={(
                    event
                  ) =>
                    setReviewTitle(
                      event.target
                        .value
                    )
                  }
                />

              </div>

              <div className="review-form-field">

                <label>
                  Your Review
                </label>

                <textarea
                  value={
                    reviewText
                  }

                  rows="5"

                  placeholder="Tell us what you liked about this product..."

                  onChange={(
                    event
                  ) =>
                    setReviewText(
                      event.target
                        .value
                    )
                  }
                />

              </div>

              <button
                type="submit"
                className="submit-review-button"
                disabled={
                  submittingReview
                }
              >
                {submittingReview
                  ? "SUBMITTING..."
                  : "SUBMIT REVIEW"}
              </button>

              {reviewMessage && (
                <p className="review-message">
                  {
                    reviewMessage
                  }
                </p>
              )}

            </form>
          )}

        </div>

        {/* CUSTOMER REVIEWS */}

        <div className="customer-reviews">

          <h3>
            Customer Reviews
          </h3>

          {reviewsLoading ? (
            <p>
              Loading reviews...
            </p>
          ) : reviews.length ===
            0 ? (
            <div className="no-reviews-box">

              <p>
                No reviews yet.
              </p>

              <span>
                Be the first
                verified customer
                to review this
                product.
              </span>

            </div>
          ) : (
            reviews.map(
              (review) => (
                <article
                  key={review.id}
                  className="customer-review-card"
                >

                  <div className="customer-review-top">

                    <div>

                      <strong>
                        {
                          review.full_name
                        }
                      </strong>

                      {review.is_verified_purchase && (
                        <span className="verified-purchase">
                          ✓ Verified
                          Purchase
                        </span>
                      )}

                    </div>

                    <span className="review-date">
                      {new Date(
                        review.created_at
                      ).toLocaleDateString(
                        "en-IN",
                        {
                          day:
                            "numeric",
                          month:
                            "short",
                          year:
                            "numeric",
                        }
                      )}
                    </span>

                  </div>

                  <div className="review-stars">
                    {renderStars(
                      review.rating
                    )}
                  </div>

                  {review.review_title && (
                    <h4>
                      {
                        review.review_title
                      }
                    </h4>
                  )}

                  {review.review_text && (
                    <p>
                      {
                        review.review_text
                      }
                    </p>
                  )}

                </article>
              )
            )
          )}

        </div>

      </section>

    </main>
  );
}

export default ProductDetails;