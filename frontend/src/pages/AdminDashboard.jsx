import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function AdminDashboard() {
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalOrders: 0,
    pendingOrders: 0,
    paidOrders: 0,
    customers: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const token = localStorage.getItem("lana_token");

        const response = await fetch(
          " https://lana-wardrobe-production.up.railway.app/api/admin/dashboard-summary",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load dashboard."
          );
        }

        setSummary(data.summary);
      } catch (err) {
        console.error("Dashboard error:", err);

        setError(
          err.message ||
            "Failed to load dashboard."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  if (loading) {
    return (
      <main className="admin-page">
        <p>Loading dashboard...</p>
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

      {/* =========================
          HEADER
      ========================= */}

      <section className="admin-header">
        <p>LANA WARDROBE</p>

        <h1>Admin Dashboard</h1>

        <p>
          Manage products, orders,
          customers, categories and
          store operations.
        </p>
      </section>

      {/* =========================
          STATS
      ========================= */}

      <section className="admin-stats">

        <div className="admin-stat-card">
          <span>Total Products</span>

          <strong>
            {summary.totalProducts}
          </strong>
        </div>

        <div className="admin-stat-card">
          <span>Total Orders</span>

          <strong>
            {summary.totalOrders}
          </strong>
        </div>

        <div className="admin-stat-card">
          <span>Pending Orders</span>

          <strong>
            {summary.pendingOrders}
          </strong>
        </div>

        <div className="admin-stat-card">
          <span>Paid Orders</span>

          <strong>
            {summary.paidOrders}
          </strong>
        </div>

        <div className="admin-stat-card">
          <span>Customers</span>

          <strong>
            {summary.customers}
          </strong>
        </div>

      </section>

      {/* =========================
          STORE MANAGEMENT
      ========================= */}

      <section className="admin-actions">

        <h2>Store Management</h2>

        <div className="admin-action-grid">

          <button
            type="button"
            onClick={() =>
              navigate("/admin/products")
            }
          >
            Manage Products
          </button>

          <button
            type="button"
          >
            Manage Categories
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/admin/orders")
            }
          >
            Manage Orders
          </button>

          <button
            type="button"
            onClick={() =>
                navigate("/admin/customers")
            }
            >
            Manage Customers
            </button>

          <button
            type="button"
            onClick={() =>
              navigate("/admin/shipping")
            }
          >
            Shipping & Tracking
          </button>

          <button
                type="button"
                onClick={() =>
                    navigate("/admin/reviews")
                }
                >
                Ratings & Reviews
                </button>
        </div>

      </section>

    </main>
  );
}

export default AdminDashboard;