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

  if (loading) {
    return (
      <main className="admin-page">
        <p>Loading customer requests...</p>
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

  return (
    <main className="admin-page">
      <section className="admin-header">
        <p>LANA WARDROBE</p>

        <h1>Customer Requests</h1>

        <p>
          Manage bulk orders, customization
          requests and contact messages.
        </p>
      </section>

      <section
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "30px",
        }}
      >
        <button
          type="button"
          onClick={() =>
            setActiveTab("bulk")
          }
        >
          Bulk Orders ({bulkRequests.length})
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab("customization")
          }
        >
          Customization (
          {customizationRequests.length})
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab("contact")
          }
        >
          Contact Messages (
          {contactMessages.length})
        </button>
      </section>

      {activeTab === "bulk" && (
        <section>
          <h2>Bulk Order Requests</h2>

          {bulkRequests.length === 0 ? (
            <p>No bulk order requests.</p>
          ) : (
            bulkRequests.map((request) => (
              <div
                key={request.id}
                style={{
                  border:
                    "1px solid #ddd",
                  padding: "20px",
                  marginBottom: "20px",
                  borderRadius: "8px",
                }}
              >
                <h3>
                  Request #{request.id}
                </h3>

                <p>
                  <strong>
                    Organization:
                  </strong>{" "}
                  {request.organization_name}
                </p>

                <p>
                  <strong>
                    Contact Person:
                  </strong>{" "}
                  {request.contact_person}
                </p>

                <p>
                  <strong>Phone:</strong>{" "}
                  {request.phone}
                </p>

                <p>
                  <strong>Email:</strong>{" "}
                  {request.email || "-"}
                </p>

                <p>
                  <strong>
                    T-shirt Type:
                  </strong>{" "}
                  {request.tshirt_type}
                </p>

                <p>
                  <strong>
                    Total Quantity:
                  </strong>{" "}
                  {request.total_quantity}
                </p>

                <p>
                  <strong>Status:</strong>{" "}
                  {request.status || "new"}
                </p>

                <p>
                  <strong>Created:</strong>{" "}
                  {formatDate(
                    request.created_at
                  )}
                </p>

                {request.design_file_path && (
                  <p>
                    <a
                      href={`https://api.lanawardrobe.in${request.design_file_path}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open Design File
                    </a>
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      )}

      {activeTab === "customization" && (
        <section>
          <h2>
            Customization Requests
          </h2>

          {customizationRequests.length ===
          0 ? (
            <p>
              No customization requests.
            </p>
          ) : (
            customizationRequests.map(
              (request) => (
                <div
                  key={request.id}
                  style={{
                    border:
                      "1px solid #ddd",
                    padding: "20px",
                    marginBottom: "20px",
                    borderRadius: "8px",
                  }}
                >
                  <h3>
                    Request #{request.id}
                  </h3>

                  <p>
                    <strong>
                      Customer:
                    </strong>{" "}
                    {request.customer_name}
                  </p>

                  <p>
                    <strong>Phone:</strong>{" "}
                    {request.phone}
                  </p>

                  <p>
                    <strong>Email:</strong>{" "}
                    {request.email || "-"}
                  </p>

                  <p>
                    <strong>
                      T-shirt Type:
                    </strong>{" "}
                    {request.tshirt_type}
                  </p>

                  <p>
                    <strong>
                      Total Quantity:
                    </strong>{" "}
                    {request.total_quantity}
                  </p>

                  <p>
                    <strong>
                      Print Position:
                    </strong>{" "}
                    {request.print_position}
                  </p>

                  <p>
                    <strong>Status:</strong>{" "}
                    {request.status || "new"}
                  </p>

                  <p>
                    <strong>Created:</strong>{" "}
                    {formatDate(
                      request.created_at
                    )}
                  </p>

                  {request.design_file_path && (
                    <p>
                      <a
                        href={`https://api.lanawardrobe.in${request.design_file_path}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Design File
                      </a>
                    </p>
                  )}
                </div>
              )
            )
          )}
        </section>
      )}

      {activeTab === "contact" && (
        <section>
          <h2>Contact Messages</h2>

          {contactMessages.length === 0 ? (
            <p>No contact messages.</p>
          ) : (
            contactMessages.map(
              (message) => (
                <div
                  key={message.id}
                  style={{
                    border:
                      "1px solid #ddd",
                    padding: "20px",
                    marginBottom: "20px",
                    borderRadius: "8px",
                  }}
                >
                  <h3>
                    Message #{message.id}
                  </h3>

                  <p>
                    <strong>Name:</strong>{" "}
                    {message.customer_name}
                  </p>

                  <p>
                    <strong>Phone:</strong>{" "}
                    {message.phone || "-"}
                  </p>

                  <p>
                    <strong>Email:</strong>{" "}
                    {message.email}
                  </p>

                  <p>
                    <strong>Subject:</strong>{" "}
                    {message.subject || "-"}
                  </p>

                  <p>
                    <strong>Category:</strong>{" "}
                    {message.category || "-"}
                  </p>

                  <p>
                    <strong>Message:</strong>{" "}
                    {message.message}
                  </p>

                  <p>
                    <strong>Status:</strong>{" "}
                    {message.status || "new"}
                  </p>

                  <p>
                    <strong>Created:</strong>{" "}
                    {formatDate(
                      message.created_at
                    )}
                  </p>
                </div>
              )
            )
          )}
        </section>
      )}
    </main>
  );
}

export default AdminRequests;