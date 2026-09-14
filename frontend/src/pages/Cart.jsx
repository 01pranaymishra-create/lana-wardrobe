import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";

function Cart() {
  const {
    cartItems,
    updateQuantity,
    removeFromCart,
  } = useCart();

  const subtotal = cartItems.reduce(
    (total, item) =>
      total +
      (item.discountPrice || item.price) * item.quantity,
    0
  );

  return (
    <main className="cart-page">
      <section className="cart-header">
        <p>YOUR SELECTION</p>
        <h1>Shopping Cart</h1>
      </section>

      {cartItems.length === 0 ? (
        <section className="empty-cart">
          <h2>Your cart is empty</h2>

          <p>
            Explore our collection and find something you love.
          </p>

          <Link to="/shop" className="shop-button">
            CONTINUE SHOPPING →
          </Link>
        </section>
      ) : (
        <section className="cart-container">
          <div className="cart-items">
            {cartItems.map((item) => (
              <div
                className="cart-item"
                key={item.cartId}
              >
                <div className="cart-item-image">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                    />
                  ) : (
                    <span>PRODUCT IMAGE</span>
                  )}
                </div>

                <div className="cart-item-info">
                  <h3>{item.name}</h3>

                  <p>
                    Size: {item.selectedSize}
                  </p>

                  <p>
                    Color: {item.selectedColor}
                  </p>

                  <div className="cart-quantity">
                    <button
                      onClick={() =>
                        updateQuantity(
                          item.cartId,
                          item.quantity - 1
                        )
                      }
                    >
                      −
                    </button>

                    <span>{item.quantity}</span>

                    <button
                      onClick={() =>
                        updateQuantity(
                          item.cartId,
                          item.quantity + 1
                        )
                      }
                    >
                      +
                    </button>
                  </div>

                  <strong>
                    ₹
                    {(item.discountPrice || item.price) *
                      item.quantity}
                  </strong>

                  <button
                    className="remove-cart-item"
                    onClick={() =>
                      removeFromCart(item.cartId)
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <aside className="cart-summary">
            <h2>Order Summary</h2>

            <div className="summary-row">
              <span>Subtotal</span>
              <strong>₹{subtotal}</strong>
            </div>

            <p className="shipping-note">
              Shipping charges will be calculated at checkout.
            </p>

            <Link
                to="/checkout"
                className="checkout-button"
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