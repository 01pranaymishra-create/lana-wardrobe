import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    try {
      const savedUser =
        localStorage.getItem("lana_user");

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error(
        "Failed to load user:",
        error
      );

      localStorage.removeItem(
        "lana_user"
      );

      localStorage.removeItem(
        "lana_token"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const login = (userData, token) => {
    localStorage.setItem(
      "lana_token",
      token
    );

    localStorage.setItem(
      "lana_user",
      JSON.stringify(userData)
    );

    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem(
      "lana_token"
    );

    localStorage.removeItem(
      "lana_user"
    );

    setUser(null);
  };

  const isLoggedIn = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
