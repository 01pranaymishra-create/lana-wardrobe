import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import { useAuth } from "./AuthContext";

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const {
    user,
    isLoggedIn,
    loading: authLoading,
  } = useAuth();

  const [wishlistItems, setWishlistItems] =
    useState([]);

  const [loadedUserId, setLoadedUserId] =
    useState(null);

  /*
    LOAD THE CORRECT USER'S WISHLIST
  */
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!isLoggedIn || !user?.id) {
      setWishlistItems([]);
      setLoadedUserId(null);
      return;
    }

    const storageKey =
      `lana_wishlist_${user.id}`;

    try {
      const savedWishlist =
        localStorage.getItem(storageKey);

      if (savedWishlist) {
        const parsedWishlist =
          JSON.parse(savedWishlist);

        setWishlistItems(
          Array.isArray(parsedWishlist)
            ? parsedWishlist
            : []
        );
      } else {
        setWishlistItems([]);
      }
    } catch (error) {
      console.error(
        "Failed to load wishlist:",
        error
      );

      setWishlistItems([]);
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
    SAVE CURRENT USER'S WISHLIST
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
      `lana_wishlist_${user.id}`;

    localStorage.setItem(
      storageKey,
      JSON.stringify(wishlistItems)
    );
  }, [
    wishlistItems,
    user?.id,
    isLoggedIn,
    loadedUserId,
  ]);

  const addToWishlist = (product) => {
    if (!isLoggedIn) {
      return;
    }

    setWishlistItems((currentItems) => {
      const alreadyExists =
        currentItems.some(
          (item) =>
            item.id === product.id
        );

      if (alreadyExists) {
        return currentItems;
      }

      return [
        ...currentItems,
        product,
      ];
    });
  };

  const removeFromWishlist = (
    productId
  ) => {
    setWishlistItems((currentItems) =>
      currentItems.filter(
        (item) =>
          item.id !== productId
      )
    );
  };

  const isInWishlist = (
    productId
  ) => {
    return wishlistItems.some(
      (item) =>
        item.id === productId
    );
  };

  const clearWishlist = () => {
    setWishlistItems([]);
  };

  return (
    <WishlistContext.Provider
      value={{
        wishlistItems,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
        clearWishlist,
      }}
    >
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  return useContext(WishlistContext);
}
