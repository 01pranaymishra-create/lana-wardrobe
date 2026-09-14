function AdminDashboard() {
  return (
    <main className="admin-page">
      <section className="admin-header">
        <p>LANA WARDROBE</p>
        <h1>Admin Dashboard</h1>
        <p>
          Manage products, orders, customers,
          categories and store operations.
        </p>
      </section>

      <section className="admin-stats">
        <div className="admin-stat-card">
          <span>Total Products</span>
          <strong>--</strong>
        </div>

        <div className="admin-stat-card">
          <span>Total Orders</span>
          <strong>--</strong>
        </div>

        <div className="admin-stat-card">
          <span>Pending Orders</span>
          <strong>--</strong>
        </div>

        <div className="admin-stat-card">
          <span>Paid Orders</span>
          <strong>--</strong>
        </div>

        <div className="admin-stat-card">
          <span>Customers</span>
          <strong>--</strong>
        </div>
      </section>

      <section className="admin-actions">
        <h2>Store Management</h2>

        <div className="admin-action-grid">
          <button>Manage Products</button>
          <button>Manage Categories</button>
          <button>Manage Orders</button>
          <button>Manage Customers</button>
          <button>Shipping & Tracking</button>
          <button>Ratings & Reviews</button>
        </div>
      </section>
    </main>
  );
}

export default AdminDashboard;