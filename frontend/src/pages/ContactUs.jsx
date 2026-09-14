import { useState } from "react";
import "./ContactUs.css";

function ContactUs() {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    subject: "",
    category: "",
    message: "",
  });

  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previousData) => ({
      ...previousData,
      [name]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      alert("Please enter your name.");
      return;
    }

    if (!formData.email.trim()) {
      alert("Please enter your email.");
      return;
    }

    if (!formData.message.trim()) {
      alert("Please enter your message.");
      return;
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        " https://lana-wardrobe-production.up.railway.app/api/contact-messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to send your message."
        );
      }

      alert("Your message has been sent successfully.");

      setFormData({
        name: "",
        phone: "",
        email: "",
        subject: "",
        category: "",
        message: "",
      });
    } catch (error) {
      console.error("Contact form error:", error);

      alert(
        error.message ||
          "Something went wrong while sending your message."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="contact-page">
      <section className="contact-container">

        <div className="contact-header">
          <p className="contact-small-title">
            GET IN TOUCH
          </p>

          <h1>Contact Us</h1>

          <p className="contact-description">
            Have a question about our products, your order,
            customization or bulk orders? Send us a message
            and our team will be happy to help.
          </p>
        </div>

        <div className="contact-content">

          {/* LEFT SIDE */}
          <div className="contact-info">
            <h2>We're Here to Help</h2>

            <p>
              Contact Lana Wardrobe for product questions,
              order support, customization enquiries,
              bulk orders, returns or general assistance.
            </p>

            <div className="contact-info-box">
              <h3>Customer Support</h3>

              <p>
                Send us your question using the form and
                our team will get back to you.
              </p>
            </div>

            <div className="contact-info-box">
              <h3>Customize & Bulk Orders</h3>

              <p>
                Need custom printed T-shirts or a large
                quantity order? Our team can help with your
                requirements.
              </p>
            </div>
          </div>

          {/* RIGHT SIDE FORM */}
          <form
            className="contact-form"
            onSubmit={handleSubmit}
          >
            <div className="contact-form-row">

              <div className="contact-field">
                <label htmlFor="name">
                  Name *
                </label>

                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your name"
                />
              </div>

              <div className="contact-field">
                <label htmlFor="phone">
                  Phone
                </label>

                <input
                  id="phone"
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Enter your phone number"
                />
              </div>

            </div>

            <div className="contact-field">
              <label htmlFor="email">
                Email *
              </label>

              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email address"
              />
            </div>

            <div className="contact-form-row">

              <div className="contact-field">
                <label htmlFor="category">
                  Enquiry Type
                </label>

                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                >
                  <option value="">
                    Select enquiry type
                  </option>

                  <option value="general">
                    General Enquiry
                  </option>

                  <option value="product">
                    Product Enquiry
                  </option>

                  <option value="order">
                    Order Support
                  </option>

                  <option value="customization">
                    Customization
                  </option>

                  <option value="bulk-order">
                    Bulk Order
                  </option>

                  <option value="return-refund">
                    Return / Refund
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

              <div className="contact-field">
                <label htmlFor="subject">
                  Subject
                </label>

                <input
                  id="subject"
                  type="text"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder="Enter subject"
                />
              </div>

            </div>

            <div className="contact-field">
              <label htmlFor="message">
                Message *
              </label>

              <textarea
                id="message"
                name="message"
                rows="7"
                value={formData.message}
                onChange={handleChange}
                placeholder="Tell us how we can help..."
              />
            </div>

            <button
              type="submit"
              className="contact-submit-button"
              disabled={submitting}
            >
              {submitting
                ? "Sending..."
                : "Send Message"}
            </button>

          </form>

        </div>
      </section>
    </main>
  );
}

export default ContactUs;