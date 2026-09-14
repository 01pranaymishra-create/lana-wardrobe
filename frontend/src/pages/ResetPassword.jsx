import { useState } from "react";
import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import "./Auth.css";

function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();

  const savedEmail =
    location.state?.email || "";

  const [formData, setFormData] = useState({
    email: savedEmail,
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] =
    useState(false);

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]:
        event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    if (
      formData.newPassword !==
      formData.confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );

      return;
    }

    if (formData.newPassword.length < 6) {
      setError(
        "Password must be at least 6 characters long."
      );

      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        "http://localhost:5000/api/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            email: formData.email,
            otp: formData.otp,
            newPassword:
              formData.newPassword,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Failed to reset password."
        );

        return;
      }

      setMessage(
        "Password reset successfully."
      );

      setTimeout(() => {
        navigate("/login", {
          replace: true,
        });
      }, 900);

    } catch (error) {
      console.error(
        "Reset password error:",
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
            Reset Password
          </h1>

          <p>
            Enter the OTP sent to your
            email and choose a new password.
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

            <label htmlFor="otp">
              OTP
            </label>

            <input
              id="otp"
              name="otp"
              type="text"
              value={formData.otp}
              onChange={handleChange}
              placeholder="Enter 6-digit OTP"
              inputMode="numeric"
              maxLength="6"
              required
            />

          </div>

          <div className="auth-field">

            <label htmlFor="newPassword">
              New Password
            </label>

            <input
              id="newPassword"
              name="newPassword"
              type="password"
              value={
                formData.newPassword
              }
              onChange={handleChange}
              placeholder="Enter new password"
              autoComplete="new-password"
              required
            />

          </div>

          <div className="auth-field">

            <label htmlFor="confirmPassword">
              Confirm Password
            </label>

            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={
                formData.confirmPassword
              }
              onChange={handleChange}
              placeholder="Confirm new password"
              autoComplete="new-password"
              required
            />

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
              ? "Resetting..."
              : "Reset Password"}
          </button>

        </form>

        <p className="auth-switch">
          Back to{" "}

          <Link to="/login">
            Login
          </Link>
        </p>

      </div>
    </main>
  );
}

export default ResetPassword;