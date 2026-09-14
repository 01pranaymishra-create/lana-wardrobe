import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

const CartContext = createContext();

export function CartProvider({ children }) {
  const {
    user,
    isLoggedIn,
    loading: authLoading,
  } = useAuth();

  const [cartItems, setCartItems] =
    useState([]);

  const [loadedUserId, setLoadedUserId] =
    useState(null);

  /*
    LOAD THE CORRECT USER'S CART
  */
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isLoggedIn || !user?.id) {
      setCartItems([]);
      setLoadedUserId(null);
      return;
    }

    const storageKey =
      `lana_cart_${user.id}`;

    try {
      const savedCart =
        localStorage.getItem(storageKey);

      if (savedCart) {
        const parsedCart =
          JSON.parse(savedCart);

        setCartItems(
          Array.isArray(parsedCart)
            ? parsedCart
            : []
        );
      } else {
        setCartItems([]);
      }
    } catch (error) {
      console.error(
        "Failed to load cart:",
        error
      );

      setCartItems([]);
    }

    setLoadedUserId(
      String(user.id)
    );
  }, [
    user?.id,
    isLoggedIn,
    authLoading,
  ]);

  /*
    SAVE CURRENT USER'S CART
  */
  useEffect(() => {
    if (
      !isLoggedIn ||
      !user?.id ||
      loadedUserId !== String(user.id)
    ) {
      return;
    }

    const storageKey =
      `lana_cart_${user.id}`;

    localStorage.setItem(
      storageKey,
      JSON.stringify(cartItems)
    );
  }, [
    cartItems,
    user?.id,
    isLoggedIn,
    loadedUserId,
  ]);

  const addToCart = (
    product,
    selectedSize,
    selectedColor,
    quantity
  ) => {
    if (!isLoggedIn) {
      return;
    }

    const cartItem = {
      ...product,

      selectedSize,
      selectedColor,
      quantity,

      cartId:
        `${product.id}-${selectedSize}-${selectedColor}`,
    };

    setCartItems((currentItems) => {
      const existingItem =
        currentItems.find(
          (item) =>
            item.cartId ===
            cartItem.cartId
        );

      if (existingItem) {
        return currentItems.map(
          (item) =>
            item.cartId ===
            cartItem.cartId
              ? {
                  ...item,
                  quantity:
                    item.quantity +
                    quantity,
                }
              : item
        );
      }

      return [
        ...currentItems,
        cartItem,
      ];
    });
  };

  const updateQuantity = (
    cartId,
    newQuantity
  ) => {
    if (newQuantity < 1) {
      return;
    }

    setCartItems((currentItems) =>
      currentItems.map((item) =>
        item.cartId === cartId
          ? {
              ...item,
              quantity:
                newQuantity,
            }
          : item
      )
    );
  };

  const removeFromCart = (
    cartId
  ) => {
    setCartItems((currentItems) =>
      currentItems.filter(
        (item) =>
          item.cartId !== cartId
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
