import {
  useEffect,
  useState,
} from "react";

function AdminShipping() {
  const [readyOrders, setReadyOrders] =
    useState([]);

  const [shipments, setShipments] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    creatingOrderId,
    setCreatingOrderId,
  ] = useState(null);

  const [shipmentForms, setShipmentForms] =
    useState({});

  const [
    expandedShippingOrderId,
    setExpandedShippingOrderId,
  ] = useState(null);

  const [
    expandedShipmentId,
    setExpandedShipmentId,
  ] = useState(null);

  // NEW - EDIT SHIPMENT
  const [
    editingShipmentId,
    setEditingShipmentId,
  ] = useState(null);

  const [
    savingShipmentId,
    setSavingShipmentId,
  ] = useState(null);

  const [
    shipmentEditForms,
    setShipmentEditForms,
  ] = useState({});

  // =========================
  // FETCH SHIPPING DATA
  // =========================

  const fetchShippingData = async () => {
    try {
      setLoading(true);
      setError("");

      const token =
        localStorage.getItem(
          "lana_token"
        );

      const [
        readyResponse,
        shipmentsResponse,
      ] = await Promise.all([
        fetch(
          "https://api.lanawardrobe.in/api/admin/shipping/ready-orders",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        ),

        fetch(
          "https://api.lanawardrobe.in/api/admin/shipments",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        ),
      ]);

      const readyData =
        await readyResponse.json();

      const shipmentsData =
        await shipmentsResponse.json();

      if (!readyResponse.ok) {
        throw new Error(
          readyData.message ||
            "Failed to load ready orders."
        );
      }

      if (!shipmentsResponse.ok) {
        throw new Error(
          shipmentsData.message ||
            "Failed to load shipments."
        );
      }

      setReadyOrders(
        readyData.orders || []
      );

      setShipments(
        shipmentsData.shipments || []
      );

    } catch (error) {
      console.error(
        "Shipping data fetch error:",
        error
      );

      setError(
        error.message ||
          "Failed to load shipping data."
      );

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShippingData();
  }, []);

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
  // DATETIME INPUT FORMAT
  // =========================

  const formatDateTimeInput = (
    dateValue
  ) => {
    if (!dateValue) return "";

    const date =
      new Date(dateValue);

    const offset =
      date.getTimezoneOffset();

    const localDate =
      new Date(
        date.getTime() -
          offset * 60 * 1000
      );

    return localDate
      .toISOString()
      .slice(0, 16);
  };

  // =========================
  // CREATE FORM VALUE
  // =========================

  const getFormValue = (
    orderId,
    field,
    fallback = ""
  ) => {
    return (
      shipmentForms[orderId]?.[
        field
      ] ?? fallback
    );
  };

  // =========================
  // CREATE FORM CHANGE
  // =========================

  const handleFormChange = (
    orderId,
    field,
    value
  ) => {
    setShipmentForms(
      (previous) => ({
        ...previous,

        [orderId]: {
          ...previous[orderId],
          [field]: value,
        },
      })
    );
  };

  // =========================
  // EXPAND READY ORDER
  // =========================

  const toggleShippingOrder = (
    orderId
  ) => {
    setExpandedShippingOrderId(
      (previousId) =>
        previousId === orderId
          ? null
          : orderId
    );
  };

  // =========================
  // CREATE SHIPMENT
  // =========================

  const handleCreateShipment =
    async (order) => {
      try {
        const form =
          shipmentForms[order.id] ||
          {};

        const shipmentProvider =
          form.shipmentProvider ||
          "Ekart";

        if (
          !shipmentProvider.trim()
        ) {
          alert(
            "Shipment provider is required."
          );
          return;
        }

        if (
          !form.weight ||
          Number(form.weight) <= 0
        ) {
          alert(
            "Please enter package weight."
          );
          return;
        }

        if (
          !form.length ||
          Number(form.length) <= 0 ||
          !form.width ||
          Number(form.width) <= 0 ||
          !form.height ||
          Number(form.height) <= 0
        ) {
          alert(
            "Please enter valid package dimensions."
          );
          return;
        }

        const confirmed =
          window.confirm(
            `Create Ekart shipment for Order #${order.id}?`
          );

        if (!confirmed) {
          return;
        }

        setCreatingOrderId(
          order.id
        );

        const token =
          localStorage.getItem(
            "lana_token"
          );

        const response =
          await fetch(
            "https://api.lanawardrobe.in/api/admin/shipments",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                orderId:
                  order.id,

                shipmentProvider:
                  "Ekart",

                courierName:
                  "Ekart",

                providerShipmentId:
                  form.providerShipmentId ||
                  "",

                awbNumber:
                  form.awbNumber ||
                  "",

                trackingUrl:
                  form.trackingUrl ||
                  "",

                shipmentStatus:
                  "pending",

                weight:
                  Number(
                    form.weight
                  ),

                length:
                  Number(
                    form.length
                  ),

                width:
                  Number(
                    form.width
                  ),

                height:
                  Number(
                    form.height
                  ),

                shippingCost:
                  form.shippingCost
                    ? Number(
                        form.shippingCost
                      )
                    : null,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to create shipment."
          );
        }

        alert(
          data.message ||
            "Shipment created successfully."
        );

        setShipmentForms(
          (previous) => {
            const updated = {
              ...previous,
            };

            delete updated[
              order.id
            ];

            return updated;
          }
        );

        setExpandedShippingOrderId(
          null
        );

        await fetchShippingData();

      } catch (error) {
        console.error(
          "Create shipment error:",
          error
        );

        alert(
          error.message ||
            "Failed to create shipment."
        );

      } finally {
        setCreatingOrderId(
          null
        );
      }
    };

  // =========================
  // OPEN EDIT SHIPMENT
  // =========================

  const handleEditShipment = (
    shipment
  ) => {
    setExpandedShipmentId(
      shipment.id
    );

    setEditingShipmentId(
      shipment.id
    );

    setShipmentEditForms(
      (previous) => ({
        ...previous,

        [shipment.id]: {
          awbNumber:
            shipment.awb_number ||
            "",

          trackingUrl:
            shipment.tracking_url ||
            "",

          shipmentStatus:
            shipment.shipment_status ||
            "pending",

          shippingCost:
            shipment.shipping_cost ??
            "",

          pickupScheduled:
            Boolean(
              shipment.pickup_scheduled
            ),

          pickupDate:
            formatDateTimeInput(
              shipment.pickup_date
            ),

          shippedAt:
            formatDateTimeInput(
              shipment.shipped_at
            ),

          deliveredAt:
            formatDateTimeInput(
              shipment.delivered_at
            ),
        },
      })
    );
  };

  // =========================
  // EDIT FORM CHANGE
  // =========================

  const handleShipmentEditChange = (
    shipmentId,
    field,
    value
  ) => {
    setShipmentEditForms(
      (previous) => ({
        ...previous,

        [shipmentId]: {
          ...previous[shipmentId],
          [field]: value,
        },
      })
    );
  };

  // =========================
  // CANCEL EDIT
  // =========================

  const handleCancelShipmentEdit =
    (shipmentId) => {
      setEditingShipmentId(
        null
      );

      setShipmentEditForms(
        (previous) => {
          const updated = {
            ...previous,
          };

          delete updated[
            shipmentId
          ];

          return updated;
        }
      );
    };

  // =========================
  // UPDATE SHIPMENT
  // =========================

  const handleUpdateShipment =
    async (shipment) => {
      try {
        const form =
          shipmentEditForms[
            shipment.id
          ];

        if (!form) {
          return;
        }

        const confirmed =
          window.confirm(
            `Save changes to Shipment #${shipment.id}?`
          );

        if (!confirmed) {
          return;
        }

        setSavingShipmentId(
          shipment.id
        );

        const token =
          localStorage.getItem(
            "lana_token"
          );

        const response =
          await fetch(
            `https://api.lanawardrobe.in/api/admin/shipments/${shipment.id}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body: JSON.stringify({
                awbNumber:
                  form.awbNumber,

                trackingUrl:
                  form.trackingUrl,

                shipmentStatus:
                  form.shipmentStatus,

                shippingCost:
                  form.shippingCost,

                pickupScheduled:
                  form.pickupScheduled,

                pickupDate:
                  form.pickupDate ||
                  null,

                shippedAt:
                  form.shippedAt ||
                  null,

                deliveredAt:
                  form.deliveredAt ||
                  null,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Failed to update shipment."
          );
        }

        alert(
          data.message ||
            "Shipment updated successfully."
        );

        setEditingShipmentId(
          null
        );

        setShipmentEditForms(
          (previous) => {
            const updated = {
              ...previous,
            };

            delete updated[
              shipment.id
            ];

            return updated;
          }
        );

        await fetchShippingData();

        setExpandedShipmentId(
          shipment.id
        );

      } catch (error) {
        console.error(
          "Update shipment error:",
          error
        );

        alert(
          error.message ||
            "Failed to update shipment."
        );

      } finally {
        setSavingShipmentId(
          null
        );
      }
    };

  // =========================
  // LOADING
  // =========================

  if (loading) {
    return (
      <main className="admin-page">
        <p>
          Loading shipping data...
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

      <section className="admin-shipping-header">

        <p>
          LANA WARDROBE ADMIN
        </p>

        <h1>
          Shipping & Tracking
        </h1>

        <p>
          Prepare Ekart shipments,
          manage AWB numbers and
          track deliveries.
        </p>

      </section>

      {/* =========================
          READY TO SHIP
      ========================= */}

      <section className="admin-shipping-section">

        <div className="admin-shipping-section-title">

          <div>
            <p>
              FULFILMENT
            </p>

            <h2>
              Ready to Ship
            </h2>
          </div>

          <strong>
            {readyOrders.length}{" "}

            {readyOrders.length === 1
              ? "Order"
              : "Orders"}
          </strong>

        </div>

        {readyOrders.length === 0 ? (

          <div className="admin-empty-state">
            No orders are currently
            ready for shipping.
          </div>

        ) : (

          <div className="admin-ready-orders">

            {readyOrders.map(
              (order) => {

                const isExpanded =
                  expandedShippingOrderId ===
                  order.id;

                return (
                  <article
                    className="admin-shipping-card"
                    key={order.id}
                  >

                    {/* SUMMARY */}

                    <div className="admin-shipping-card-header">

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
                          CUSTOMER
                        </span>

                        <strong>
                          {
                            order.full_name
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          DESTINATION
                        </span>

                        <strong>
                          {order.city} -{" "}
                          {order.pincode}
                        </strong>
                      </div>

                      <div>
                        <span>
                          STATUS
                        </span>

                        <strong>
                          {formatStatus(
                            order.order_status
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          TOTAL
                        </span>

                        <strong>
                          â‚¹
                          {
                            order.total_amount
                          }
                        </strong>
                      </div>

                      <div className="admin-shipping-expand-action">

                        <button
                          type="button"
                          onClick={() =>
                            toggleShippingOrder(
                              order.id
                            )
                          }
                        >
                          {isExpanded
                            ? "Close"
                            : "Create Shipment"}
                        </button>

                      </div>

                    </div>

                    {/* EXPANDED */}

                    {isExpanded && (
                      <>

                        <div className="admin-shipping-card-body">

                          {/* DELIVERY DETAILS */}

                          <div className="admin-shipping-info">

                            <h3>
                              Delivery Details
                            </h3>

                            <p>
                              <strong>
                                Phone:
                              </strong>{" "}
                              {order.phone}
                            </p>

                            <p>
                              <strong>
                                Email:
                              </strong>{" "}
                              {order.email}
                            </p>

                            <p>
                              <strong>
                                Address:
                              </strong>{" "}
                              {order.address}
                            </p>

                            <p>
                              {order.city},{" "}
                              {order.state} -{" "}
                              {order.pincode}
                            </p>

                            <p>
                              <strong>
                                Payment:
                              </strong>{" "}
                              {order.payment_method ===
                              "cod"
                                ? "Cash on Delivery"
                                : "Online"}
                            </p>

                            <p>
                              <strong>
                                Payment Status:
                              </strong>{" "}
                              {formatStatus(
                                order.payment_status
                              )}
                            </p>

                          </div>

                          {/* PRODUCTS */}

                          <div className="admin-shipping-info">

                            <h3>
                              Products
                            </h3>

                            {order.items?.map(
                              (item) => (

                                <div
                                  className="admin-shipping-product"
                                  key={
                                    item.id
                                  }
                                >

                                  <strong>
                                    {
                                      item.quantity
                                    }{" "}
                                    Ã—{" "}
                                    {
                                      item.product_name
                                    }
                                  </strong>

                                  <span>
                                    ID:{" "}
                                    {
                                      item.product_id
                                    }

                                    {" | "}

                                    Size:{" "}
                                    {item.size ||
                                      "-"}

                                    {" | "}

                                    Color:{" "}
                                    {item.color ||
                                      "-"}
                                  </span>

                                </div>

                              )
                            )}

                          </div>

                        </div>

                        {/* CREATE FORM */}

                        <div className="admin-shipment-form">

                          <h3>
                            Create Ekart Shipment
                          </h3>

                          <div className="admin-shipment-form-grid">

                            <div>
                              <label>
                                Shipping Provider
                              </label>

                              <select
                                value="Ekart"
                                disabled
                              >
                                <option value="Ekart">
                                  Ekart
                                </option>
                              </select>
                            </div>

                            <div>
                              <label>
                                Courier Name
                              </label>

                              <input
                                type="text"
                                value="Ekart"
                                disabled
                              />
                            </div>

                            <div>
                              <label>
                                Weight (kg)
                              </label>

                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="0.40"
                                value={getFormValue(
                                  order.id,
                                  "weight"
                                )}
                                onChange={(e) =>
                                  handleFormChange(
                                    order.id,
                                    "weight",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label>
                                Shipping Cost (â‚¹)
                              </label>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="90"
                                value={getFormValue(
                                  order.id,
                                  "shippingCost"
                                )}
                                onChange={(e) =>
                                  handleFormChange(
                                    order.id,
                                    "shippingCost",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label>
                                Length (cm)
                              </label>

                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="30"
                                value={getFormValue(
                                  order.id,
                                  "length"
                                )}
                                onChange={(e) =>
                                  handleFormChange(
                                    order.id,
                                    "length",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label>
                                Width (cm)
                              </label>

                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="25"
                                value={getFormValue(
                                  order.id,
                                  "width"
                                )}
                                onChange={(e) =>
                                  handleFormChange(
                                    order.id,
                                    "width",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label>
                                Height (cm)
                              </label>

                              <input
                                type="number"
                                min="0.1"
                                step="0.1"
                                placeholder="5"
                                value={getFormValue(
                                  order.id,
                                  "height"
                                )}
                                onChange={(e) =>
                                  handleFormChange(
                                    order.id,
                                    "height",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label>
                                AWB Number
                              </label>

                              <input
                                type="text"
                                placeholder="Optional for now"
                                value={getFormValue(
                                  order.id,
                                  "awbNumber"
                                )}
                                onChange={(e) =>
                                  handleFormChange(
                                    order.id,
                                    "awbNumber",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                            <div>
                              <label>
                                Tracking URL
                              </label>

                              <input
                                type="url"
                                placeholder="Optional for now"
                                value={getFormValue(
                                  order.id,
                                  "trackingUrl"
                                )}
                                onChange={(e) =>
                                  handleFormChange(
                                    order.id,
                                    "trackingUrl",
                                    e.target.value
                                  )
                                }
                              />
                            </div>

                          </div>

                          <button
                            type="button"
                            className="admin-create-shipment-button"
                            onClick={() =>
                              handleCreateShipment(
                                order
                              )
                            }
                            disabled={
                              creatingOrderId ===
                              order.id
                            }
                          >
                            {creatingOrderId ===
                            order.id
                              ? "Creating Shipment..."
                              : "Confirm & Create Shipment"}
                          </button>

                        </div>

                      </>
                    )}

                  </article>
                );
              }
            )}

          </div>

        )}

      </section>

      {/* =========================
          EXISTING SHIPMENTS
      ========================= */}

      <section className="admin-shipping-section">

        <div className="admin-shipping-section-title">

          <div>
            <p>
              LOGISTICS
            </p>

            <h2>
              Existing Shipments
            </h2>
          </div>

          <strong>
            {shipments.length}{" "}

            {shipments.length === 1
              ? "Shipment"
              : "Shipments"}
          </strong>

        </div>

        {shipments.length === 0 ? (

          <div className="admin-empty-state">
            No shipments have been
            created yet.
          </div>

        ) : (

          <div className="admin-shipments-list">

            {shipments.map(
              (shipment) => {

                const isExpanded =
                  expandedShipmentId ===
                  shipment.id;

                const isEditing =
                  editingShipmentId ===
                  shipment.id;

                const editForm =
                  shipmentEditForms[
                    shipment.id
                  ] || {};

                return (
                  <article
                    className="admin-existing-shipment-card"
                    key={
                      shipment.id
                    }
                  >

                    {/* COMPACT ROW */}

                    <div className="admin-existing-shipment">

                      <div>
                        <span>
                          SHIPMENT
                        </span>

                        <strong>
                          #{shipment.id}
                        </strong>
                      </div>

                      <div>
                        <span>
                          ORDER
                        </span>

                        <strong>
                          #{shipment.order_id}
                        </strong>
                      </div>

                      <div>
                        <span>
                          CUSTOMER
                        </span>

                        <strong>
                          {
                            shipment.full_name
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          PROVIDER
                        </span>

                        <strong>
                          {
                            shipment.shipment_provider ||
                            "Ekart"
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          COURIER
                        </span>

                        <strong>
                          {
                            shipment.courier_name ||
                            "Ekart"
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          AWB
                        </span>

                        <strong>
                          {
                            shipment.awb_number ||
                            "Not assigned"
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          STATUS
                        </span>

                        <strong>
                          {formatStatus(
                            shipment.shipment_status
                          )}
                        </strong>
                      </div>

                      <div className="admin-shipment-view-action">

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedShipmentId(
                              isExpanded
                                ? null
                                : shipment.id
                            )
                          }
                        >
                          {isExpanded
                            ? "Hide Details"
                            : "View Details"}
                        </button>

                      </div>

                    </div>

                    {/* DETAILS */}

                    {isExpanded && (
                      <>

                        <div className="admin-existing-shipment-details">

                          <div>
                            <span>
                              Weight
                            </span>

                            <strong>
                              {shipment.weight
                                ? `${shipment.weight} kg`
                                : "-"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Dimensions
                            </span>

                            <strong>
                              {shipment.length &&
                              shipment.width &&
                              shipment.height
                                ? `${shipment.length} Ã— ${shipment.width} Ã— ${shipment.height} cm`
                                : "-"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Shipping Cost
                            </span>

                            <strong>
                              {shipment.shipping_cost !==
                              null
                                ? `â‚¹${shipment.shipping_cost}`
                                : "-"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Payment Method
                            </span>

                            <strong>
                              {formatStatus(
                                shipment.payment_method
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Payment Status
                            </span>

                            <strong>
                              {formatStatus(
                                shipment.payment_status
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Order Status
                            </span>

                            <strong>
                              {formatStatus(
                                shipment.order_status
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Destination
                            </span>

                            <strong>
                              {shipment.city},{" "}
                              {shipment.state} -{" "}
                              {shipment.pincode}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Created
                            </span>

                            <strong>
                              {formatDate(
                                shipment.created_at
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Pickup
                            </span>

                            <strong>
                              {shipment.pickup_date
                                ? formatDate(
                                    shipment.pickup_date
                                  )
                                : "Not scheduled"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Shipped
                            </span>

                            <strong>
                              {shipment.shipped_at
                                ? formatDate(
                                    shipment.shipped_at
                                  )
                                : "-"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Delivered
                            </span>

                            <strong>
                              {shipment.delivered_at
                                ? formatDate(
                                    shipment.delivered_at
                                  )
                                : "-"}
                            </strong>
                          </div>

                          <div>
                            <span>
                              Tracking URL
                            </span>

                            {shipment.tracking_url ? (
                              <a
                                href={
                                  shipment.tracking_url
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                Open Tracking
                              </a>
                            ) : (
                              <strong>
                                Not available
                              </strong>
                            )}

                          </div>

                        </div>

                        {/* EDIT BUTTON */}

                        {!isEditing && (

                          <div className="admin-shipment-edit-actions">

                            <button
                              type="button"
                              onClick={() =>
                                handleEditShipment(
                                  shipment
                                )
                              }
                            >
                              Edit Shipment
                            </button>

                          </div>

                        )}

                        {/* EDIT FORM */}

                        {isEditing && (

                          <div className="admin-shipment-edit-form">

                            <h3>
                              Edit Ekart Shipment
                            </h3>

                            <div className="admin-shipment-form-grid">

                              <div>

                                <label>
                                  Shipping Provider
                                </label>

                                <input
                                  type="text"
                                  value="Ekart"
                                  disabled
                                />

                              </div>

                              <div>

                                <label>
                                  Courier
                                </label>

                                <input
                                  type="text"
                                  value="Ekart"
                                  disabled
                                />

                              </div>

                              <div>

                                <label>
                                  AWB Number
                                </label>

                                <input
                                  type="text"
                                  value={
                                    editForm.awbNumber ??
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleShipmentEditChange(
                                      shipment.id,
                                      "awbNumber",
                                      e.target.value
                                    )
                                  }
                                />

                              </div>

                              <div>

                                <label>
                                  Tracking URL
                                </label>

                                <input
                                  type="url"
                                  value={
                                    editForm.trackingUrl ??
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleShipmentEditChange(
                                      shipment.id,
                                      "trackingUrl",
                                      e.target.value
                                    )
                                  }
                                />

                              </div>

                              <div>

                                <label>
                                  Shipping Cost (â‚¹)
                                </label>

                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={
                                    editForm.shippingCost ??
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleShipmentEditChange(
                                      shipment.id,
                                      "shippingCost",
                                      e.target.value
                                    )
                                  }
                                />

                              </div>

                              <div>

                                <label>
                                  Shipment Status
                                </label>

                                <select
                                  value={
                                    editForm.shipmentStatus ||
                                    "pending"
                                  }
                                  onChange={(e) =>
                                    handleShipmentEditChange(
                                      shipment.id,
                                      "shipmentStatus",
                                      e.target.value
                                    )
                                  }
                                >

                                  <option value="pending">
                                    Pending
                                  </option>

                                  <option value="created">
                                    Created
                                  </option>

                                  <option value="pickup_scheduled">
                                    Pickup Scheduled
                                  </option>

                                  <option value="picked_up">
                                    Picked Up
                                  </option>

                                  <option value="shipped">
                                    Shipped
                                  </option>

                                  <option value="in_transit">
                                    In Transit
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

                              <div>

                                <label>
                                  Pickup Scheduled
                                </label>

                                <label className="admin-shipment-checkbox">

                                  <input
                                    type="checkbox"
                                    checked={
                                      Boolean(
                                        editForm.pickupScheduled
                                      )
                                    }
                                    onChange={(e) =>
                                      handleShipmentEditChange(
                                        shipment.id,
                                        "pickupScheduled",
                                        e.target.checked
                                      )
                                    }
                                  />

                                  <span>
                                    Pickup scheduled
                                  </span>

                                </label>

                              </div>

                              <div>

                                <label>
                                  Pickup Date
                                </label>

                                <input
                                  type="datetime-local"
                                  value={
                                    editForm.pickupDate ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleShipmentEditChange(
                                      shipment.id,
                                      "pickupDate",
                                      e.target.value
                                    )
                                  }
                                />

                              </div>

                              <div>

                                <label>
                                  Shipped Date
                                </label>

                                <input
                                  type="datetime-local"
                                  value={
                                    editForm.shippedAt ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleShipmentEditChange(
                                      shipment.id,
                                      "shippedAt",
                                      e.target.value
                                    )
                                  }
                                />

                              </div>

                              <div>

                                <label>
                                  Delivered Date
                                </label>

                                <input
                                  type="datetime-local"
                                  value={
                                    editForm.deliveredAt ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleShipmentEditChange(
                                      shipment.id,
                                      "deliveredAt",
                                      e.target.value
                                    )
                                  }
                                />

                              </div>

                            </div>

                            <div className="admin-shipment-edit-buttons">

                              <button
                                type="button"
                                className="admin-shipment-save-button"
                                onClick={() =>
                                  handleUpdateShipment(
                                    shipment
                                  )
                                }
                                disabled={
                                  savingShipmentId ===
                                  shipment.id
                                }
                              >
                                {savingShipmentId ===
                                shipment.id
                                  ? "Saving..."
                                  : "Save Shipment"}
                              </button>

                              <button
                                type="button"
                                className="admin-shipment-cancel-button"
                                onClick={() =>
                                  handleCancelShipmentEdit(
                                    shipment.id
                                  )
                                }
                                disabled={
                                  savingShipmentId ===
                                  shipment.id
                                }
                              >
                                Cancel
                              </button>

                            </div>

                          </div>

                        )}

                      </>
                    )}

                  </article>
                );
              }
            )}

          </div>

        )}

      </section>

    </main>
  );
}

export default AdminShipping;
