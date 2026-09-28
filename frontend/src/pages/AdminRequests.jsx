import { useEffect, useState } from "react";

function AdminRequests() {
  const [activeTab, setActiveTab] =
    useState("bulk");

  const [bulkRequests, setBulkRequests] =
    useState([]);

  const [
    customizationRequests,
    setCustomizationRequests,
  ] = useState([]);

  const [contactMessages, setContactMessages] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const loadRequests = async () => {
      try {
        const token =
          localStorage.getItem("lana_token");

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [
          bulkResponse,
          customizationResponse,
          contactResponse,
        ] = await Promise.all([
          fetch(
            "https://api.lanawardrobe.in/api/admin/bulk-order-requests",
            { headers }
          ),

          fetch(
            "https://api.lanawardrobe.in/api/admin/customization-requests",
            { headers }
          ),

          fetch(
            "https://api.lanawardrobe.in/api/admin/contact-messages",
            { headers }
          ),
        ]);

        const bulkData =
          await bulkResponse.json();

        const customizationData =
          await customizationResponse.json();

        const contactData =
          await contactResponse.json();

        if (!bulkResponse.ok) {
          throw new Error(
            bulkData.message ||
              "Failed to load bulk order requests."
          );
        }

        if (!customizationResponse.ok) {
          throw new Error(
            customizationData.message ||
              "Failed to load customization requests."
          );
        }

        if (!contactResponse.ok) {
          throw new Error(
            contactData.message ||
              "Failed to load contact messages."
          );
        }

        setBulkRequests(
          bulkData.requests || []
        );

        setCustomizationRequests(
          customizationData.requests || []
        );

        setContactMessages(
          contactData.messages || []
        );
      } catch (err) {
        console.error(
          "Admin requests error:",
          err
        );

        setError(
          err.message ||
            "Failed to load customer requests."
        );
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, []);

  const formatDate = (value) => {
    if (!value) return "-";

    return new Date(value).toLocaleString(
      "en-IN"
    );
  };

  const formatSizes = (sizes) => {
    if (!sizes) return "-";

    if (
      typeof sizes !== "object" ||
      Array.isArray(sizes)
    ) {
      return String(sizes);
    }

    const entries =
      Object.entries(sizes).filter(
        ([, quantity]) =>
          Number(quantity) > 0
      );

    if (entries.length === 0) {
      return "-";
    }

    return entries
      .map(
        ([size, quantity]) =>
          `${size}: ${quantity}`
      )
      .join(", ");
  };

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-request-state">
          Loading customer requests...
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="admin-page">
        <div className="admin-request-state error">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <section className="admin-header">
        <p>LANA WARDROBE</p>

        <h1>Customer Requests</h1>

        <p>
          Manage bulk orders,
          customization requests and
          contact messages.
        </p>
      </section>

      <section className="request-tabs">
        <button
          type="button"
          className={
            activeTab === "bulk"
              ? "request-tab active"
              : "request-tab"
          }
          onClick={() =>
            setActiveTab("bulk")
          }
        >
          Bulk Orders
          <span>{bulkRequests.length}</span>
        </button>

        <button
          type="button"
          className={
            activeTab === "customization"
              ? "request-tab active"
              : "request-tab"
          }
          onClick={() =>
            setActiveTab(
              "customization"
            )
          }
        >
          Customization
          <span>
            {customizationRequests.length}
          </span>
        </button>

        <button
          type="button"
          className={
            activeTab === "contact"
              ? "request-tab active"
              : "request-tab"
          }
          onClick={() =>
            setActiveTab("contact")
          }
        >
          Contact Messages
          <span>
            {contactMessages.length}
          </span>
        </button>
      </section>

      {activeTab === "bulk" && (
        <section className="requests-section">
          <div className="requests-section-heading">
            <div>
              <p>BULK ORDERS</p>
              <h2>
                Bulk Order Requests
              </h2>
            </div>

            <span>
              {bulkRequests.length}{" "}
              requests
            </span>
          </div>

          {bulkRequests.length === 0 ? (
            <div className="admin-request-state">
              No bulk order requests.
            </div>
          ) : (
            <div className="request-card-list">
              {bulkRequests.map(
                (request) => (
                  <article
                    key={request.id}
                    className="request-card"
                  >
                    <div className="request-card-header">
                      <div>
                        <span className="request-label">
                          BULK REQUEST
                        </span>

                        <h3>
                          Request #
                          {request.id}
                        </h3>
                      </div>

                      <span className="request-status">
                        {request.status ||
                          "new"}
                      </span>
                    </div>

                    <div className="request-details-grid">
                      <div>
                        <span>
                          Organization
                        </span>
                        <strong>
                          {
                            request.organization_name
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Contact Person
                        </span>
                        <strong>
                          {
                            request.contact_person
                          }
                        </strong>
                      </div>

                      <div>
                        <span>Phone</span>
                        <strong>
                          {request.phone}
                        </strong>
                      </div>

                      <div>
                        <span>Email</span>
                        <strong>
                          {request.email ||
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          T-shirt Type
                        </span>
                        <strong>
                          {
                            request.tshirt_type
                          }
                        </strong>
                      </div>

                      <div>
                        <span>Fabric</span>
                        <strong>
                          {request.fabric ||
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>Color</span>
                        <strong>
                          {request.color_name ||
                            request.color_hex ||
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Total Quantity
                        </span>
                        <strong>
                          {
                            request.total_quantity
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Size Quantities
                        </span>
                        <strong>
                          {formatSizes(
                            request.size_quantities
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Print Position
                        </span>
                        <strong>
                          {
                            request.print_position
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Required Date
                        </span>
                        <strong>
                          {request.required_date
                            ? new Date(
                                request.required_date
                              ).toLocaleDateString(
                                "en-IN"
                              )
                            : "-"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Delivery City
                        </span>
                        <strong>
                          {request.delivery_city ||
                            "-"}
                        </strong>
                      </div>
                    </div>

                    {request.notes && (
                      <div className="request-message-box">
                        <span>Notes</span>
                        <p>
                          {request.notes}
                        </p>
                      </div>
                    )}

                    <div className="request-card-footer">
                      <span>
                        Submitted{" "}
                        {formatDate(
                          request.created_at
                        )}
                      </span>

                      {request.design_file_path && (
                        <a
                          href={`https://api.lanawardrobe.in${request.design_file_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="request-file-button"
                        >
                          Open Design File
                        </a>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      )}

      {activeTab ===
        "customization" && (
        <section className="requests-section">
          <div className="requests-section-heading">
            <div>
              <p>CUSTOMIZATION</p>
              <h2>
                Customization Requests
              </h2>
            </div>

            <span>
              {
                customizationRequests.length
              }{" "}
              requests
            </span>
          </div>

          {customizationRequests.length ===
          0 ? (
            <div className="admin-request-state">
              No customization requests.
            </div>
          ) : (
            <div className="request-card-list">
              {customizationRequests.map(
                (request) => (
                  <article
                    key={request.id}
                    className="request-card"
                  >
                    <div className="request-card-header">
                      <div>
                        <span className="request-label">
                          CUSTOM REQUEST
                        </span>

                        <h3>
                          Request #
                          {request.id}
                        </h3>
                      </div>

                      <span className="request-status">
                        {request.status ||
                          "new"}
                      </span>
                    </div>

                    <div className="request-details-grid">
                      <div>
                        <span>Customer</span>
                        <strong>
                          {
                            request.customer_name
                          }
                        </strong>
                      </div>

                      <div>
                        <span>Phone</span>
                        <strong>
                          {request.phone}
                        </strong>
                      </div>

                      <div>
                        <span>Email</span>
                        <strong>
                          {request.email ||
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          T-shirt Type
                        </span>
                        <strong>
                          {
                            request.tshirt_type
                          }
                        </strong>
                      </div>

                      <div>
                        <span>Color</span>
                        <strong>
                          {request.color_name ||
                            request.color_hex ||
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Total Quantity
                        </span>
                        <strong>
                          {
                            request.total_quantity
                          }
                        </strong>
                      </div>

                      <div>
                        <span>
                          Size Quantities
                        </span>
                        <strong>
                          {formatSizes(
                            request.size_quantities
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Print Position
                        </span>
                        <strong>
                          {
                            request.print_position
                          }
                        </strong>
                      </div>
                    </div>

                    {request.notes && (
                      <div className="request-message-box">
                        <span>Notes</span>
                        <p>
                          {request.notes}
                        </p>
                      </div>
                    )}

                    <div className="request-card-footer">
                      <span>
                        Submitted{" "}
                        {formatDate(
                          request.created_at
                        )}
                      </span>

                      {request.design_file_path && (
                        <a
                          href={`https://api.lanawardrobe.in${request.design_file_path}`}
                          target="_blank"
                          rel="noreferrer"
                          className="request-file-button"
                        >
                          Open Design File
                        </a>
                      )}
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      )}

      {activeTab === "contact" && (
        <section className="requests-section">
          <div className="requests-section-heading">
            <div>
              <p>MESSAGES</p>
              <h2>
                Contact Messages
              </h2>
            </div>

            <span>
              {contactMessages.length}{" "}
              messages
            </span>
          </div>

          {contactMessages.length === 0 ? (
            <div className="admin-request-state">
              No contact messages.
            </div>
          ) : (
            <div className="request-card-list">
              {contactMessages.map(
                (message) => (
                  <article
                    key={message.id}
                    className="request-card"
                  >
                    <div className="request-card-header">
                      <div>
                        <span className="request-label">
                          CONTACT MESSAGE
                        </span>

                        <h3>
                          Message #
                          {message.id}
                        </h3>
                      </div>

                      <span className="request-status">
                        {message.status ||
                          "new"}
                      </span>
                    </div>

                    <div className="request-details-grid">
                      <div>
                        <span>Name</span>
                        <strong>
                          {
                            message.customer_name
                          }
                        </strong>
                      </div>

                      <div>
                        <span>Phone</span>
                        <strong>
                          {message.phone ||
                            "-"}
                        </strong>
                      </div>

                      <div>
                        <span>Email</span>
                        <strong>
                          {message.email}
                        </strong>
                      </div>

                      <div>
                        <span>
                          Category
                        </span>
                        <strong>
                          {message.category ||
                            "-"}
                        </strong>
                      </div>

                      <div className="request-grid-full">
                        <span>Subject</span>
                        <strong>
                          {message.subject ||
                            "-"}
                        </strong>
                      </div>
                    </div>

                    <div className="request-message-box">
                      <span>Message</span>
                      <p>
                        {message.message}
                      </p>
                    </div>

                    <div className="request-card-footer">
                      <span>
                        Submitted{" "}
                        {formatDate(
                          message.created_at
                        )}
                      </span>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default AdminRequests;