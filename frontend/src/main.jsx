import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProductProvider } from "./context/ProductContext.jsx";
import "./index.css";
import App from "./App.jsx";

import { CartProvider } from "./context/CartContext.jsx";
import { WishlistProvider } from "./context/WishlistContext.jsx";
import { AuthProvider } from "./context/AuthContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ProductProvider>
      <AuthProvider>
        <WishlistProvider>
          <CartProvider>
            <App />
          </CartProvider>
        </WishlistProvider>
      </AuthProvider>
    </ProductProvider>
  </StrictMode>
);
