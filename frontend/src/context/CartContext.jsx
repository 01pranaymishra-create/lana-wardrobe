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

  /*
    ADD ITEM TO CART
  */
  const addToCart = (
    product,
    selectedSize,
    selectedColor,
    quantity
  ) => {
    if (!isLoggedIn) {
      return false;
    }

    const selectedColorData =
      product.colorStock?.find(
        (item) =>
          item.colorName.toLowerCase() ===
          selectedColor.toLowerCase()
      );

    const availableStock =
      Number(
        selectedColorData?.stockQuantity
      ) || 0;

    if (
      availableStock <= 0 ||
      quantity > availableStock
    ) {
      return false;
    }

    const cartId =
      `${product.id}-${selectedSize}-${selectedColor}`;

    const existingItem =
      cartItems.find(
        (item) =>
          item.cartId === cartId
      );

    const existingQuantity =
      Number(
        existingItem?.quantity || 0
      );

    if (
      existingQuantity + quantity >
      availableStock
    ) {
      return false;
    }

    const cartItem = {
      ...product,

      selectedSize,
      selectedColor,
      quantity,

      cartId,
    };

    setCartItems((currentItems) => {
      const currentExistingItem =
        currentItems.find(
          (item) =>
            item.cartId ===
            cartItem.cartId
        );

      if (currentExistingItem) {
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

    return true;
  };

  /*
    UPDATE ITEM QUANTITY
  */
const updateQuantity = (
  cartId,
  newQuantity,
  availableStockOverride = null
) => {
  if (newQuantity < 1) {
    return false;
  }

  const cartItem =
    cartItems.find(
      (item) =>
        item.cartId === cartId
    );

  if (!cartItem) {
    return false;
  }

  let availableStock;

  if (
    availableStockOverride !== null &&
    availableStockOverride !== undefined
  ) {
    availableStock =
      Number(availableStockOverride) || 0;
  } else {
    const selectedColorData =
      cartItem.colorStock?.find(
        (item) =>
          item.colorName.toLowerCase() ===
          cartItem.selectedColor.toLowerCase()
      );

    availableStock =
      Number(
        selectedColorData?.stockQuantity
      ) || 0;
  }

  if (
    availableStock <= 0 ||
    newQuantity > availableStock
  ) {
    return false;
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

  return true;
};

  /*
    REMOVE ITEM FROM CART
  */
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

  /*
    CLEAR CART
  */
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