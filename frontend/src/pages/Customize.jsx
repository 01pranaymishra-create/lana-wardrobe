import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Customize() {
    const navigate = useNavigate();

  const {
    isLoggedIn,
  } = useAuth();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    tshirtType: "",
    color: "#000000",
    colorName: "",
    printPosition: "",
    notes: "",
  });

  const [sizeQuantities, setSizeQuantities] = useState({
    XS: 0,
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    XXL: 0,
    "3XL": 0,
  });

  const [designFile, setDesignFile] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSizeQuantityChange = (size, value) => {
    const quantity = Math.max(0, Number(value));

    setSizeQuantities((current) => ({
      ...current,
      [size]: quantity,
    }));
  };

  const totalQuantity = Object.values(sizeQuantities).reduce(
    (total, quantity) => total + quantity,
    0
  );

const handleSubmit = async (event) => {
  event.preventDefault();
     if (!isLoggedIn) {
    navigate("/login", {
      state: {
        from: "/customize",
      },
    });

    return;
  }
  if (!formData.name.trim()) {
    alert("Please enter your name.");
    return;
  }

  if (!formData.phone.trim()) {
    alert("Please enter your phone number.");
    return;
  }

  if (!formData.tshirtType) {
    alert("Please select a T-shirt type.");
    return;
  }

  if (totalQuantity < 1) {
    alert("Please enter quantity for at least one size.");
    return;
  }

  if (!formData.printPosition) {
    alert("Please select a print position.");
    return;
  }

  try {
    const requestData = new FormData();

    requestData.append("name", formData.name);
    requestData.append("phone", formData.phone);
    requestData.append("email", formData.email);
    requestData.append("tshirtType", formData.tshirtType);
    requestData.append("color", formData.color);
    requestData.append("colorName", formData.colorName);

    requestData.append(
      "sizeQuantities",
      JSON.stringify(sizeQuantities)
    );

    requestData.append(
      "totalQuantity",
      totalQuantity.toString()
    );

    requestData.append(
      "printPosition",
      formData.printPosition
    );

    requestData.append("notes", formData.notes);

    if (designFile) {
      requestData.append(
        "designFile",
        designFile
      );
    }

    const response = await fetch(
      " https://lana-wardrobe-production.up.railway.app/api/customization-requests",
      {
        method: "POST",
        body: requestData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to submit customization request."
      );
    }

    alert(
      "Your customization request has been submitted successfully."
    );

    console.log(
      "Saved Customization Request:",
      data.request
    );
  } catch (error) {
    console.error(
      "Customization submission error:",
      error
    );

    alert(
      error.message ||
        "Something went wrong while submitting your request."
    );
  }
};

  return (
    <main className="customize-page">

      <section className="customize-header">
        <p>LANA WARDROBE</p>

        <h1>Customize Your T-Shirt</h1>

        <p>
          Tell us what you need, choose your preferred colour,
          select quantities for each size and upload your design.
        </p>
      </section>

      <section className="customize-container">

        <form
          className="customize-form"
          onSubmit={handleSubmit}
        >

          {/* CUSTOMER DETAILS */}

          <div className="customize-form-section">
            <h2>Your Details</h2>

            <div className="customize-form-grid">

              <div className="customize-field">
                <label>Full Name *</label>

                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                />
              </div>

              <div className="customize-field">
                <label>Phone Number *</label>

                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Your phone number"
                />
              </div>

              <div className="customize-field full-width">
                <label>Email Address</label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Your email address"
                />
              </div>

            </div>
          </div>

          {/* T-SHIRT TYPE */}

          <div className="customize-form-section">
            <h2>T-Shirt Requirements</h2>

            <div className="customize-form-grid">

              <div className="customize-field full-width">
                <label>T-Shirt Type *</label>

                <select
                  name="tshirtType"
                  value={formData.tshirtType}
                  onChange={handleChange}
                >
                  <option value="">
                    Select T-shirt type
                  </option>

                  <option value="round-neck">
                    Round Neck
                  </option>

                  <option value="oversized">
                    Oversized
                  </option>

                  <option value="polo">
                    Polo T-Shirt
                  </option>

                  <option value="sports">
                    Sports T-Shirt
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

            </div>
          </div>

          {/* COLOR PICKER */}

          <div className="customize-form-section">
            <h2>Choose T-Shirt Colour</h2>

            <p className="customize-section-description">
              Click the colour box to choose any shade you want.
            </p>

        <div className="color-selection-row">

  <div className="custom-color-picker">

    <input
      type="color"
      name="color"
      value={formData.color}
      onChange={handleChange}
      className="color-picker-input"
    />

    <div className="selected-color-info">

      <div
        className="selected-color-preview"
        style={{
          backgroundColor: formData.color,
        }}
      />

      <div>
        <span>Selected Colour</span>

        <strong>
          {formData.color.toUpperCase()}
        </strong>
      </div>

    </div>

  </div>

  <div className="color-name-field">
    <label>Or Enter Colour Name</label>

    <input
      type="text"
      name="colorName"
      value={formData.colorName}
      onChange={handleChange}
      placeholder="e.g. Royal Blue, Cream, Maroon"
    />
  </div>

</div>
          </div>

          {/* SIZE-WISE QUANTITY */}

          <div className="customize-form-section">
            <h2>Size-Wise Quantity</h2>

            <p className="customize-section-description">
              Enter the number of T-shirts you need for each size.
              Leave unused sizes as 0.
            </p>

            <div className="size-quantity-grid">

              {Object.keys(sizeQuantities).map((size) => (
                <div
                  className="size-quantity-item"
                  key={size}
                >

                  <label>{size}</label>

                  <input
                    type="number"
                    min="0"
                    value={sizeQuantities[size]}
                    onChange={(event) =>
                      handleSizeQuantityChange(
                        size,
                        event.target.value
                      )
                    }
                  />

                </div>
              ))}

            </div>

            <div className="total-quantity-box">
              <span>Total Quantity</span>

              <strong>
                {totalQuantity}{" "}
                {totalQuantity === 1 ? "Piece" : "Pieces"}
              </strong>
            </div>
          </div>

          {/* PRINT POSITION */}

          <div className="customize-form-section">
            <h2>Printing Details</h2>

            <div className="customize-field">

              <label>Print Position *</label>

              <select
                name="printPosition"
                value={formData.printPosition}
                onChange={handleChange}
              >
                <option value="">
                  Select print position
                </option>

                <option value="left-chest">
                  Left Chest
                </option>

                <option value="right-chest">
                  Right Chest
                </option>

                <option value="front-center">
                  Front Center
                </option>

                <option value="full-front">
                  Full Front
                </option>

                <option value="back-center">
                  Back Center
                </option>

                <option value="full-back">
                  Full Back
                </option>

                <option value="left-sleeve">
                  Left Sleeve
                </option>

                <option value="right-sleeve">
                  Right Sleeve
                </option>

                <option value="other">
                  Other
                </option>
              </select>

            </div>
          </div>

          {/* DESIGN UPLOAD */}

          <div className="customize-form-section">
            <h2>Upload Your Design</h2>

            <div className="customize-field">

              <label>Logo / Artwork</label>

              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={(event) =>
                  setDesignFile(
                    event.target.files[0] || null
                  )
                }
              />

              <small>
                Accepted formats: PNG, JPG, JPEG and PDF.
              </small>

              {designFile && (
                <p className="selected-file">
                  Selected: {designFile.name}
                </p>
              )}

            </div>
          </div>

          {/* NOTES */}

          <div className="customize-form-section">
            <h2>Additional Notes</h2>

            <div className="customize-field">

              <textarea
                name="notes"
                rows="6"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Describe your design, printing requirement, preferred fabric, deadline or anything else..."
              />

            </div>
          </div>

          <button
            type="submit"
            className="customize-submit"
          >
            REQUEST CUSTOMIZATION →
          </button>

        </form>

      </section>

    </main>
  );
}

export default Customize;