import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import "./Auth.css";
import { useAuth } from "../context/AuthContext";

function Signup() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const googleButtonRef = useRef(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");
  const [submitting, setSubmitting] =
    useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // =========================
  // NORMAL SIGNUP
  // =========================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setMessage("");
    setError("");

    if (
      formData.password !==
      formData.confirmPassword
    ) {
      setError(
        "Passwords do not match."
      );
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        "https://api.lanawardrobe.in/api/auth/register",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            fullName:
              formData.fullName,
            email:
              formData.email,
            phone:
              formData.phone,
            password:
              formData.password,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setError(
          data.message ||
            "Failed to create account."
        );

        return;
      }

      setMessage(data.message);

      setTimeout(() => {
        navigate(
          `/verify-email?email=${encodeURIComponent(
            formData.email
          )}`
        );
      }, 800);

    } catch (error) {
      console.error(
        "Signup error:",
        error
      );

      setError(
        "Unable to connect to the server."
      );

    } finally {
      setSubmitting(false);
    }
  };

  // =========================
  // GOOGLE SIGNUP / LOGIN
  // =========================

  const handleGoogleSignup =
    async (googleResponse) => {

      setError("");
      setMessage("");

      try {
        setSubmitting(true);

        const response = await fetch(
          "https://api.lanawardrobe.in/api/auth/google",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              credential:
                googleResponse.credential,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.message ||
              "Google signup failed."
          );
        }

        login(
          data.user,
          data.token
        );

        setMessage(
          "Account created successfully with Google."
        );

        setTimeout(() => {
          navigate("/", {
            replace: true,
          });
        }, 500);

      } catch (error) {
        console.error(
          "Google signup error:",
          error
        );

        setError(
          error.message ||
            "Google signup failed."
        );

      } finally {
        setSubmitting(false);
      }
    };

  // =========================
  // LOAD GOOGLE SCRIPT
  // =========================

  useEffect(() => {
    const googleClientId =
      import.meta.env
        .VITE_GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      console.error(
        "VITE_GOOGLE_CLIENT_ID is missing."
      );

      return;
    }

    const initializeGoogle = () => {
      if (
        !window.google ||
        !googleButtonRef.current
      ) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,

        callback:
          handleGoogleSignup,
      });

      googleButtonRef.current.innerHTML =
        "";

  const buttonWidth = Math.min(
  320,
  googleButtonRef.current.clientWidth
);

window.google.accounts.id.renderButton(
  googleButtonRef.current,
  {
    theme: "outline",
    size: "large",
    width: buttonWidth,
    text: "continue_with",
    shape: "rectangular",
  }
);
    };

    const existingScript =
      document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );

    if (existingScript) {
      initializeGoogle();
      return;
    }

    const script =
      document.createElement(
        "script"
      );

    script.src =
      "https://accounts.google.com/gsi/client";

    script.async = true;
    script.defer = true;

    script.onload =
      initializeGoogle;

    document.body.appendChild(
      script
    );
  }, []);

  return (
    <main className="auth-page">

      <div className="auth-card">

        <div className="auth-heading">

          <p className="auth-kicker">
            LANA WARDROBE
          </p>

          <h1>
            Create Account
          </h1>

          <p>
            Join Lana Wardrobe and make
            shopping easier.
          </p>

        </div>

        {/* GOOGLE SIGNUP */}

        <div className="google-login-section">

          <div
            ref={googleButtonRef}
            className="google-login-button"
          />

        </div>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        {/* NORMAL SIGNUP */}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >

          <div className="auth-field">

            <label htmlFor="fullName">
              Full Name
            </label>

            <input
              id="fullName"
              name="fullName"
              type="text"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />

          </div>

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
              required
            />

          </div>

          <div className="auth-field">

            <label htmlFor="phone">
              Phone Number
            </label>

            <input
              id="phone"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter your phone number"
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
              placeholder="Create a password"
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
              placeholder="Enter password again"
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
              ? "Creating Account..."
              : "Create Account"}
          </button>

        </form>

        <p className="auth-switch">

          Already have an account?{" "}

          <Link to="/login">
            Login
          </Link>

        </p>

      </div>

    </main>
  );
}

export default Signup;