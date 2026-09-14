function buildEkartShipmentPayload({
  order,
  items,
}) {
  if (!order) {
    throw new Error(
      "Order data is required."
    );
  }

  if (!items || items.length === 0) {
    throw new Error(
      "Order items are required."
    );
  }

  const gstin =
    process.env.STORE_GSTIN;

  if (!gstin) {
    throw new Error(
      "STORE_GSTIN is missing in .env."
    );
  }

  const totalQuantity =
    items.reduce(
      (sum, item) =>
        sum +
        Number(item.quantity || 0),
      0
    );

  const productDescription =
    items
      .map(
        (item) =>
          `${item.product_name} x${item.quantity}`
      )
      .join(", ");

  const totalAmount =
    Number(order.total_amount);

  const shippingCharge =
    Number(
      order.shipping_charge || 0
    );

  const gstRate =
  Number(
    process.env.DEFAULT_GST_RATE || 5
  );

const gstMultiplier =
  1 + gstRate / 100;

const taxableAmount =
  Number(
    (
      totalAmount /
      gstMultiplier
    ).toFixed(2)
  );

const taxValue =
  Number(
    (
      totalAmount -
      taxableAmount
    ).toFixed(2)
  );

  const paymentMode =
    order.payment_method === "cod"
      ? "COD"
      : "Prepaid";

  const codAmount =
    paymentMode === "COD"
      ? totalAmount
      : 0;

const itemWeight =
  Number(
    process.env.DEFAULT_ITEM_WEIGHT ||
      250
  );

const weight =
  Math.max(
    Math.ceil(
      itemWeight * totalQuantity
    ),
    1
  );

  const length =
    Number(
      process.env.DEFAULT_PACKAGE_LENGTH ||
        25
    );

  const width =
    Number(
      process.env.DEFAULT_PACKAGE_WIDTH ||
        20
    );

  const height =
    Number(
      process.env.DEFAULT_PACKAGE_HEIGHT ||
        5
    );

  const invoiceNumber =
    `LW-${order.id}`;

  const invoiceDate =
    new Date().toISOString().split("T")[0];

  return {
    seller_name:
      process.env.STORE_NAME ||
      "Lana Wardrobe",

    seller_address:
      process.env.STORE_BILLING_ADDRESS ||
      "",

    seller_gst_tin:
      gstin,

    seller_gst_amount:
      0,

    consignee_gst_amount:
      0,

    integrated_gst_amount:
      0,

    order_number:
      String(order.id),

    invoice_number:
      invoiceNumber,

    invoice_date:
      invoiceDate,

    consignee_name:
      order.full_name,

   consignee_alternate_phone:
  "",

    payment_mode:
      paymentMode,

    category_of_goods:
      "Apparel",

    products_desc:
      productDescription,

    total_amount:
      totalAmount,

    cod_amount:
      codAmount,

    taxable_amount:
  taxableAmount,

tax_value:
  taxValue,

commodity_value:
  String(taxableAmount),

    quantity:
      totalQuantity,

    weight,
    length,
    width,
    height,

    return_reason:
      "",

    drop_location: {
      name:
        order.full_name,

      address:
        order.address,

      city:
        order.city,

      state:
        order.state,

      country:
        "India",

      phone:
        Number(order.phone),

      pin:
        Number(order.pincode),
    },
  };
}

module.exports = {
  buildEkartShipmentPayload,
};
