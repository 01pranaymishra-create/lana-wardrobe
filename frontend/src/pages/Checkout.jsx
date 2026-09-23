import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useCart } from "../context/CartContext";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    const existingScript =
      document.querySelector(
        'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
      );

    if (existingScript) {
      resolve(true);
      return;
    }

    const script =
      document.createElement("script");

    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () =>
      resolve(true);

    script.onerror = () =>
      resolve(false);

    document.body.appendChild(
      script
    );
  });
}

function Checkout() {
  const {
  cartItems,
  clearCart,
} = useCart();

const location = useLocation();

const buyNowItem =
  location.state?.buyNowItem || null;

const checkoutItems =
  buyNowItem
    ? [buyNowItem]
    : cartItems;

  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    note: "",
  });

  const [paymentMethod, setPaymentMethod] =
  useState("online");

 const subtotal = checkoutItems.reduce(
    (total, item) =>
      total +
      (item.discountPrice || item.price) * item.quantity,
    0
  );

const shipping = 0;
const total = subtotal;

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();

  if (checkoutItems.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  const token =
    localStorage.getItem("lana_token");

  if (!token) {
    alert("Please login again.");
    return;
  }

  try {
    // =========================
    // CREATE LANA ORDER
    // =========================

    const response = await fetch(
      "https://api.lanawardrobe.in/api/orders",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${token}`,
        },

        body: JSON.stringify({
          fullName:
            formData.fullName,

          phone:
            formData.phone,

          email:
            formData.email,

          address:
            formData.address,

          city:
            formData.city,

          state:
            formData.state,

          pincode:
            formData.pincode,

          note:
            formData.note,

          paymentMethod,

          items: checkoutItems.map(
            (item) => ({
              productId:
                item.id,

              selectedSize:
                item.selectedSize,

              selectedColor:
                item.selectedColor,

              quantity:
                item.quantity,
            })
          ),
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      alert(
        data.message ||
          "Failed to create order."
      );

      return;
    }

    const lanaOrder =
      data.order;

    // =========================
    // CASH ON DELIVERY
    // =========================

    if (paymentMethod === "cod") {
    if (!buyNowItem) {
      clearCart();
    }
      alert(
        `Order #${lanaOrder.id} placed successfully with Cash on Delivery.`
      );

      return;
    }

    // =========================
    // ONLINE PAYMENT
    // =========================

    const razorpayLoaded =
      await loadRazorpayScript();

    if (!razorpayLoaded) {
      alert(
        "Razorpay could not be loaded. Please check your internet connection."
      );

      return;
    }

    // Create Razorpay order

    const razorpayResponse =
      await fetch(
        "https://api.lanawardrobe.in/api/payments/create-razorpay-order",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            orderId:
              lanaOrder.id,
          }),
        }
      );

    const razorpayData =
      await razorpayResponse.json();

    if (!razorpayResponse.ok) {
      alert(
        razorpayData.message ||
          "Failed to start payment."
      );

      return;
    }

    // =========================
    // OPEN RAZORPAY
    // =========================

    const options = {
      key:
        razorpayData.keyId,

      amount:
        razorpayData
          .razorpayOrder
          .amount,

      currency:
        razorpayData
          .razorpayOrder
          .currency,

      name:
        "Lana Wardrobe",

      description:
        `Order #${lanaOrder.id}`,

      order_id:
        razorpayData
          .razorpayOrder
          .id,

      prefill: {
        name:
          formData.fullName,

        email:
          formData.email,

        contact:
          formData.phone,
      },

      theme: {},

      handler: async (
        paymentResponse
      ) => {
        try {
          const verifyResponse =
            await fetch(
              "https://api.lanawardrobe.in/api/payments/verify-razorpay-payment",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  Authorization:
                    `Bearer ${token}`,
                },

                body:
                  JSON.stringify({
                    orderId:
                      lanaOrder.id,

                    razorpay_order_id:
                      paymentResponse
                        .razorpay_order_id,

                    razorpay_payment_id:
                      paymentResponse
                        .razorpay_payment_id,

                    razorpay_signature:
                      paymentResponse
                        .razorpay_signature,
                  }),
              }
            );

          const verifyData =
            await verifyResponse.json();

          if (!verifyResponse.ok) {
            alert(
              verifyData.message ||
                "Payment verification failed."
            );

            return;
          }

          if (!buyNowItem) {
            clearCart();
          }

          alert(
            `Payment successful! Order #${lanaOrder.id} confirmed.`
          );

        } catch (error) {
          console.error(
            "Payment verification error:",
            error
          );

          alert(
            "Payment completed, but verification could not be completed. Please contact support."
          );
        }
      },
    };

    const razorpayCheckout =
      new window.Razorpay(
        options
      );

    razorpayCheckout.on(
      "payment.failed",
      function (response) {
        console.error(
          "Razorpay payment failed:",
          response.error
        );

        alert(
          "Payment failed or was cancelled. Your order has not been marked as paid."
        );
      }
    );

    razorpayCheckout.open();

  } catch (error) {
    console.error(
      "Checkout error:",
      error
    );

    alert(
      "Unable to process checkout."
    );
  }
};
  return (
    <main className="checkout-page">
      <section className="checkout-header">
        <p>SECURE CHECKOUT</p>
        <h1>Checkout</h1>
        <p>
          Enter your delivery details and review your order.
        </p>
      </section>

      <section className="checkout-container">
        <form
          className="checkout-form"
          onSubmit={handleSubmit}
        >
          <h2>Shipping Details</h2>

          <div className="checkout-form-grid">
            <div className="checkout-field">
              <label>Full Name</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                required
              />
            </div>

            <div className="checkout-field">
              <label>Phone Number</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            <div className="checkout-field full-width">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="checkout-field full-width">
              <label>Address</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="4"
                required
              />
            </div>

            <div className="checkout-field">
              <label>City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={handleChange}
                required
              />
            </div>

            <div className="checkout-field">
              <label>State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={handleChange}
                required
              />
            </div>

            <div className="checkout-field">
              <label>PIN Code</label>
              <input
                type="text"
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                required
              />
            </div>
<div className="checkout-field full-width">
  <label>Payment Method</label>

  <div className="payment-methods">
    <label className="payment-option">
      <input
        type="radio"
        name="paymentMethod"
        value="online"
        checked={paymentMethod === "online"}
        onChange={(e) =>
          setPaymentMethod(e.target.value)
        }
      />

      <span>
        Pay Online with Razorpay
      </span>
    </label>

    <label className="payment-option">
      <input
        type="radio"
        name="paymentMethod"
        value="cod"
        checked={paymentMethod === "cod"}
        onChange={(e) =>
          setPaymentMethod(e.target.value)
        }
      />

      <span>
        Cash on Delivery
      </span>
    </label>
  </div>
</div>
          </div>

          <button
  type="submit"
  className="place-order-button"
>
  {paymentMethod === "online"
    ? `PAY ₹${total}`
    : "PLACE COD ORDER"}
</button>
        </form>

        <aside className="checkout-summary">
          <h2>Your Order</h2>

          <div className="checkout-items">
              {checkoutItems.map((item) => (
              <div
                className="checkout-item"
                key={item.cartId}
              >
                <div>
                  <strong>{item.name}</strong>

                  <p>
                    {item.selectedSize} / {item.selectedColor}
                  </p>

                  <p>Qty: {item.quantity}</p>
                </div>

                <strong>
                  ₹
                  {(item.discountPrice || item.price) *
                    item.quantity}
                </strong>
              </div>
            ))}
          </div>

          <div className="checkout-total-row">
            <span>Subtotal</span>
            <span>₹{subtotal}</span>
          </div>

          <div className="checkout-total-row">
            <span>Shipping</span>
            <span>
              {shipping === 0 ? "FREE" : `₹${shipping}`}
            </span>
          </div>

          <div className="checkout-total-row checkout-grand-total">
            <strong>Total</strong>
            <strong>₹{total}</strong>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default Checkout;