import {
  useEffect,
  useState,
} from "react";

function AdminReviews() {
  const [
    reviews,
    setReviews,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    updatingId,
    setUpdatingId,
  ] = useState(null);

  const fetchReviews =
    async () => {
      try {
        const token =
          localStorage.getItem(
            "lana_token"
          );

        const response =
          await fetch(
            "https://api.lanawardrobe.in/api/admin/reviews",
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
              "Failed to load reviews."
          );
        }

        setReviews(
          data.reviews || []
        );

      } catch (error) {
        console.error(
          "Admin reviews error:",
          error
        );

        setError(
          error.message
        );

      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleToggleApproval =
    async (review) => {
      try {
        const nextStatus =
          !review.is_approved;

        const action =
          nextStatus
            ? "approve"
            : "hide";

        const confirmed =
          window.confirm(
            `Are you sure you want to ${action} this review?`
          );

        if (!confirmed) {
          return;
        }

        setUpdatingId(
          review.id
        );

        const token =
          localStorage.getItem(
            "lana_token"
          );

        const response =
          await fetch(
            `https://api.lanawardrobe.in/api/admin/reviews/${review.id}/status`,
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
                  isApproved:
                    nextStatus,
                }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to update review."
          );
        }

        setReviews(
          (currentReviews) =>
            currentReviews.map(
              (item) =>
                item.id ===
                review.id
                  ? {
                      ...item,
                      is_approved:
                        nextStatus,
                    }
                  : item
            )
        );

      } catch (error) {
        alert(
          error.message
        );

      } finally {
        setUpdatingId(
          null
        );
      }
    };

  if (loading) {
    return (
      <main className="admin-page">
        <p>
          Loading reviews...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="admin-page">
        <p>{error}</p>
      </main>
    );
  }

  const handleDeleteReview =
  async (review) => {
    try {
      const confirmed =
        window.confirm(
          "Are you sure you want to permanently delete this review?"
        );

      if (!confirmed) {
        return;
      }

      setUpdatingId(
        review.id
      );

      const token =
        localStorage.getItem(
          "lana_token"
        );

      const response =
        await fetch(
          `https://api.lanawardrobe.in/api/admin/reviews/${review.id}`,
          {
            method: "DELETE",

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
            "Failed to delete review."
        );
      }

      setReviews(
        (currentReviews) =>
          currentReviews.filter(
            (item) =>
              item.id !==
              review.id
          )
      );

    } catch (error) {
      alert(
        error.message
      );

    } finally {
      setUpdatingId(
        null
      );
    }
  };

  return (
    <main className="admin-page">

      <section className="admin-header">

        <p>
          LANA WARDROBE
        </p>

        <h1>
          Ratings & Reviews
        </h1>

        <p>
          Manage customer product
          ratings and reviews.
        </p>

      </section>

      <section className="admin-reviews-section">

        {reviews.length === 0 ? (
          <p>
            No reviews found.
          </p>
        ) : (
          reviews.map(
            (review) => (
              <div
                key={review.id}
                className="admin-review-card"
              >

                <div className="admin-review-main">

                  <h3>
                    {
                      review.product_name
                    }
                  </h3>

                  <p>
                    Customer:{" "}
                    <strong>
                      {
                        review.full_name
                      }
                    </strong>
                  </p>

                  <div className="admin-review-stars">
                    {"â˜…".repeat(
                      review.rating
                    )}

                    {"â˜†".repeat(
                      5 -
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

                  <div className="admin-review-meta">

                    <span>
                      {review.is_verified_purchase
                        ? "âœ“ Verified Purchase"
                        : "Not Verified"}
                    </span>

                    <span
                      className={
                        review.is_approved
                          ? "review-status approved"
                          : "review-status hidden"
                      }
                    >
                      {review.is_approved
                        ? "Approved"
                        : "Hidden"}
                    </span>

                  </div>

                </div>

                <div className="admin-review-actions">

                    <button
                        type="button"
                        disabled={
                        updatingId ===
                        review.id
                        }
                        onClick={() =>
                        handleToggleApproval(
                            review
                        )
                        }
                    >
                        {updatingId ===
                        review.id
                        ? "UPDATING..."
                        : review.is_approved
                        ? "HIDE REVIEW"
                        : "APPROVE REVIEW"}
                    </button>

                    <button
                        type="button"
                        className="admin-delete-review-button"
                        disabled={
                        updatingId ===
                        review.id
                        }
                        onClick={() =>
                        handleDeleteReview(
                            review
                        )
                        }
                    >
                        DELETE REVIEW
                    </button>

                    </div>
              </div>
            )
          )
        )}

      </section>

    </main>
  );
}

export default AdminReviews;
