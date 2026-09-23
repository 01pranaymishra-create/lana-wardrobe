import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import "./Auth.css";
import { useAuth } from "../context/AuthContext";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const { login } = useAuth();

  const googleButtonRef = useRef(null);

  const redirectPath =
    location.state?.from || "/";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [message, setMessage] =
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
  // NORMAL EMAIL LOGIN
  // =========================

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
            "Content-Type":
              "application/json",
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

      login(
        data.user,
        data.token
      );

      setTimeout(() => {
        navigate(
          redirectPath,
          {
            replace: true,
          }
        );
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

  // =========================
  // GOOGLE LOGIN
  // =========================

  const handleGoogleLogin =
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
              "Google login failed."
          );
        }

        login(
          data.user,
          data.token
        );

        setMessage(
          "Google login successful."
        );

        setTimeout(() => {
          navigate(
            redirectPath,
            {
              replace: true,
            }
          );
        }, 500);

      } catch (error) {
        console.error(
          "Google login error:",
          error
        );

        setError(
          error.message ||
            "Google login failed."
        );

      } finally {
        setSubmitting(false);
      }
    };

  // =========================
  // LOAD GOOGLE LOGIN SCRIPT
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
          handleGoogleLogin,
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

    return () => {
      // Keep Google's script loaded
      // for future login visits.
    };
  }, []);

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

        {/* GOOGLE LOGIN */}

        <div className="google-login-section">

          <div
            ref={googleButtonRef}
            className="google-login-button"
          />

        </div>

        <div className="auth-divider">

          <span>
            OR
          </span>

        </div>

        {/* EMAIL LOGIN */}

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