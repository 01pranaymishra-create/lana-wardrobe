import { useAuth } from "../context/AuthContext";

function Account() {
  const {
    user,
  } = useAuth();

  return (
    <main
      style={{
        minHeight: "70vh",
        padding: "60px 20px",
        background: "#faf8f4",
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          background: "#ffffff",
          padding: "35px",
          borderRadius: "12px",
          boxShadow:
            "0 8px 25px rgba(0,0,0,0.08)",
        }}
      >
        <p
          style={{
            letterSpacing: "3px",
            fontSize: "12px",
            marginBottom: "8px",
          }}
        >
          LANA WARDROBE
        </p>

        <h1
  style={{
    color: "#111111",
    fontSize: "38px",
    marginTop: "10px",
  }}
>
  My Account
</h1>

        <p
          style={{
            marginTop: "8px",
            color: "#666666",
          }}
        >
          Manage your Lana Wardrobe account.
        </p>

        <div
          style={{
            marginTop: "35px",
            display: "grid",
            gap: "20px",
          }}
        >
          <div>
            <strong>Full Name</strong>

            <p>
              {user?.fullName ||
                user?.full_name ||
                "Not available"}
            </p>
          </div>

          <div>
            <strong>Email Address</strong>

            <p>
              {user?.email ||
                "Not available"}
            </p>
          </div>

          <div>
            <strong>Phone Number</strong>

            <p>
              {user?.phone ||
                "Not provided"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Account;
