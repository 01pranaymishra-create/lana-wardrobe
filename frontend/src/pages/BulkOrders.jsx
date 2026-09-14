import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
function BulkOrders() {
const navigate = useNavigate();

  const {
    isLoggedIn,
  } = useAuth();

  const [formData, setFormData] = useState({
    organizationName: "",
    contactPerson: "",
    phone: "",
    email: "",
    gstNumber: "",
    tshirtType: "",
    fabric: "",
    color: "#000000",
    colorName: "",
    printPosition: "",
    printingRequirement: "",
    requiredDate: "",
    deliveryCity: "",
    deliveryAddress: "",
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
        from: "/bulk-orders",
      },
    });

    return;
  }

  if (!formData.organizationName.trim()) {
    alert("Please enter organization or company name.");
    return;
  }

  if (!formData.contactPerson.trim()) {
    alert("Please enter contact person name.");
    return;
  }

  if (!formData.phone.trim()) {
    alert("Please enter phone number.");
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

    requestData.append(
      "organizationName",
      formData.organizationName
    );

    requestData.append(
      "contactPerson",
      formData.contactPerson
    );

    requestData.append(
      "phone",
      formData.phone
    );

    requestData.append(
      "email",
      formData.email
    );

    requestData.append(
      "gstNumber",
      formData.gstNumber
    );

    requestData.append(
      "tshirtType",
      formData.tshirtType
    );

    requestData.append(
      "fabric",
      formData.fabric
    );

    requestData.append(
      "color",
      formData.color
    );

    requestData.append(
      "colorName",
      formData.colorName
    );

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

    requestData.append(
      "printingRequirement",
      formData.printingRequirement
    );

    requestData.append(
      "requiredDate",
      formData.requiredDate
    );

    requestData.append(
      "deliveryCity",
      formData.deliveryCity
    );

    requestData.append(
      "deliveryAddress",
      formData.deliveryAddress
    );

    requestData.append(
      "notes",
      formData.notes
    );

    if (designFile) {
      requestData.append(
        "designFile",
        designFile
      );
    }

    const response = await fetch(
      "http://localhost:5000/api/bulk-order-requests",
      {
        method: "POST",
        body: requestData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          "Failed to submit bulk order request."
      );
    }

    alert(
      "Your bulk order request has been submitted successfully."
    );

    console.log(
      "Saved Bulk Order Request:",
      data.request
    );
  } catch (error) {
    console.error(
      "Bulk order submission error:",
      error
    );

    alert(
      error.message ||
        "Something went wrong while submitting your bulk order request."
    );
  }
};

  return (
    <main className="customize-page">
      <section className="customize-header">
        <p>LANA WARDROBE</p>

        <h1>Bulk Orders</h1>

        <p>
          Place a custom bulk T-shirt request for your company,
          event, team, college, organization or business.
        </p>
      </section>

      <section className="customize-container">
        <form
          className="customize-form"
          onSubmit={handleSubmit}
        >

          <div className="customize-form-section">
            <h2>Organization Details</h2>

            <div className="customize-form-grid">

              <div className="customize-field">
                <label>Organization / Company Name *</label>

                <input
                  type="text"
                  name="organizationName"
                  value={formData.organizationName}
                  onChange={handleChange}
                  placeholder="Company, college, team, event name..."
                />
              </div>

              <div className="customize-field">
                <label>Contact Person *</label>

                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson}
                  onChange={handleChange}
                  placeholder="Contact person name"
                />
              </div>

              <div className="customize-field">
                <label>Phone Number *</label>

                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="Phone number"
                />
              </div>

              <div className="customize-field">
                <label>Email Address</label>

                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email address"
                />
              </div>

              <div className="customize-field full-width">
                <label>GST Number</label>

                <input
                  type="text"
                  name="gstNumber"
                  value={formData.gstNumber}
                  onChange={handleChange}
                  placeholder="Optional GST number"
                />
              </div>

            </div>
          </div>

          <div className="customize-form-section">
            <h2>T-Shirt Requirements</h2>

            <div className="customize-form-grid">

              <div className="customize-field">
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

              <div className="customize-field">
                <label>Fabric / Material</label>

                <select
                  name="fabric"
                  value={formData.fabric}
                  onChange={handleChange}
                >
                  <option value="">
                    Select fabric
                  </option>

                  <option value="cotton">
                    Cotton
                  </option>

                  <option value="polyester">
                    Polyester
                  </option>

                  <option value="cotton-blend">
                    Cotton Blend
                  </option>

                  <option value="dry-fit">
                    Dry Fit
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

            </div>
          </div>

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

          <div className="customize-form-section">
            <h2>Size-Wise Quantity</h2>

            <p className="customize-section-description">
              Enter the required number of pieces for each size.
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

          <div className="customize-form-section">
            <h2>Printing Requirements</h2>

            <div className="customize-form-grid">

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

                  <option value="multiple">
                    Multiple Positions
                  </option>

                  <option value="other">
                    Other
                  </option>
                </select>
              </div>

              <div className="customize-field">
                <label>Printing Requirement</label>

                <input
                  type="text"
                  name="printingRequirement"
                  value={formData.printingRequirement}
                  onChange={handleChange}
                  placeholder="e.g. logo front, name on back"
                />
              </div>

            </div>
          </div>

          <div className="customize-form-section">
            <h2>Upload Logo / Design</h2>

            <div className="customize-field">

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

          <div className="customize-form-section">
            <h2>Delivery Details</h2>

            <div className="customize-form-grid">

              <div className="customize-field">
                <label>Required Delivery Date</label>

                <input
                  type="date"
                  name="requiredDate"
                  value={formData.requiredDate}
                  onChange={handleChange}
                />
              </div>

              <div className="customize-field">
                <label>Delivery City</label>

                <input
                  type="text"
                  name="deliveryCity"
                  value={formData.deliveryCity}
                  onChange={handleChange}
                  placeholder="City"
                />
              </div>

              <div className="customize-field full-width">
                <label>Delivery Address</label>

                <textarea
                  name="deliveryAddress"
                  rows="4"
                  value={formData.deliveryAddress}
                  onChange={handleChange}
                  placeholder="Full delivery address"
                />
              </div>

            </div>
          </div>

          <div className="customize-form-section">
            <h2>Special Instructions</h2>

            <div className="customize-field">

              <textarea
                name="notes"
                rows="6"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Tell us anything else about your bulk order..."
              />

            </div>
          </div>

          <button
            type="submit"
            className="customize-submit"
          >
            REQUEST BULK QUOTATION →
          </button>

        </form>
      </section>
    </main>
  );
}

export default BulkOrders;