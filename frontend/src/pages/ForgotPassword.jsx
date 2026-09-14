import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import "./Auth.css";

function ForgotPassword() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setMessage("");

    try {
      setSubmitting(true);

      const response = await fetch(
        "https://api.lanawardrobe.in/api/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Failed to send password reset OTP."
        );

        return;
      }

      setMessage(
        "Password reset OTP sent successfully."
      );

      setTimeout(() => {
        navigate("/reset-password", {
          state: {
            email,
          },
        });
      }, 700);

    } catch (error) {
      console.error(
        "Forgot password error:",
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
            Forgot Password
          </h1>

          <p>
            Enter your registered email and
            we'll send you a password reset OTP.
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
              type="email"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              placeholder="Enter your email"
              autoComplete="email"
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
              ? "Sending OTP..."
              : "Send Reset OTP"}
          </button>

        </form>

        <p className="auth-switch">

          Remember your password?{" "}

          <Link to="/login">
            Back to Login
          </Link>

        </p>

      </div>
    </main>
  );
}

export default ForgotPassword;
