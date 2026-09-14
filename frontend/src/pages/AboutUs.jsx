import "./AboutUs.css";

function AboutUs() {
  return (
    <main className="about-page">
      <section className="about-hero">
        <p className="about-small-title">OUR STORY</p>

        <h1>About Lana Wardrobe</h1>

        <p className="about-intro">
          Lana Wardrobe is built for people who want modern,
          comfortable and stylish fashion for everyday life.
          Our focus is simple — good designs, easy shopping
          and clothing made for today's youth.
        </p>
      </section>

      <section className="about-container">
        <div className="about-section">
          <div className="about-text">
            <p className="about-label">WHO WE ARE</p>

            <h2>Made for Youth. Made with Love.</h2>

            <p>
              Lana Wardrobe is a fashion brand focused on
              T-shirts and everyday clothing that combine
              comfort, simplicity and modern style.
            </p>

            <p>
              We want our customers to find clothing that
              feels easy to wear, looks good and fits naturally
              into their everyday lifestyle.
            </p>
          </div>

          <div className="about-highlight">
            <span>LANA</span>
            <strong>WARDROBE</strong>
            <p>Modern fashion for everyday expression.</p>
          </div>
        </div>

        <div className="about-values">
          <div className="about-value-card">
            <h3>Style</h3>
            <p>
              Clean and modern designs created for everyday
              fashion and self-expression.
            </p>
          </div>

          <div className="about-value-card">
            <h3>Comfort</h3>
            <p>
              Clothing should not only look good, but also
              feel comfortable throughout the day.
            </p>
          </div>

          <div className="about-value-card">
            <h3>Choice</h3>
            <p>
              From regular collections to customized and bulk
              T-shirt requirements, we aim to offer flexible
              options for different needs.
            </p>
          </div>
        </div>

        <div className="about-section about-section-reverse">
          <div className="about-text">
            <p className="about-label">CUSTOMIZATION</p>

            <h2>Your Ideas. Your T-Shirts.</h2>

            <p>
              Lana Wardrobe also supports customized T-shirt
              requirements for individuals, groups, businesses,
              events and organizations.
            </p>

            <p>
              Customers can submit their design requirements,
              preferred colours, sizes, quantities and print
              details directly through our website.
            </p>
          </div>

          <div className="about-highlight light">
            <span>CREATE</span>
            <strong>YOUR STYLE</strong>
            <p>Personalized fashion made around your idea.</p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AboutUs;