import { useState } from "react";
import { Link, useLocation, useNavigate,} from "react-router-dom";
import "./Auth.css";
import { useAuth } from "../context/AuthContext";

function Login() {
  const navigate = useNavigate();
const location = useLocation();

const { login } = useAuth();

const redirectPath =
  location.state?.from || "/";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");

    try {
      setSubmitting(true);

      const response = await fetch(
        "https://api.lanawardrobe.in/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Login failed."
        );
        return;
      }

      setMessage("Login successful.");

      /*
        TEMPORARY DEVELOPMENT STORAGE

        We will improve this before production.
      */
      login(data.user, data.token);
      setTimeout(() => {
  navigate(redirectPath, {
    replace: true,
  });
}, 700);

    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-card">

        <div className="auth-heading">

          <p className="auth-kicker">
            LANA WARDROBE
          </p>

          <h1>
            Welcome Back
          </h1>

          <p>
            Login to continue shopping.
          </p>

        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          <div className="auth-field">

            <label htmlFor="email">
              Email
            </label>

            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              autoComplete="email"
              required
            />

          </div>

          <div className="auth-field">

            <label htmlFor="password">
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />

          </div>

          <div className="auth-forgot-row">

            <Link to="/forgot-password">
              Forgot Password?
            </Link>

          </div>

          {error && (
            <p className="auth-error">
              {error}
            </p>
          )}

          {message && (
            <p className="auth-success">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={submitting}
          >
            {submitting
              ? "Logging In..."
              : "Login"}
          </button>

        </form>

        <p className="auth-switch">

          Don't have an account?{" "}

          <Link to="/signup">
            Create Account
          </Link>

        </p>

      </div>
    </main>
  );
}

export default Login;
