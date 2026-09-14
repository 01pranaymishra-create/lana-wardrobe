import {
  useEffect,
  useMemo,
  useState,
} from "react";

function AdminCustomers() {
  const [customers, setCustomers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [searchTerm, setSearchTerm] =
    useState("");
  const [updatingId, setUpdatingId] =
  useState(null);

  useEffect(() => {
    const fetchCustomers =
      async () => {
        try {
          const token =
            localStorage.getItem(
              "lana_token"
            );

          const response =
            await fetch(
              "http://localhost:5000/api/admin/customers",
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
                "Failed to load customers."
            );
          }

          setCustomers(
            data.customers || []
          );

        } catch (error) {
          console.error(
            "Customers error:",
            error
          );

          setError(
            error.message
          );

        } finally {
          setLoading(false);
        }
      };

    fetchCustomers();
  }, []);

  const filteredCustomers =
    useMemo(() => {
      const search =
        searchTerm
          .trim()
          .toLowerCase();

      if (!search) {
        return customers;
      }

      return customers.filter(
        (customer) => {
          return (
            customer.full_name
              ?.toLowerCase()
              .includes(search) ||

            customer.email
              ?.toLowerCase()
              .includes(search) ||

            customer.phone
              ?.toLowerCase()
              .includes(search)
          );
        }
      );
    }, [
      customers,
      searchTerm,
    ]);

  const formatDate =
    (dateValue) => {
      if (!dateValue) {
        return "-";
      }

      return new Date(
        dateValue
      ).toLocaleDateString(
        "en-IN",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );
    };

const handleToggleStatus =
  async (customer) => {
    try {
      const nextStatus =
        !customer.is_active;

      const action =
        nextStatus
          ? "activate"
          : "deactivate";

      const confirmed =
        window.confirm(
          `Are you sure you want to ${action} ${customer.full_name}'s account?`
        );

      if (!confirmed) {
        return;
      }

      setUpdatingId(customer.id);

      const token =
        localStorage.getItem(
          "lana_token"
        );

      const response =
        await fetch(
          `http://localhost:5000/api/admin/customers/${customer.id}/status`,
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body: JSON.stringify({
              isActive: nextStatus,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Failed to update customer."
        );
      }

      setCustomers(
        (currentCustomers) =>
          currentCustomers.map(
            (item) =>
              item.id === customer.id
                ? {
                    ...item,
                    is_active:
                      nextStatus,
                  }
                : item
          )
      );

    } catch (error) {
      alert(error.message);

    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return (
      <main className="admin-page">
        <p>
          Loading customers...
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

  return (
    <main className="admin-page">

      <section className="admin-header">
        <p>
          LANA WARDROBE
        </p>

        <h1>
          Manage Customers
        </h1>

        <p>
          View customer accounts
          and order activity.
        </p>
      </section>

      <section className="admin-customers-section">

        <div className="admin-customers-toolbar">

          <div>
            <strong>
              {filteredCustomers.length}
            </strong>{" "}
            Customers
          </div>

          <input
            type="text"
            placeholder="Search name, email or phone..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
          />

        </div>

        <div className="admin-customers-table-wrapper">

          <table className="admin-customers-table">

            <thead>
              <tr>
                <th>
                  Customer
                </th>

                <th>
                  Contact
                </th>

                <th>
                  Orders
                </th>

                <th>
                  Total Spent
                </th>

                <th>
                  Email
                </th>

                <th>
                  Status
                </th>

                <th>
                  Joined
                </th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan="8"
                    className="admin-customers-empty"
                  >
                    No customers found.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(
                  (customer) => (
                    <tr
                      key={customer.id}
                    >

                      <td>
                        <strong>
                          {customer.full_name}
                        </strong>

                        <div className="customer-id">
                          ID #{customer.id}
                        </div>
                      </td>

                      <td>
                        <div>
                          {customer.email}
                        </div>

                        <div className="customer-phone">
                          {customer.phone ||
                            "No phone"}
                        </div>
                      </td>

                      <td>
                        {customer.total_orders}
                      </td>

                      <td>
                        ₹
                        {Number(
                          customer.total_spent ||
                            0
                        ).toFixed(2)}
                      </td>

                      <td>
                        <span
                          className={
                            customer.email_verified
                              ? "customer-badge verified"
                              : "customer-badge unverified"
                          }
                        >
                          {customer.email_verified
                            ? "Verified"
                            : "Not Verified"}
                        </span>
                      </td>

                      <td>
                        <span
                          className={
                            customer.is_active
                              ? "customer-badge active"
                              : "customer-badge inactive"
                          }
                        >
                          {customer.is_active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          customer.created_at
                        )}
                      </td>
                        <td>
                        <button
                            type="button"
                            className={
                            customer.is_active
                                ? "customer-status-btn deactivate"
                                : "customer-status-btn activate"
                            }
                            disabled={
                            updatingId === customer.id
                            }
                            onClick={() =>
                            handleToggleStatus(customer)
                            }
                        >
                            {updatingId === customer.id
                            ? "UPDATING..."
                            : customer.is_active
                            ? "DEACTIVATE"
                            : "ACTIVATE"}
                        </button>
                        </td>
                    </tr>
                  )
                )
              )}

            </tbody>

          </table>

        </div>

      </section>

    </main>
  );
}

export default AdminCustomers;