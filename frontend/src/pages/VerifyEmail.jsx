import { useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import "./Auth.css";

function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const emailFromUrl =
    searchParams.get("email") || "";

  const [email] = useState(emailFromUrl);
  const [otp, setOtp] = useState("");

  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [resending, setResending] =
    useState(false);

  const handleVerify = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (!otp.trim()) {
      setError("Please enter the OTP.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        "https://api.lanawardrobe.in/api/auth/verify-email-otp",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email,
            otp,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "OTP verification failed."
        );

        return;
      }

      setMessage(
        "Email verified successfully."
      );

      setTimeout(() => {
        navigate("/login");
      }, 1000);

    } catch (error) {
      console.error(
        "OTP verification error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setMessage("");
    setError("");

    try {
      setResending(true);

      const response = await fetch(
        "https://api.lanawardrobe.in/api/auth/resend-email-otp",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Failed to resend OTP."
        );

        return;
      }

      setMessage(data.message);

    } catch (error) {
      console.error(
        "Resend OTP error:",
        error
      );

      setError(
        "Unable to resend OTP."
      );
    } finally {
      setResending(false);
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
            Verify Your Email
          </h1>

          <p>
            Enter the 6-digit OTP sent to
          </p>

          <p>
            <strong>
              {email}
            </strong>
          </p>

        </div>

        <form
          className="auth-form"
          onSubmit={handleVerify}
        >

          <div className="auth-field">

            <label htmlFor="otp">
              Verification Code
            </label>

            <input
              id="otp"
              type="text"
              inputMode="numeric"
              maxLength="6"
              placeholder="Enter 6-digit OTP"
              value={otp}
              onChange={(e) =>
                setOtp(
                  e.target.value.replace(
                    /\D/g,
                    ""
                  )
                )
              }
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
              ? "Verifying..."
              : "Verify Email"}
          </button>

        </form>

        <p className="auth-switch">

          Didn't receive the OTP?{" "}

          <button
            type="button"
            className="auth-link-button"
            onClick={handleResendOtp}
            disabled={resending}
          >
            {resending
              ? "Sending..."
              : "Resend OTP"}
          </button>

        </p>

        <p className="auth-switch">

          <Link to="/signup">
            Back to Sign Up
          </Link>

        </p>

      </div>
    </main>
  );
}

export default VerifyEmail;