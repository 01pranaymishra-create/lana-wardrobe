import {
  useEffect,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

function YourOrders() {
  const [orders, setOrders] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  // =========================
  // DELIVERY STEPS
  // =========================

  const deliverySteps = [
    "order_placed",
    "confirmed",
    "packed",
    "shipped",
    "out_for_delivery",
    "delivered",
  ];

  // =========================
  // FORMAT STATUS
  // =========================

  const formatStatus = (status) => {
    if (!status) return "-";

    return status
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase()
      );
  };

  // =========================
  // FETCH ORDERS
  // =========================

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token =
          localStorage.getItem(
            "lana_token"
          );

        const response = await fetch(
          " https://lana-wardrobe-production.up.railway.app/api/orders/my-orders",
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
              "Failed to load orders."
          );
        }

        setOrders(
          data.orders || []
        );
      } catch (error) {
        console.error(
          "Orders fetch error:",
          error
        );

        setError(
          error.message ||
            "Failed to load orders."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <main className="orders-page">

        <div className="orders-message">
          Loading your orders...
        </div>

      </main>
    );
  }

  // =========================
  // ERROR
  // =========================

  if (error) {
    return (
      <main className="orders-page">

        <div className="orders-message">
          {error}
        </div>

      </main>
    );
  }

  // =========================
  // PAGE
  // =========================

  return (
    <main className="orders-page">

      {/* =========================
          HEADER
      ========================= */}

      <section className="orders-header">

        <p>
          LANA WARDROBE
        </p>

        <h1>
          Your Orders
        </h1>

        <p>
          View your purchases,
          payment status and delivery
          progress.
        </p>

      </section>

      {/* =========================
          ORDERS
      ========================= */}

      <section className="orders-container">

        {orders.length === 0 ? (

          <div className="orders-empty">

            <h2>
              No orders yet
            </h2>

            <p>
              Your placed orders will
              appear here.
            </p>

          </div>

        ) : (

          orders.map((order) => {

            const currentStepIndex =
              deliverySteps.indexOf(
                order.order_status
              );

            return (
              <article
                className="order-card"
                key={order.id}
              >

                {/* =========================
                    ORDER HEADER
                ========================= */}

                <div className="order-card-header">

                  <div>
                    <span>
                      ORDER
                    </span>

                    <strong>
                      #{order.id}
                    </strong>
                  </div>

                  <div>
                    <span>
                      ORDER DATE
                    </span>

                    <strong>
                      {new Date(
                        order.created_at
                      ).toLocaleDateString(
                        "en-IN"
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      TOTAL
                    </span>

                    <strong>
                      ₹
                      {
                        order.total_amount
                      }
                    </strong>
                  </div>

                </div>

                {/* =========================
                    PAYMENT / STATUS
                ========================= */}

                <div className="order-status-row">

                  <div>
                    <span>
                      Payment
                    </span>

                    <strong>
                      {order.payment_method ===
                      "cod"
                        ? "Cash on Delivery"
                        : "Online"}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Payment Status
                    </span>

                    <strong>
                      {formatStatus(
                        order.payment_status
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Order Status
                    </span>

                    <strong>
                      {formatStatus(
                        order.order_status
                      )}
                    </strong>
                  </div>

                </div>

                {/* =========================
                    DELIVERY PROGRESS
                ========================= */}

                {order.order_status ===
                "cancelled" ? (

                  <div className="order-cancelled-box">

                    <strong>
                      Order Cancelled
                    </strong>

                    <p>
                      This order has been
                      cancelled.
                    </p>

                  </div>

                ) : (

                  <div className="order-progress">

                    {deliverySteps.map(
                      (step, index) => {

                        const completed =
                          currentStepIndex >= 0 &&
                          index <=
                            currentStepIndex;

                        return (
                          <div
                            className={`order-progress-step ${
                              completed
                                ? "completed"
                                : ""
                            }`}
                            key={step}
                          >

                            <div className="order-progress-circle">

                              {completed
                                ? "✓"
                                : index + 1}

                            </div>

                            <span>
                              {formatStatus(
                                step
                              )}
                            </span>

                          </div>
                        );
                      }
                    )}

                  </div>

                )}

                {/* =========================
                    PRODUCTS
                ========================= */}

                <div className="order-products">

                  {order.items?.map(
                    (item) => (

                      <div
                        className="order-product"
                        key={item.id}
                      >

                        <Link
                          to={`/product/${item.product_id}`}
                          className="order-product-link"
                        >

                          <div className="order-product-image">

                            {item.image_url ? (

                              <img
                                src={
                                  item.image_url.startsWith(
                                    "http"
                                  )
                                    ? item.image_url
                                    : ` https://lana-wardrobe-production.up.railway.app${item.image_url}`
                                }
                                alt={
                                  item.product_name
                                }
                              />

                            ) : (

                              <span>
                                PRODUCT IMAGE
                              </span>

                            )}

                          </div>

                          <div className="order-product-details">

                            <h3>
                              {
                                item.product_name
                              }
                            </h3>

                            <p>
                              Size:{" "}
                              {item.size ||
                                "-"}
                            </p>

                            <p>
                              Color:{" "}
                              {item.color ||
                                "-"}
                            </p>

                            <p>
                              Qty:{" "}
                              {
                                item.quantity
                              }
                            </p>

                          </div>

                        </Link>

                        <strong>
                          ₹
                          {
                            item.line_total
                          }
                        </strong>

                      </div>

                    )
                  )}

                </div>

                {/* =========================
                    SHIPPING FOOTER
                ========================= */}

                <div className="order-card-footer">

                  <div>
                    <span>
                      Shipping
                    </span>

                    <strong>
                      {Number(
                        order.shipping_charge
                      ) === 0
                        ? "FREE"
                        : `₹${order.shipping_charge}`}
                    </strong>
                  </div>

                  {order.courier_name && (

                    <div>
                      <span>
                        Courier
                      </span>

                      <strong>
                        {
                          order.courier_name
                        }
                      </strong>
                    </div>

                  )}

                  {order.tracking_number && (

                    <div>
                      <span>
                        Tracking Number
                      </span>

                      <strong>
                        {
                          order.tracking_number
                        }
                      </strong>
                    </div>

                  )}

                </div>

              </article>
            );
          })

        )}

      </section>

    </main>
  );
}

export default YourOrders;