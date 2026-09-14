import { useEffect, useMemo, useState } from "react";

function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [expandedOrderId, setExpandedOrderId] =
    useState(null);

  const [selectedStatuses, setSelectedStatuses] =
    useState({});

  const [updatingOrderId, setUpdatingOrderId] =
    useState(null);

  const [courierInputs, setCourierInputs] =
    useState({});

  const [trackingInputs, setTrackingInputs] =
    useState({});

  const [
    savingTrackingOrderId,
    setSavingTrackingOrderId,
  ] = useState(null);

  // =========================
  // FETCH ORDERS
  // =========================

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const token =
          localStorage.getItem("lana_token");

        const response = await fetch(
          " https://lana-wardrobe-production.up.railway.app/api/admin/orders",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to load orders."
          );
        }

        setOrders(data.orders || []);
      } catch (error) {
        console.error(
          "Admin orders error:",
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
  // FORMAT DATE
  // =========================

  const formatDate = (dateValue) => {
    if (!dateValue) return "-";

    return new Date(
      dateValue
    ).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

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
  // SEARCH ORDERS
  // =========================

  const filteredOrders = useMemo(() => {
    const search = searchTerm
      .trim()
      .toLowerCase();

    if (!search) {
      return orders;
    }

    const isNumericSearch =
      /^\d+$/.test(search);

    if (isNumericSearch) {
      return orders.filter((order) => {
        const orderIdMatch =
          String(order.id) === search;

        const productIdMatch =
          order.items?.some(
            (item) =>
              String(item.product_id) ===
              search
          );

        return (
          orderIdMatch ||
          productIdMatch
        );
      });
    }

    return orders.filter((order) => {
      const customerMatch =
        order.full_name
          ?.toLowerCase()
          .includes(search);

      const emailMatch =
        order.email
          ?.toLowerCase()
          .includes(search);

      const phoneMatch =
        String(order.phone || "")
          .toLowerCase()
          .includes(search);

      const productMatch =
        order.items?.some((item) =>
          item.product_name
            ?.toLowerCase()
            .includes(search)
        );

      return (
        customerMatch ||
        emailMatch ||
        phoneMatch ||
        productMatch
      );
    });
  }, [orders, searchTerm]);

  // =========================
  // EXPAND / COLLAPSE
  // =========================

  const toggleOrderDetails = (
    orderId
  ) => {
    setExpandedOrderId(
      expandedOrderId === orderId
        ? null
        : orderId
    );
  };

  // =========================
  // ORDER STATUS
  // =========================

  const handleStatusChange = (
    orderId,
    newStatus
  ) => {
    setSelectedStatuses(
      (previous) => ({
        ...previous,
        [orderId]: newStatus,
      })
    );
  };

  // =========================
  // UPDATE ORDER STATUS
  // =========================

  const handleUpdateStatus = async (
    orderId
  ) => {
    const order = orders.find(
      (item) => item.id === orderId
    );

    if (!order) return;

    const newStatus =
      selectedStatuses[orderId] ||
      order.order_status;

    // No need to update if nothing changed
    if (
      newStatus === order.order_status
    ) {
      alert(
        "This order already has the selected status."
      );
      return;
    }

    // =========================
    // DELIVERED CONFIRMATION
    // =========================

    if (newStatus === "delivered") {
      const confirmed = window.confirm(
        `Are you sure you want to mark Order #${orderId} as Delivered?`
      );

      if (!confirmed) {
        return;
      }
    }

    // =========================
    // CANCEL CONFIRMATION
    // =========================

    if (newStatus === "cancelled") {
      const confirmed = window.confirm(
        `Are you sure you want to cancel Order #${orderId}?`
      );

      if (!confirmed) {
        return;
      }
    }

    try {
      setUpdatingOrderId(orderId);

      const token =
        localStorage.getItem(
          "lana_token"
        );

      const response = await fetch(
        ` https://lana-wardrobe-production.up.railway.app/api/admin/orders/${orderId}/status`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            orderStatus: newStatus,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to update order status."
        );
      }

      // =========================
      // UPDATE FRONTEND STATE
      // =========================

      setOrders((previousOrders) =>
        previousOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,

                order_status:
                  data.order
                    .order_status,

                payment_status:
                  data.order
                    .payment_status,

                courier_name:
                  data.order
                    .courier_name,

                tracking_number:
                  data.order
                    .tracking_number,

                updated_at:
                  data.order
                    .updated_at,
              }
            : order
        )
      );

      setSelectedStatuses(
        (previous) => ({
          ...previous,

          [orderId]:
            data.order.order_status,
        })
      );

      alert(
        data.message ||
          "Order status updated successfully."
      );
    } catch (error) {
      console.error(
        "Update order status error:",
        error
      );

      alert(
        error.message ||
          "Failed to update order status."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // =========================
  // COURIER INPUT
  // =========================

  const handleCourierChange = (
    orderId,
    value
  ) => {
    setCourierInputs(
      (previous) => ({
        ...previous,
        [orderId]: value,
      })
    );
  };

  // =========================
  // TRACKING INPUT
  // =========================

  const handleTrackingChange = (
    orderId,
    value
  ) => {
    setTrackingInputs(
      (previous) => ({
        ...previous,
        [orderId]: value,
      })
    );
  };

  // =========================
  // SAVE SHIPPING DETAILS
  // =========================

  const handleSaveTracking = async (
    orderId
  ) => {
    const order = orders.find(
      (item) => item.id === orderId
    );

    if (!order) return;

    const courierName =
      courierInputs[orderId] ??
      order.courier_name ??
      "";

    const trackingNumber =
      trackingInputs[orderId] ??
      order.tracking_number ??
      "";

    try {
      setSavingTrackingOrderId(
        orderId
      );

      const token =
        localStorage.getItem(
          "lana_token"
        );

      const response = await fetch(
        ` https://lana-wardrobe-production.up.railway.app/api/admin/orders/${orderId}/tracking`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            courierName,
            trackingNumber,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to save shipping details."
        );
      }

      setOrders((previousOrders) =>
        previousOrders.map((order) =>
          order.id === orderId
            ? {
                ...order,

                courier_name:
                  data.order
                    .courier_name,

                tracking_number:
                  data.order
                    .tracking_number,

                updated_at:
                  data.order
                    .updated_at,
              }
            : order
        )
      );

      setCourierInputs(
        (previous) => ({
          ...previous,

          [orderId]:
            data.order.courier_name ||
            "",
        })
      );

      setTrackingInputs(
        (previous) => ({
          ...previous,

          [orderId]:
            data.order
              .tracking_number ||
            "",
        })
      );

      alert(
        "Shipping and tracking details saved successfully."
      );
    } catch (error) {
      console.error(
        "Save shipping/tracking error:",
        error
      );

      alert(
        error.message ||
          "Failed to save shipping details."
      );
    } finally {
      setSavingTrackingOrderId(null);
    }
  };

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <main className="admin-page">
        <p>
          Loading orders...
        </p>
      </main>
    );
  }

  // =========================
  // ERROR
  // =========================

  if (error) {
    return (
      <main className="admin-page">
        <p>{error}</p>
      </main>
    );
  }

  // =========================
  // PAGE
  // =========================

  return (
    <main className="admin-page">

      {/* HEADER */}

      <section className="admin-orders-header">

        <p>
          LANA WARDROBE ADMIN
        </p>

        <h1>
          Manage Orders
        </h1>

        <p>
          Search and manage customer
          orders, payments and shipping.
        </p>

      </section>

      {/* SEARCH */}

      <section className="admin-orders-toolbar">

        <div className="admin-orders-search">

          <input
            type="text"
            placeholder="Search order ID, product ID, product name, customer, email or phone..."
            value={searchTerm}
            onChange={(e) =>
              setSearchTerm(
                e.target.value
              )
            }
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() =>
                setSearchTerm("")
              }
            >
              Clear
            </button>
          )}

        </div>

        <div className="admin-orders-count">

          {filteredOrders.length}{" "}

          {filteredOrders.length === 1
            ? "Order"
            : "Orders"}

        </div>

      </section>

      {/* ORDER LIST */}

      <section className="admin-orders-list">

        {filteredOrders.length === 0 ? (

          <div className="admin-empty-state">
            No matching orders found.
          </div>

        ) : (

          filteredOrders.map(
            (order) => {

              const isExpanded =
                expandedOrderId ===
                order.id;

              const firstItem =
                order.items?.[0];

              const extraItemCount =
                Math.max(
                  (order.items?.length ||
                    0) - 1,
                  0
                );

              return (
                <article
                  className="admin-order-card admin-order-card-compact"
                  key={order.id}
                >

                  {/* COMPACT SUMMARY */}

                  <div className="admin-order-compact-row">

                    <div className="admin-order-compact-id">

                      <span>
                        ORDER
                      </span>

                      <strong>
                        #{order.id}
                      </strong>

                    </div>

                    <div className="admin-order-compact-customer">

                      <strong>
                        {
                          order.full_name
                        }
                      </strong>

                      <span>
                        {formatDate(
                          order.created_at
                        )}
                      </span>

                    </div>

                    <div className="admin-order-compact-product">

                      {firstItem ? (
                        <>

                          <strong>
                            {
                              firstItem.product_name
                            }
                          </strong>

                          <span>
                            Product ID:{" "}
                            {
                              firstItem.product_id
                            }
                          </span>

                          {extraItemCount >
                            0 && (
                            <span>
                              +
                              {
                                extraItemCount
                              }{" "}
                              more{" "}
                              {extraItemCount ===
                              1
                                ? "item"
                                : "items"}
                            </span>
                          )}

                        </>
                      ) : (

                        <span>
                          No product items
                        </span>

                      )}

                    </div>

                    <div className="admin-order-compact-total">

                      <span>
                        Total
                      </span>

                      <strong>
                        ₹
                        {
                          order.total_amount
                        }
                      </strong>

                    </div>

                    <div className="admin-order-compact-status">

                      <span>
                        Payment
                      </span>

                      <strong>
                        {formatStatus(
                          order.payment_status
                        )}
                      </strong>

                    </div>

                    <div className="admin-order-compact-status">

                      <span>
                        Order Status
                      </span>

                      <strong>
                        {formatStatus(
                          order.order_status
                        )}
                      </strong>

                    </div>

                    <div className="admin-order-compact-action">

                      <button
                        type="button"
                        onClick={() =>
                          toggleOrderDetails(
                            order.id
                          )
                        }
                      >
                        {isExpanded
                          ? "Hide Details"
                          : "View Details"}
                      </button>

                    </div>

                  </div>

                  {/* EXPANDED */}

                  {isExpanded && (

                    <div className="admin-order-expanded">

                      <div className="admin-order-grid">

                        {/* CUSTOMER */}

                        <div className="admin-order-section">

                          <h3>
                            Customer
                          </h3>

                          <p>
                            <strong>
                              Name:
                            </strong>{" "}
                            {
                              order.full_name
                            }
                          </p>

                          <p>
                            <strong>
                              Email:
                            </strong>{" "}
                            {order.email}
                          </p>

                          <p>
                            <strong>
                              Phone:
                            </strong>{" "}
                            {order.phone}
                          </p>

                        </div>

                        {/* ADDRESS */}

                        <div className="admin-order-section">

                          <h3>
                            Shipping Address
                          </h3>

                          <p>
                            {order.address}
                          </p>

                          <p>
                            {order.city},{" "}
                            {order.state}
                          </p>

                          <p>
                            Pincode:{" "}
                            {order.pincode}
                          </p>

                          {order.order_note && (
                            <p>
                              <strong>
                                Note:
                              </strong>{" "}
                              {
                                order.order_note
                              }
                            </p>
                          )}

                        </div>

                        {/* PAYMENT */}

                        <div className="admin-order-section">

                          <h3>
                            Payment
                          </h3>

                          <p>
                            <strong>
                              Method:
                            </strong>{" "}
                            {formatStatus(
                              order.payment_method
                            )}
                          </p>

                          <p>
                            <strong>
                              Gateway:
                            </strong>{" "}
                            {order.payment_gateway ||
                              "-"}
                          </p>

                          <p>
                            <strong>
                              Status:
                            </strong>{" "}
                            {formatStatus(
                              order.payment_status
                            )}
                          </p>

                        </div>

                        {/* SHIPPING */}

                        <div className="admin-order-section admin-order-tracking-section">

                          <h3>
                            Shipping & Tracking
                          </h3>

                          <p>
                            <strong>
                              Current Courier:
                            </strong>{" "}
                            {order.courier_name ||
                              "Not assigned"}
                          </p>

                          <p>
                            <strong>
                              Current Tracking:
                            </strong>{" "}
                            {order.tracking_number ||
                              "Not assigned"}
                          </p>

                          <div className="admin-tracking-control">

                            <label>
                              Courier Name
                            </label>

                            <input
                              type="text"
                              placeholder="Example: Delhivery"
                              value={
                                courierInputs[
                                  order.id
                                ] ??
                                order.courier_name ??
                                ""
                              }
                              onChange={(e) =>
                                handleCourierChange(
                                  order.id,
                                  e.target.value
                                )
                              }
                            />

                            <label>
                              Tracking / AWB Number
                            </label>

                            <input
                              type="text"
                              placeholder="Enter tracking / AWB number"
                              value={
                                trackingInputs[
                                  order.id
                                ] ??
                                order.tracking_number ??
                                ""
                              }
                              onChange={(e) =>
                                handleTrackingChange(
                                  order.id,
                                  e.target.value
                                )
                              }
                            />

                            <button
                              type="button"
                              onClick={() =>
                                handleSaveTracking(
                                  order.id
                                )
                              }
                              disabled={
                                savingTrackingOrderId ===
                                order.id
                              }
                            >
                              {savingTrackingOrderId ===
                              order.id
                                ? "Saving..."
                                : "Save Shipping Details"}
                            </button>

                          </div>

                        </div>

                      </div>

                      {/* ORDER MANAGEMENT */}

                      <div className="admin-order-management">

                        <h3>
                          Order Management
                        </h3>

                        <div className="admin-order-status-control">

                          <div>

                            <label>
                              Update Order Status
                            </label>

                            <select
                              value={
                                selectedStatuses[
                                  order.id
                                ] ||
                                order.order_status
                              }
                              onChange={(e) =>
                                handleStatusChange(
                                  order.id,
                                  e.target.value
                                )
                              }
                            >

                              <option value="order_placed">
                                Order Placed
                              </option>

                              <option value="confirmed">
                                Confirmed
                              </option>

                              <option value="packed">
                                Packed
                              </option>

                              <option value="shipped">
                                Shipped
                              </option>

                              <option value="out_for_delivery">
                                Out for Delivery
                              </option>

                              <option value="delivered">
                                Delivered
                              </option>

                              <option value="cancelled">
                                Cancelled
                              </option>

                            </select>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateStatus(
                                order.id
                              )
                            }
                            disabled={
                              updatingOrderId ===
                              order.id
                            }
                          >
                            {updatingOrderId ===
                            order.id
                              ? "Updating..."
                              : "Update Status"}
                          </button>

                        </div>

                      </div>

                      {/* ORDER ITEMS */}

                      <div className="admin-order-items">

                        <h3>
                          Ordered Items
                        </h3>

                        {order.items?.map(
                          (item) => (

                            <div
                              className="admin-order-item"
                              key={item.id}
                            >

                              <div className="admin-order-item-image">

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
                                    No Image
                                  </span>

                                )}

                              </div>

                              <div className="admin-order-item-info">

                                <h4>
                                  {
                                    item.product_name
                                  }
                                </h4>

                                <p>
                                  Product ID:{" "}
                                  {
                                    item.product_id
                                  }
                                </p>

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
                                  Quantity:{" "}
                                  {
                                    item.quantity
                                  }
                                </p>

                                <p>
                                  Unit Price: ₹
                                  {
                                    item.unit_price
                                  }
                                </p>

                                <strong>
                                  ₹
                                  {
                                    item.line_total
                                  }
                                </strong>

                              </div>

                            </div>

                          )
                        )}

                      </div>

                      {/* TOTALS */}

                      <div className="admin-order-totals">

                        <div>
                          <span>
                            Subtotal
                          </span>

                          <strong>
                            ₹
                            {
                              order.subtotal
                            }
                          </strong>
                        </div>

                        <div>
                          <span>
                            Shipping
                          </span>

                          <strong>
                            ₹
                            {
                              order.shipping_charge
                            }
                          </strong>
                        </div>

                        <div className="admin-order-grand-total">

                          <span>
                            Total
                          </span>

                          <strong>
                            ₹
                            {
                              order.total_amount
                            }
                          </strong>

                        </div>

                      </div>

                    </div>
                  )}

                </article>
              );
            }
          )
        )}

      </section>

    </main>
  );
}

export default AdminOrders;