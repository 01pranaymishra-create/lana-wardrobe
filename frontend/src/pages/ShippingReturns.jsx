import "./ShippingReturns.css";

function ShippingReturns() {
  return (
    <main className="policy-page">

      <section className="policy-hero">
        <p className="policy-small-title">CUSTOMER CARE</p>

        <h1>Shipping & Returns</h1>

        <p>
          Information about delivery, order handling,
          returns and exchanges at Lana Wardrobe.
        </p>
      </section>

      <section className="policy-container">

        <div className="policy-card">
          <h2>Shipping</h2>

          <p>
            We aim to process and dispatch orders carefully
            and as quickly as possible.
          </p>

          <p>
            Shipping availability, estimated delivery time
            and applicable delivery charges may vary depending
            on the customer's location and order type.
          </p>

          <p>
            Final shipping information will be shown or
            communicated during the ordering process.
          </p>
        </div>

        <div className="policy-card">
          <h2>Order Processing</h2>

          <p>
            Orders are processed after the required order
            information has been successfully received.
          </p>

          <p>
            Customized and bulk orders may require additional
            confirmation before production or dispatch.
          </p>
        </div>

        <div className="policy-card">
          <h2>Returns & Exchanges</h2>

          <p>
            Return or exchange eligibility may depend on the
            type of product, condition of the item and the
            reason for the request.
          </p>

          <p>
            Products should be unused and returned in their
            original condition whenever a return or exchange
            is approved.
          </p>
        </div>

        <div className="policy-card">
          <h2>Customized Products</h2>

          <p>
            Customized or specially produced products may have
            different return or exchange conditions because
            they are created according to customer requirements.
          </p>

          <p>
            Customers are encouraged to carefully review their
            design, size, colour and quantity details before
            confirming a customized order.
          </p>
        </div>

        <div className="policy-card">
          <h2>Damaged or Incorrect Orders</h2>

          <p>
            If an order arrives damaged or an incorrect product
            is received, customers can contact us with the order
            details and relevant information so the issue can
            be reviewed.
          </p>
        </div>

        <div className="policy-card">
          <h2>Need Help?</h2>

          <p>
            For questions related to shipping, delivery,
            returns or exchanges, please contact us through
            our Contact Us page.
          </p>
        </div>

      </section>

    </main>
  );
}

export default ShippingReturns;
