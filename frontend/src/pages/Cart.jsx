import { Link } from "react-router-dom";

import { useCart } from "../context/CartContext";
import { useProducts } from "../context/ProductContext";
const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://api.lanawardrobe.in";

const getImageUrl = (image) => {
  if (!image) {
    return "";
  }

  if (
    image.startsWith("http://") ||
    image.startsWith("https://") ||
    image.startsWith("data:")
  ) {
    return image;
  }

  return `${API_URL}${image.startsWith("/") ? "" : "/"}${image}`;
};

function Cart() {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
  } = useCart();

  const {
    products,
    loading: productsLoading,
    error: productsError,
  } = useProducts();

  /*
    GET CURRENT STOCK FOR THE
    EXACT COLOR SELECTED IN CART

    We use ProductContext instead of
    trusting the old cart snapshot.

    This also helps older carts that
    were saved before colorStock existed.
  */
  const getCurrentColorStock = (item) => {
    if (productsLoading) {
      return null;
    }

    const currentProduct =
      products.find(
        (product) =>
          Number(product.id) ===
          Number(item.id)
      );

    if (!currentProduct) {
      return 0;
    }

    const selectedColorData =
      currentProduct.colorStock?.find(
        (colorItem) =>
          colorItem.colorName.toLowerCase() ===
          String(
            item.selectedColor || ""
          ).toLowerCase()
      );

    return (
      Number(
        selectedColorData?.stockQuantity
      ) || 0
    );
  };

  /*
    CHECK WHETHER A CART ITEM
    CAN CURRENTLY BE PURCHASED
  */
  const isItemUnavailable = (item) => {
    const availableStock =
      getCurrentColorStock(item);

    if (availableStock === null) {
      return false;
    }

    return (
      availableStock <= 0 ||
      Number(item.quantity) >
        availableStock
    );
  };

  /*
    BLOCK CHECKOUT IF ANY ITEM
    IS OUT OF STOCK OR QUANTITY
    IS NO LONGER AVAILABLE
  */
  const hasUnavailableItems =
    !productsLoading &&
    cartItems.some(
      (item) =>
        isItemUnavailable(item)
    );

  const subtotal = cartItems.reduce(
    (total, item) =>
      total +
      (item.discountPrice ||
        item.price) *
        item.quantity,
    0
  );

  const handleIncreaseQuantity = (
    item
  ) => {
    const availableStock =
      getCurrentColorStock(item);

    if (
      availableStock === null
    ) {
      return;
    }

    if (availableStock <= 0) {
      alert(
        "This color is currently out of stock."
      );

      return;
    }

    const updated =
      updateQuantity(
        item.cartId,
        item.quantity + 1,
        availableStock
      );

    if (!updated) {
      alert(
        "Requested quantity is not available for this color."
      );
    }
  };

  const handleDecreaseQuantity = (
    item
  ) => {
    if (item.quantity <= 1) {
      return;
    }

    const availableStock =
      getCurrentColorStock(item);

    /*
      Allow decreasing even when the
      stored quantity is currently above
      available stock.

      Once the quantity reaches an
      available amount, normal stock
      validation takes over.
    */
    if (
      availableStock !== null &&
      availableStock > 0 &&
      item.quantity - 1 <=
        availableStock
    ) {
      updateQuantity(
        item.cartId,
        item.quantity - 1,
        availableStock
      );

      return;
    }

    /*
      If current stock is lower than the
      cart quantity, use the current cart
      quantity as the temporary upper
      limit so the customer can reduce it.
    */
    updateQuantity(
      item.cartId,
      item.quantity - 1,
      Math.max(
        item.quantity - 1,
        availableStock || 0
      )
    );
  };

  const handleCheckoutClick = (
    event
  ) => {
    if (productsLoading) {
      event.preventDefault();

      alert(
        "Please wait while product availability is checked."
      );

      return;
    }

    if (productsError) {
      event.preventDefault();

      alert(
        "Unable to verify product availability right now. Please try again."
      );

      return;
    }

    if (hasUnavailableItems) {
      event.preventDefault();

      alert(
        "Some items in your cart are unavailable or exceed the available quantity. Please update your cart before checkout."
      );
    }
  };

  return (
    <main className="cart-page">
      <section className="cart-header">
        <p>YOUR SELECTION</p>

        <h1>Shopping Cart</h1>
      </section>

      {cartItems.length === 0 ? (
        <section className="empty-cart">
          <h2>
            Your cart is empty
          </h2>

          <p>
            Explore our collection and
            find something you love.
          </p>

          <Link
            to="/shop"
            className="shop-button"
          >
            CONTINUE SHOPPING →
          </Link>
        </section>
      ) : (
        <section className="cart-container">
          <div className="cart-items">

            {cartItems.map((item) => {
              const availableStock =
                getCurrentColorStock(
                  item
                );

              const itemUnavailable =
                availableStock !== null &&
                (
                  availableStock <= 0 ||
                  Number(
                    item.quantity
                  ) >
                    availableStock
                );
                const currentProduct =
                  products.find(
                    (product) =>
                      Number(product.id) ===
                      Number(item.id)
                  );

                const imageUrl = getImageUrl(
                  item.image_url ||
                  item.imageUrl ||
                  item.image ||
                  currentProduct?.imageUrl ||
                  currentProduct?.image_url
                );

              return (
                <div
                  className="cart-item"
                  key={item.cartId}
                >
                  <div className="cart-item-image">

                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={item.name}
                      />
                    ) : (
                      <span>
                        PRODUCT IMAGE
                      </span>
                    )}

                  </div>

                  <div className="cart-item-info">
                    <h3>
                      {item.name}
                    </h3>

                    <p>
                      Size:{" "}
                      {item.selectedSize}
                    </p>

                    <p>
                      Color:{" "}
                      {item.selectedColor}
                    </p>

                    {productsLoading ? (
                      <p className="product-stock">
                        Checking availability...
                      </p>
                    ) : itemUnavailable ? (
                      <p
                        className="product-stock"
                        style={{
                          color: "red",
                          fontWeight: "600",
                        }}
                      >
                        {availableStock <=
                        0
                          ? "Out of Stock"
                          : "Selected quantity is unavailable"}
                      </p>
                    ) : (
                      <p
                        className="product-stock"
                        style={{
                          color: "green",
                          fontWeight: "600",
                        }}
                      >
                        In Stock
                      </p>
                    )}

                    <div className="cart-quantity">

                      <button
                        type="button"
                        onClick={() =>
                          handleDecreaseQuantity(
                            item
                          )
                        }
                        disabled={
                          item.quantity <= 1
                        }
                      >
                        −
                      </button>

                      <span>
                        {item.quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          handleIncreaseQuantity(
                            item
                          )
                        }
                        disabled={
                          productsLoading ||
                          availableStock ===
                            null ||
                          availableStock <=
                            0 ||
                          item.quantity >=
                            availableStock
                        }
                      >
                        +
                      </button>

                    </div>

                    <strong>
                      ₹
                      {(item.discountPrice ||
                        item.price) *
                        item.quantity}
                    </strong>

                    <button
                      type="button"
                      className="remove-cart-item"
                      onClick={() =>
                        removeFromCart(
                          item.cartId
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}

          </div>

          <aside className="cart-summary">
            <h2>
              Order Summary
            </h2>

            <div className="summary-row">
              <span>
                Subtotal
              </span>

              <strong>
                ₹{subtotal}
              </strong>
            </div>

            <div className="summary-row">
              <span>
                Shipping
              </span>

              <strong>
                FREE
              </strong>
            </div>

            <Link
              to="/checkout"
              className="checkout-button"
              onClick={
                handleCheckoutClick
              }
              aria-disabled={
                productsLoading ||
                Boolean(
                  productsError
                ) ||
                hasUnavailableItems
              }
            >
              PROCEED TO CHECKOUT
            </Link>

            <Link
              to="/shop"
              className="continue-shopping"
            >
              Continue Shopping
            </Link>
          </aside>
        </section>
      )}
    </main>
  );
}

export default Cart;