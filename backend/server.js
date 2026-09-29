const multer = require("multer");
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { Resend } = require("resend");

const Razorpay = require("razorpay");
const crypto = require("crypto");
const { v2: cloudinary } = require("cloudinary");
require("dotenv").config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


const pool = require("./db");
const {
  sendPasswordResetOtpEmail,
} = require("./emailService");
const authenticateUser =
  require("./authMiddleware");
const requireAdmin =
  require("./adminMiddleware");
const {
  buildEkartShipmentPayload,
} = require("./services/ekartPayload");

const app = express();
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const adminNotificationEmails =
  (
    process.env.ADMIN_NOTIFICATION_EMAILS ||
    ""
  )
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

const sendAdminNotificationEmail =
  async ({
    subject,
    html,
  }) => {
    if (
      adminNotificationEmails.length === 0
    ) {
      console.warn(
        "ADMIN_NOTIFICATION_EMAILS is not configured."
      );

      return;
    }

    try {
      const { error } =
        await resend.emails.send({
          from:
            "Lana Wardrobe <no-reply@lanawardrobe.in>",
          to: adminNotificationEmails,
          subject,
          html,
        });

      if (error) {
        console.error(
          "Admin notification email error:",
          error
        );
      }
    } catch (error) {
      console.error(
        "Admin notification email exception:",
        error
      );
    }
  };

const PORT = process.env.PORT || 5000;

// =========================
// MIDDLEWARE
// =========================

app.use(cors());

// =========================
// RAZORPAY WEBHOOK
// MUST BE BEFORE express.json()
// =========================

app.post(
  "/api/payments/razorpay-webhook",
  express.raw({
    type: "application/json",
  }),
  async (req, res) => {
    try {
      const webhookSignature =
        req.headers["x-razorpay-signature"];

      if (!webhookSignature) {
        return res.status(400).send(
          "Missing Razorpay signature."
        );
      }

      const expectedSignature =
        crypto
          .createHmac(
            "sha256",
            process.env.RAZORPAY_WEBHOOK_SECRET
          )
          .update(req.body)
          .digest("hex");

      const expectedBuffer =
        Buffer.from(expectedSignature);

      const receivedBuffer =
        Buffer.from(webhookSignature);

      if (
        expectedBuffer.length !==
          receivedBuffer.length ||
        !crypto.timingSafeEqual(
          expectedBuffer,
          receivedBuffer
        )
      ) {
        console.error(
          "Invalid Razorpay webhook signature."
        );

        return res
          .status(400)
          .send("Invalid signature.");
      }

      const event =
        JSON.parse(
          req.body.toString("utf8")
        );

      console.log(
        "Razorpay webhook received:",
        event.event
      );

      // =========================
      // PAYMENT CAPTURED
      // =========================

        if (
  event.event ===
  "payment.captured"
) {
  const payment =
    event.payload?.payment?.entity;

  if (
    !payment?.id ||
    !payment?.order_id
  ) {
    return res
      .status(400)
      .send(
        "Invalid payment payload."
      );
  }

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    // Lock the Lana order so the expiry worker
    // and payment webhook cannot update it
    // at the same time.
    const orderResult =
      await client.query(
        `
        SELECT
          id,
          total_amount,
          payment_status,
          order_status,
          stock_restored
        FROM orders
        WHERE razorpay_order_id = $1
        FOR UPDATE
        `,
        [payment.order_id]
      );

    if (
      orderResult.rows.length === 0
    ) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "Webhook order not found:",
        payment.order_id
      );

      return res
        .status(200)
        .send("Order not found.");
    }

    const order =
      orderResult.rows[0];

    const expectedAmount =
      Math.round(
        Number(order.total_amount) *
          100
      );

    // Validate amount BEFORE changing
    // any Lana payment state.
    if (
      Number(payment.amount) !==
      expectedAmount
    ) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "Razorpay amount mismatch.",
        {
          orderId: order.id,
          expectedAmount,
          receivedAmount:
            payment.amount,
        }
      );

      return res
        .status(400)
        .send("Amount mismatch.");
    }

    // Validate currency BEFORE changing
    // any Lana payment state.
    if (
      payment.currency !== "INR"
    ) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "Unexpected Razorpay currency:",
        payment.currency
      );

      return res
        .status(400)
        .send("Currency mismatch.");
    }

    // ========================================
    // LATE PAYMENT FOR EXPIRED ORDER
    // ========================================

    if (
      order.order_status ===
        "cancelled" ||
      order.stock_restored
    ) {
      await client.query(
        `
        UPDATE orders
        SET
          razorpay_payment_id = $1,
          payment_status = 'paid',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
          payment.id,
          order.id,
        ]
      );

      await client.query(
        "COMMIT"
      );

      console.error(
        `CRITICAL: Razorpay captured payment for expired order #${order.id}. Manual review required.`
      );

      return res
        .status(200)
        .send(
          "Payment recorded for expired order; manual review required."
        );
    }

    // ========================================
    // NORMAL SUCCESSFUL PAYMENT
    // ========================================

    await client.query(
      `
      UPDATE orders
      SET
        razorpay_payment_id = $1,
        payment_status = 'paid',
        order_status = 'confirmed',
        updated_at =
          CURRENT_TIMESTAMP
      WHERE
        id = $2
        AND payment_status <> 'paid'
        AND order_status <> 'cancelled'
        AND stock_restored = FALSE
      `,
      [
        payment.id,
        order.id,
      ]
    );

    await client.query(
      "COMMIT"
    );

    console.log(
      `Order ${order.id} confirmed by Razorpay webhook.`
    );

  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {
      // Ignore rollback error
    }

    throw error;

  } finally {
    client.release();
  }
}

      // =========================
      // PAYMENT FAILED
      // =========================

      if (
        event.event ===
        "payment.failed"
      ) {
        const payment =
          event.payload?.payment?.entity;

        if (payment?.order_id) {
          await pool.query(
            `
            UPDATE orders
            SET
              payment_status = 'failed',
              updated_at = CURRENT_TIMESTAMP
            WHERE
              razorpay_order_id = $1
              AND payment_status <> 'paid'
            `,
            [payment.order_id]
          );

          console.log(
            "Razorpay payment failed:",
            payment.order_id
          );
        }
      }

      return res
        .status(200)
        .send("Webhook processed.");

    } catch (error) {
      console.error(
        "Razorpay webhook error:",
        error
      );

      return res
        .status(500)
        .send("Webhook processing failed.");
    }
  }
);


// =========================
// EKART DEBUG WEBHOOK
// TEMPORARY - NO DATABASE UPDATES
// MUST BE BEFORE express.json()
// =========================

app.post(
  "/api/webhooks/ekart",
  express.raw({
    type: "application/json",
    limit: "100kb",
  }),
  async (req, res) => {
    try {
      const rawBody =
        Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(
              req.body || ""
            );

      const rawText =
        rawBody.toString("utf8");
      const webhookSecret =
      process.env.EKART_WEBHOOK_SECRET;

      if (!webhookSecret) {
  console.error(
    "Missing EKART_WEBHOOK_SECRET."
  );

  return res.status(500).json({
    success: false,
    message:
      "Webhook secret is not configured.",
  });
}

const receivedHmac =
  req.headers["x-swift-webhook-hmac"];

if (
  !receivedHmac ||
  typeof receivedHmac !== "string"
) {
  console.error(
    "Missing Ekart webhook HMAC."
  );

  return res.status(401).json({
    success: false,
    message:
      "Missing webhook signature.",
  });
}

const normalizedHmac =
  receivedHmac.trim().toLowerCase();

if (
  !/^[a-f0-9]{64}$/.test(
    normalizedHmac
  )
) {
  console.error(
    "Invalid Ekart webhook HMAC format."
  );

  return res.status(401).json({
    success: false,
    message:
      "Invalid webhook signature.",
  });
}

const expectedHmac =
  crypto
    .createHmac(
      "sha256",
      webhookSecret
    )
    .update(rawBody)
    .digest("hex");

const receivedBuffer =
  Buffer.from(
    normalizedHmac,
    "hex"
  );

const expectedBuffer =
  Buffer.from(
    expectedHmac,
    "hex"
  );

if (
  receivedBuffer.length !==
    expectedBuffer.length ||
  !crypto.timingSafeEqual(
    receivedBuffer,
    expectedBuffer
  )
) {
  console.error(
    "Invalid Ekart webhook HMAC."
  );

  return res.status(401).json({
    success: false,
    message:
      "Invalid webhook signature.",
  });
}

console.log(
  "Ekart webhook HMAC verified."
);

      let payload = null;

      try {
        payload =
          JSON.parse(rawText);
      } catch {
        console.error(
          "Ekart debug webhook received invalid JSON."
        );
        
        return res.status(200).json({
          success: true,
          message:
            "Ekart debug webhook received.",
        });
      }

      const webhookTopic =
  req.headers["x-swift-webhook-topic"];

if (
  webhookTopic !== "track_updated"
) {
  console.log(
    "Ignoring unsupported Ekart webhook topic:",
    webhookTopic
  );

  return res.status(200).json({
    success: true,
    message:
      "Webhook topic ignored safely.",
  });
}

const webhookTrackingId =
  String(
    payload?.wbn ||
    payload?.id ||
    ""
  ).trim();

if (!webhookTrackingId) {
  console.error(
    "Ekart webhook has no tracking identifier."
  );

  return res.status(200).json({
    success: true,
    message:
      "Webhook received without tracking identifier.",
  });
}

const shipmentResult =
  await pool.query(
    `
    SELECT
      id,
      order_id,
      provider_shipment_id,
      awb_number,
      shipment_status
    FROM shipments
    WHERE
      awb_number = $1
      OR provider_shipment_id = $1
    LIMIT 1
    `,
    [webhookTrackingId]
  );

if (
  shipmentResult.rows.length === 0
) {
  console.warn(
    "Ekart webhook shipment not found:",
    webhookTrackingId
  );

  return res.status(200).json({
    success: true,
    message:
      "Webhook received; shipment not found locally.",
  });
}

const matchedShipment =
  shipmentResult.rows[0];

  const normalizedShipmentStatus =
  normalizeEkartStatus(
    payload?.status
  );

const updatedShipmentResult =
  await pool.query(
    `
    UPDATE shipments
    SET
      shipment_status = $1,
      updated_at =
        CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING
      id,
      order_id,
      shipment_status,
      updated_at
    `,
    [
      normalizedShipmentStatus,
      matchedShipment.id,
    ]
  );

console.log(
  "Ekart webhook updated shipment status:",
  {
    shipmentId:
      updatedShipmentResult.rows[0].id,
    orderId:
      updatedShipmentResult.rows[0].order_id,
    shipmentStatus:
      updatedShipmentResult.rows[0]
        .shipment_status,
  }
);

// ========================================
// SAFE LANA ORDER STATUS UPDATE
// ========================================

const mappedOrderStatus =
  mapEkartTrackingToOrderStatus({
    status: payload?.status,
  });

if (mappedOrderStatus) {
  const orderResult =
    await pool.query(
      `
      SELECT
        id,
        payment_method,
        payment_status,
        order_status,
        courier_name,
        tracking_number
      FROM orders
      WHERE id = $1
      `,
      [matchedShipment.order_id]
    );

  if (
    orderResult.rows.length === 0
  ) {
    console.error(
      "Ekart webhook order not found:",
      matchedShipment.order_id
    );
  } else {
    const order =
      orderResult.rows[0];

    const statusRank = {
      order_placed: 1,
      confirmed: 2,
      packed: 3,
      shipped: 4,
      out_for_delivery: 5,
      delivered: 6,
    };

    let shouldUpdateOrder = true;

    // Never change a cancelled or already
    // delivered Lana order automatically.
    if (
      order.order_status ===
        "cancelled" ||
      order.order_status ===
        "delivered"
    ) {
      shouldUpdateOrder = false;
    }

    // Prevent duplicate/backward movement.
    if (
      statusRank[
        order.order_status
      ] &&
      statusRank[
        mappedOrderStatus
      ] &&
      statusRank[
        mappedOrderStatus
      ] <=
        statusRank[
          order.order_status
        ]
    ) {
      shouldUpdateOrder = false;
    }

    // Shipping statuses require existing
    // courier + tracking information.
    if (
      shouldUpdateOrder &&
      (
        !order.courier_name ||
        !order.tracking_number
      )
    ) {
      shouldUpdateOrder = false;

      console.error(
        `Ekart webhook could not update order #${order.id}: courier/tracking information is missing.`
      );
    }

    if (shouldUpdateOrder) {
      let paymentStatus =
        order.payment_status;

      // COD becomes paid only once
      // Ekart confirms delivery.
      if (
        mappedOrderStatus ===
          "delivered" &&
        order.payment_method ===
          "cod"
      ) {
        paymentStatus = "paid";
      }

      await pool.query(
        `
        UPDATE orders
        SET
          order_status = $1,
          payment_status = $2,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = $3
        `,
        [
          mappedOrderStatus,
          paymentStatus,
          order.id,
        ]
      );

      console.log(
        "Ekart webhook updated Lana order:",
        {
          orderId:
            order.id,
          orderStatus:
            mappedOrderStatus,
          paymentStatus,
        }
      );
    }
  }
} else {
  console.log(
    "Ekart status does not change Lana order:",
    payload?.status || null
  );
}

console.log(
  "Ekart webhook matched Lana shipment:",
  {
    shipmentId:
      matchedShipment.id,
    orderId:
      matchedShipment.order_id,
    currentShipmentStatus:
      matchedShipment.shipment_status,
    ekartStatus:
      payload?.status || null,
  }
);


      // -------------------------
      // SAFE HEADER LOGGING
      // -------------------------


      // -------------------------
      // LOG ONLY TRACKING FIELDS
      // -------------------------

      console.log(
        "========================================"
      );

      console.log(
        "EKART DEBUG WEBHOOK RECEIVED"
      );

      console.log(
        "Received At:",
        new Date().toISOString()
      );

     

      console.log(
        "Tracking Payload:",
        {
          id:
            payload?.id || null,

          wbn:
            payload?.wbn || null,

          status:
            payload?.status || null,

          orderNumber:
            payload?.orderNumber ||
            null,

          ctime:
            payload?.ctime || null,

          description:
            payload?.desc || null,

          location:
            payload?.location || null,

          attempts:
            payload?.attempts ?? null,

          pickupTime:
            payload?.pickupTime ||
            null,

          edd:
            payload?.edd || null,
        }
      );

      console.log(
        "========================================"
      );


      return res.status(200).json({
        success: true,
        message:
          "Ekart debug webhook received successfully.",
      });

    } catch (error) {
      console.error(
        "Ekart debug webhook error:",
        error
      );

      return res.status(200).json({
        success: false,
        message:
          "Ekart debug webhook received with an internal logging error.",
      });
    }
  }
);

// Normal JSON parser AFTER webhook
app.use(express.json());

// Temporary site pause control
app.use((req, res, next) => {
  const sitePaused =
    process.env.SITE_PAUSED === "true";

  if (!sitePaused) {
    return next();
  }

  const blockedRoutes = [
    "POST /api/auth/register",
    "POST POST /api/orders",
    "POST /api/payments/create-razorpay-order"
  ];

  const currentRoute =
    `${req.method} ${req.path}`;

  if (blockedRoutes.includes(currentRoute)) {
    return res.status(503).json({
      success: false,
      message:
        "Lana Wardrobe is temporarily under maintenance. Please try again soon.",
    });
  }

  next();
});

// =========================
// DESIGN FILE UPLOAD SETUP && PRODUCT IMAGE UPLOAD SETUP  
// =========================

const productImageStorage = multer.memoryStorage();
const productImageFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only PNG, JPG, JPEG and WEBP product images are allowed."
      ),
      false
    );
  }
};

const uploadProductImageToCloudinary = (
  fileBuffer
) => {
  return new Promise((resolve, reject) => {
    const uploadStream =
      cloudinary.uploader.upload_stream(
        {
          folder: "lana-wardrobe/products",
          resource_type: "image",
        },
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        }
      );

    uploadStream.end(fileBuffer);
  });
};

const uploadProductImage = multer({
  storage: productImageStorage,
  fileFilter: productImageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const designFileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "application/pdf",
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only PNG, JPG, JPEG and PDF files are allowed."
      ),
      false
    );
  }
};

const designStorage =
  multer.memoryStorage();

const uploadDesign = multer({
  storage: designStorage,
  fileFilter: designFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const uploadDesignToCloudinary = (
  fileBuffer
) => {
  return new Promise(
    (resolve, reject) => {
      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            folder:
              "lana-wardrobe/designs",
            resource_type: "auto",
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(result);
          }
        );

      uploadStream.end(fileBuffer);
    }
  );
};
// Allow uploaded designs to be opened in browser later
app.use(
  "/uploads",
  express.static(path.join(__dirname, "Uploads"))
);

// =========================
// TEST ROUTE
// =========================

app.get("/", (req, res) => {
  res.send("Lana Wardrobe Backend is Running!");
});

// =========================
// API HEALTH CHECK
// =========================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message:
      "Lana Wardrobe API is running successfully",
  });
});

// =========================
// DATABASE TEST
// =========================

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message:
        "PostgreSQL connected successfully",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(
      "Database connection error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Database connection failed",
    });
  }
});

// =========================
// PRODUCTS
// =========================

app.get("/api/products", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        p.*,

        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'color_name',
                pcs.color_name,
                'stock_quantity',
                pcs.stock_quantity
              )
              ORDER BY pcs.id
            )
            FROM product_color_stock pcs
            WHERE pcs.product_id = p.id
          ),
          '[]'::json
        ) AS color_stock

      FROM products p
      ORDER BY p.id ASC
      `
    );

    res.json({
      success: true,
      products: result.rows,
    });
  } catch (error) {
    console.error(
      "Products fetch error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch products",
    });
  }
});
// =========================
// BULK ORDER REQUEST
// =========================

app.post(
  "/api/bulk-order-requests",
  uploadDesign.single("designFile"),
  async (req, res) => {
    let uploadedDesign = null;
    let designSavedToDatabase = false;

    try {
      const {
        organizationName,
        contactPerson,
        phone,
        email,
        gstNumber,
        tshirtType,
        fabric,
        color,
        colorName,
        sizeQuantities,
        totalQuantity,
        printPosition,
        printingRequirement,
        requiredDate,
        deliveryCity,
        deliveryAddress,
        notes,
      } = req.body;

      if (
        !organizationName ||
        !contactPerson ||
        !phone ||
        !tshirtType ||
        !printPosition
      ) {
        return res.status(400).json({
          success: false,
          message: "Required fields are missing.",
        });
      }

      const parsedSizeQuantities =
        JSON.parse(sizeQuantities);

      const parsedTotalQuantity =
        Number(totalQuantity);

      if (
        !parsedTotalQuantity ||
        parsedTotalQuantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Total quantity must be at least 1.",
        });
      }

      if (req.file) {
        uploadedDesign =
          await uploadDesignToCloudinary(
            req.file.buffer
          );
      }

      const designFileName = req.file
        ? req.file.originalname
        : null;

      const designFilePath = uploadedDesign
        ? uploadedDesign.secure_url
        : null;

      const result = await pool.query(
        `
        INSERT INTO bulk_order_requests (
          organization_name,
          contact_person,
          phone,
          email,
          gst_number,
          tshirt_type,
          fabric,
          color_hex,
          color_name,
          size_quantities,
          total_quantity,
          print_position,
          printing_requirement,
          design_file_name,
          design_file_path,
          required_date,
          delivery_city,
          delivery_address,
          notes
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19
        )
        RETURNING *
        `,
        [
          organizationName.trim(),
          contactPerson.trim(),
          phone.trim(),
          email?.trim() || null,
          gstNumber?.trim() || null,
          tshirtType,
          fabric || null,
          color || null,
          colorName?.trim() || null,
          parsedSizeQuantities,
          parsedTotalQuantity,
          printPosition,
          printingRequirement?.trim() || null,
          designFileName,
          designFilePath,
          requiredDate || null,
          deliveryCity?.trim() || null,
          deliveryAddress?.trim() || null,
          notes?.trim() || null,
        ]
      );

      designSavedToDatabase = true;

      await sendAdminNotificationEmail({
        subject: `New Bulk Order Request #${result.rows[0].id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto;">
            <h2>New Bulk Order Request</h2>

            <p><strong>Request ID:</strong> ${result.rows[0].id}</p>
            <p><strong>Organization:</strong> ${organizationName}</p>
            <p><strong>Contact Person:</strong> ${contactPerson}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email || "-"}</p>
            <p><strong>T-shirt Type:</strong> ${tshirtType}</p>
            <p><strong>Total Quantity:</strong> ${parsedTotalQuantity}</p>
            <p><strong>Print Position:</strong> ${printPosition}</p>
            <p><strong>Required Date:</strong> ${requiredDate || "-"}</p>
            <p><strong>Delivery City:</strong> ${deliveryCity || "-"}</p>

            <p style="margin-top: 24px;">
              Open the Lana Wardrobe Admin Dashboard to review the full request.
            </p>
          </div>
        `,
    });


      return res.status(201).json({
        success: true,
        message:
          "Bulk order request submitted successfully.",
        request: result.rows[0],
      });
    } catch (error) {
      if (
        uploadedDesign?.public_id &&
        !designSavedToDatabase
      ) {
        try {
          await cloudinary.uploader.destroy(
            uploadedDesign.public_id,
            {
              resource_type:
                uploadedDesign.resource_type,
            }
          );
        } catch (cleanupError) {
          console.error(
            "Bulk design Cloudinary cleanup error:",
            cleanupError
          );
        }
      }

      console.error(
        "Bulk order request error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to submit bulk order request.",
      });
    }
  }
);

// =========================
// CUSTOMIZATION REQUEST
// =========================

app.post(
  "/api/customization-requests",
  uploadDesign.single("designFile"),
  async (req, res) => {
    let uploadedDesign = null;
    let designSavedToDatabase = false;

    try {
      const {
        name,
        phone,
        email,
        tshirtType,
        color,
        colorName,
        sizeQuantities,
        totalQuantity,
        printPosition,
        notes,
      } = req.body;

      if (
        !name ||
        !phone ||
        !tshirtType ||
        !printPosition
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Required fields are missing.",
        });
      }

      const parsedSizeQuantities =
        JSON.parse(sizeQuantities);

      const parsedTotalQuantity =
        Number(totalQuantity);

      if (
        !parsedTotalQuantity ||
        parsedTotalQuantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Total quantity must be at least 1.",
        });
      }

      if (req.file) {
        uploadedDesign =
          await uploadDesignToCloudinary(
            req.file.buffer
          );
      }

      const designFileName = req.file
        ? req.file.originalname
        : null;

      const designFilePath = uploadedDesign
        ? uploadedDesign.secure_url
        : null;

      const result = await pool.query(
        `
        INSERT INTO customization_requests (
          customer_name,
          phone,
          email,
          tshirt_type,
          color_hex,
          color_name,
          size_quantities,
          total_quantity,
          print_position,
          design_file_name,
          design_file_path,
          notes
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12
        )
        RETURNING *
        `,
        [
          name.trim(),
          phone.trim(),
          email?.trim() || null,
          tshirtType,
          color || null,
          colorName?.trim() || null,
          parsedSizeQuantities,
          parsedTotalQuantity,
          printPosition,
          designFileName,
          designFilePath,
          notes?.trim() || null,
        ]
      );

      designSavedToDatabase = true;

      await sendAdminNotificationEmail({
        subject: `New Customization Request #${result.rows[0].id}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto;">
            <h2>New Customization Request</h2>

            <p><strong>Request ID:</strong> ${result.rows[0].id}</p>
            <p><strong>Customer:</strong> ${name}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Email:</strong> ${email || "-"}</p>
            <p><strong>T-shirt Type:</strong> ${tshirtType}</p>
            <p><strong>Total Quantity:</strong> ${parsedTotalQuantity}</p>
            <p><strong>Print Position:</strong> ${printPosition}</p>

            <p style="margin-top: 24px;">
              Open the Lana Wardrobe Admin Dashboard to review the full request.
            </p>
          </div>
        `,
      });

      return res.status(201).json({
        success: true,
        message:
          "Customization request submitted successfully.",
        request: result.rows[0],
      });
    } catch (error) {
      if (
        uploadedDesign?.public_id &&
        !designSavedToDatabase
      ) {
        try {
          await cloudinary.uploader.destroy(
            uploadedDesign.public_id,
            {
              resource_type:
                uploadedDesign.resource_type,
            }
          );
        } catch (cleanupError) {
          console.error(
            "Customization design Cloudinary cleanup error:",
            cleanupError
          );
        }
      }

      console.error(
        "Customization request error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to submit customization request.",
      });
    }
  }
);

// =========================
// CONTACT MESSAGE
// =========================

app.post(
  "/api/contact-messages",
  async (req, res) => {
    try {
      const {
        name,
        phone,
        email,
        subject,
        category,
        message,
      } = req.body;

      if (
        !name ||
        !email ||
        !message
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Name, email and message are required.",
        });
      }

      const result = await pool.query(
        `
        INSERT INTO contact_messages (
          customer_name,
          phone,
          email,
          subject,
          category,
          message
        )
        VALUES (
          $1, $2, $3, $4, $5, $6
        )
        RETURNING *
        `,
        [
          name.trim(),
          phone?.trim() || null,
          email.trim(),
          subject?.trim() || null,
          category || null,
          message.trim(),
        ]
      );

      await sendAdminNotificationEmail({
  subject: `New Contact Message #${result.rows[0].id}`,
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: auto;">
      <h2>New Contact Message</h2>

      <p><strong>Message ID:</strong> ${result.rows[0].id}</p>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Phone:</strong> ${phone || "-"}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Category:</strong> ${category || "-"}</p>
      <p><strong>Subject:</strong> ${subject || "-"}</p>

      <p><strong>Message:</strong></p>

      <div style="
        background: #f5f5f5;
        padding: 12px;
        border-radius: 8px;
        white-space: pre-wrap;
      ">
        ${message}
      </div>

      <p style="margin-top: 24px;">
        Open the Lana Wardrobe Admin Dashboard to review the full message.
      </p>
    </div>
  `,
});

      res.status(201).json({
        success: true,
        message:
          "Your message has been submitted successfully.",
        contactMessage: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Contact message error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to submit contact message.",
      });
    }
  }
);

// ========================================
// ADMIN - GET BULK ORDER REQUESTS
// ========================================

app.get(
  "/api/admin/bulk-order-requests",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM bulk_order_requests
        ORDER BY created_at DESC, id DESC
        `
      );

      return res.json({
        success: true,
        requests: result.rows,
      });
    } catch (error) {
      console.error(
        "Admin bulk order requests fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load bulk order requests.",
      });
    }
  }
);

// ========================================
// ADMIN - GET CUSTOMIZATION REQUESTS
// ========================================

app.get(
  "/api/admin/customization-requests",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM customization_requests
        ORDER BY created_at DESC, id DESC
        `
      );

      return res.json({
        success: true,
        requests: result.rows,
      });
    } catch (error) {
      console.error(
        "Admin customization requests fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load customization requests.",
      });
    }
  }
);

// ========================================
// ADMIN - GET CONTACT MESSAGES
// ========================================

app.get(
  "/api/admin/contact-messages",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM contact_messages
        ORDER BY created_at DESC, id DESC
        `
      );

      return res.json({
        success: true,
        messages: result.rows,
      });
    } catch (error) {
      console.error(
        "Admin contact messages fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load contact messages.",
      });
    }
  }
);

// ========================================
// ADMIN - UPDATE BULK ORDER REQUEST STATUS
// ========================================

app.put(
  "/api/admin/bulk-order-requests/:id/status",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const { status } = req.body;

      const allowedStatuses = [
        "new",
        "contacted",
        "completed",
        "closed",
      ];

      if (
        !Number.isInteger(requestId) ||
        requestId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid request ID.",
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid request status.",
        });
      }

      const result = await pool.query(
        `
        UPDATE bulk_order_requests
        SET
          status = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
        `,
        [status, requestId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Bulk order request not found.",
        });
      }

      return res.json({
        success: true,
        message:
          "Bulk order request status updated successfully.",
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Bulk order request status update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update bulk order request status.",
      });
    }
  }
);

// ========================================
// ADMIN - UPDATE CUSTOMIZATION REQUEST STATUS
// ========================================

app.put(
  "/api/admin/customization-requests/:id/status",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const { status } = req.body;

      const allowedStatuses = [
        "new",
        "contacted",
        "completed",
        "closed",
      ];

      if (
        !Number.isInteger(requestId) ||
        requestId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid request ID.",
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid request status.",
        });
      }

      const result = await pool.query(
        `
        UPDATE customization_requests
        SET
          status = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
        `,
        [status, requestId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Customization request not found.",
        });
      }

      return res.json({
        success: true,
        message:
          "Customization request status updated successfully.",
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Customization request status update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update customization request status.",
      });
    }
  }
);

// ========================================
// ADMIN - UPDATE CONTACT MESSAGE STATUS
// ========================================

app.put(
  "/api/admin/contact-messages/:id/status",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const messageId = Number(req.params.id);
      const { status } = req.body;

      const allowedStatuses = [
        "new",
        "contacted",
        "completed",
        "closed",
      ];

      if (
        !Number.isInteger(messageId) ||
        messageId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid message ID.",
        });
      }

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid message status.",
        });
      }

      const result = await pool.query(
        `
        UPDATE contact_messages
        SET
          status = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
        `,
        [status, messageId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Contact message not found.",
        });
      }

      return res.json({
        success: true,
        message:
          "Contact message status updated successfully.",
        messageData: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Contact message status update error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update contact message status.",
      });
    }
  }
);

// ========================================
// ADMIN - DOWNLOAD CUSTOMER DESIGN FILE
// Supports new Cloudinary files + legacy local files
// ========================================

app.get(
  "/api/admin/request-design/:type/:id/download",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const requestId = Number(req.params.id);
      const requestType = req.params.type;

      if (
        !Number.isInteger(requestId) ||
        requestId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid request ID.",
        });
      }

      let tableName = "";

      if (requestType === "bulk") {
        tableName = "bulk_order_requests";
      } else if (
        requestType === "customization"
      ) {
        tableName = "customization_requests";
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid request type.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          design_file_name,
          design_file_path
        FROM ${tableName}
        WHERE id = $1
        LIMIT 1
        `,
        [requestId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Request not found.",
        });
      }

      const designRecord = result.rows[0];
      const designFilePath =
        designRecord.design_file_path;

      if (!designFilePath) {
        return res.status(404).json({
          success: false,
          message:
            "No design file is attached to this request.",
        });
      }

      const requestedDownloadName =
        designRecord.design_file_name ||
        path.basename(designFilePath) ||
        `design-${requestId}`;

      // ----------------------------------------
      // NEW FILES: CLOUDINARY
      // ----------------------------------------
      if (/^https:\/\//i.test(designFilePath)) {
        let designUrl;

        try {
          designUrl = new URL(designFilePath);
        } catch {
          return res.status(400).json({
            success: false,
            message: "Invalid design file URL.",
          });
        }

        // Only proxy files from the Cloudinary host
        // used by Lana Wardrobe. This prevents this
        // endpoint from becoming a generic URL fetcher.
        if (
          designUrl.protocol !== "https:" ||
          designUrl.hostname !== "res.cloudinary.com"
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Unsupported design file location.",
          });
        }

        const cloudResponse =
          await fetch(designUrl.toString());

        if (!cloudResponse.ok) {
          console.error(
            "Cloudinary design download failed:",
            cloudResponse.status
          );

          return res
            .status(
              cloudResponse.status === 404
                ? 404
                : 502
            )
            .json({
              success: false,
              message:
                "Design file could not be retrieved from cloud storage.",
            });
        }

        const fileBuffer = Buffer.from(
          await cloudResponse.arrayBuffer()
        );

        const cloudContentType =
          cloudResponse.headers.get(
            "content-type"
          );

        res.attachment(
          requestedDownloadName
        );

        if (cloudContentType) {
          res.setHeader(
            "Content-Type",
            cloudContentType
          );
        }

        return res.send(fileBuffer);
      }

      // ----------------------------------------
      // LEGACY FILES: RAILWAY LOCAL STORAGE
      // ----------------------------------------
      const legacyFileName =
        path.basename(designFilePath);

      const fullFilePath = path.join(
        __dirname,
        "Uploads",
        "designs",
        legacyFileName
      );

      return res.download(
        fullFilePath,
        requestedDownloadName,
        (error) => {
          if (error) {
            console.error(
              "Legacy design file download error:",
              error
            );

            if (!res.headersSent) {
              return res
                .status(404)
                .json({
                  success: false,
                  message:
                    "Design file could not be found on the server.",
                });
            }
          }
        }
      );
    } catch (error) {
      console.error(
        "Admin design download error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to download design file.",
      });
    }
  }
);

// =========================
// OTP HELPER
// =========================

function generateOtp() {
  return Math.floor(
    100000 + Math.random() * 900000
  ).toString();
}
// Registration Route section

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      phone,
      password,
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Full name, email and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 6 characters long.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const existingUser = await pool.query(
      `
      SELECT id
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    const result = await pool.query(
      `
      INSERT INTO users (
        full_name,
        email,
        phone,
        password_hash
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        full_name,
        email,
        phone,
        role,
        is_active,
        created_at
      `,
      [
        fullName.trim(),
        normalizedEmail,
        phone?.trim() || null,
        passwordHash,
      ]
    );

    const user = result.rows[0];

const otp = generateOtp();

const otpHash = await bcrypt.hash(
  otp,
  10
);

const expiresAt = new Date(
  Date.now() + 10 * 60 * 1000
);

await pool.query(
  `
  INSERT INTO email_verification_otps (
    user_id,
    otp_hash,
    expires_at
  )
  VALUES ($1, $2, $3)
  `,
  [
    user.id,
    otpHash,
    expiresAt,
  ]
);
const { error: emailError } =
  await resend.emails.send({
    from:
      "Lana Wardrobe <no-reply@lanawardrobe.in>",

    to: [user.email],

    subject:
      "Verify your Lana Wardrobe account",

    html: `
      <div
        style="
          font-family: Arial, sans-serif;
          max-width: 500px;
          margin: auto;
          padding: 30px;
          border: 1px solid #eeeeee;
          border-radius: 10px;
        "
      >
        <h2
          style="
            text-align: center;
            margin-bottom: 20px;
          "
        >
          LANA WARDROBE
        </h2>

        <p>
          Hi ${user.full_name},
        </p>

        <p>
          Thank you for creating your
          Lana Wardrobe account.
        </p>

        <p>
          Your email verification code is:
        </p>

        <h1
          style="
            text-align: center;
            letter-spacing: 8px;
            margin: 30px 0;
          "
        >
          ${otp}
        </h1>

        <p>
          This OTP will expire in
          <strong>10 minutes</strong>.
        </p>

        <p>
          If you did not create this account,
          you can ignore this email.
        </p>

        <hr
          style="
            border: none;
            border-top: 1px solid #eeeeee;
            margin: 30px 0;
          "
        />

        <p
          style="
            font-size: 12px;
            text-align: center;
          "
        >
          Made for Youth. Made with Love.
        </p>
      </div>
    `,
  });
  if (emailError) {
  console.error(
    "OTP email error:",
    emailError
  );

  return res.status(500).json({
    success: false,
    message:
      "Account created, but verification email could not be sent.",
  });
}
res.status(201).json({
  success: true,
  message:
     "Account created. Verification OTP has been sent to your email.",
  user: {
    ...user,
    email_verified: false,
  },
});
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to create account.",
    });
  }
});


// =========================
// VERIFY EMAIL OTP
// =========================

app.post("/api/auth/verify-email-otp", async (req, res) => {
  try {
    const {
      email,
      otp,
    } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const userResult = await pool.query(
      `
      SELECT
        id,
        email,
        email_verified
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const user = userResult.rows[0];

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified.",
      });
    }

    const otpResult = await pool.query(
      `
      SELECT *
      FROM email_verification_otps
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No verification OTP found.",
      });
    }

    const otpRecord = otpResult.rows[0];

    if (
      new Date() >
      new Date(otpRecord.expires_at)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OTP has expired. Please request a new OTP.",
      });
    }

    if (otpRecord.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message:
          "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    const otpMatches =
      await bcrypt.compare(
        otp.toString(),
        otpRecord.otp_hash
      );

    if (!otpMatches) {
      await pool.query(
        `
        UPDATE email_verification_otps
        SET attempts = attempts + 1
        WHERE id = $1
        `,
        [otpRecord.id]
      );

      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    await pool.query(
      `
      UPDATE users
      SET
        email_verified = TRUE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      `,
      [user.id]
    );

    await pool.query(
      `
      DELETE FROM email_verification_otps
      WHERE user_id = $1
      `,
      [user.id]
    );

    res.json({
      success: true,
      message:
        "Email verified successfully.",
    });
  } catch (error) {
    console.error(
      "Email OTP verification error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to verify email OTP.",
    });
  }
});

// =========================
// CUSTOMER LOGIN
// =========================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const result = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        phone,
        password_hash,
        role,
        is_active,
        email_verified
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    // First check password
    const passwordMatches =
      await bcrypt.compare(
        password,
        user.password_hash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    // Then check account status
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message:
          "This account is currently disabled.",
      });
    }

    // Then check email verification
    if (!user.email_verified) {
      return res.status(403).json({
        success: false,
        message:
          "Please verify your email before logging in.",
      });
    }

    // Generate token only after all checks pass
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        email_verified:
          user.email_verified,
      },
    });

  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to login.",
    });
  }
});


// =========================
// GOOGLE LOGIN
// =========================

app.post("/api/auth/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "Google credential is required.",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.email) {
      return res.status(401).json({
        success: false,
        message: "Invalid Google account.",
      });
    }

    if (!payload.email_verified) {
      return res.status(401).json({
        success: false,
        message: "Google email is not verified.",
      });
    }

    const normalizedEmail =
      payload.email.trim().toLowerCase();

    const fullName =
      payload.name?.trim() ||
      normalizedEmail.split("@")[0];

    let result = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        phone,
        role,
        is_active,
        email_verified
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    let user;

    if (result.rows.length > 0) {
      user = result.rows[0];

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message:
            "This account is currently disabled.",
        });
      }

      if (!user.email_verified) {
        const verifiedResult =
          await pool.query(
            `
            UPDATE users
            SET
              email_verified = TRUE,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING
              id,
              full_name,
              email,
              phone,
              role,
              is_active,
              email_verified
            `,
            [user.id]
          );

        user = verifiedResult.rows[0];
      }
    } else {
      const randomPassword =
        crypto.randomBytes(32).toString("hex");

      const passwordHash =
        await bcrypt.hash(
          randomPassword,
          12
        );

      const createResult =
        await pool.query(
          `
          INSERT INTO users (
            full_name,
            email,
            phone,
            password_hash,
            email_verified
          )
          VALUES ($1, $2, $3, $4, TRUE)
          RETURNING
            id,
            full_name,
            email,
            phone,
            role,
            is_active,
            email_verified
          `,
          [
            fullName,
            normalizedEmail,
            null,
            passwordHash,
          ]
        );

      user = createResult.rows[0];
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.json({
      success: true,
      message:
        "Google login successful.",
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(
      "Google login error:",
      error
    );

    return res.status(401).json({
      success: false,
      message:
        "Google authentication failed.",
    });
  }
});
// =========================
// RESEND EMAIL OTP
// =========================

app.post("/api/auth/resend-email-otp", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // Find customer
    const userResult = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        email_verified,
        is_active
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "This account is disabled.",
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified.",
      });
    }

    // Check when last OTP was sent
    const previousOtp = await pool.query(
      `
      SELECT created_at
      FROM email_verification_otps
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id]
    );

    if (previousOtp.rows.length > 0) {
      const lastSent =
        new Date(previousOtp.rows[0].created_at);

      const secondsPassed =
        (Date.now() - lastSent.getTime()) / 1000;

      if (secondsPassed < 60) {
        return res.status(429).json({
          success: false,
          message:
            "Please wait 60 seconds before requesting another OTP.",
        });
      }
    }

    // Delete previous OTP
    await pool.query(
      `
      DELETE FROM email_verification_otps
      WHERE user_id = $1
      `,
      [user.id]
    );

    // Create fresh OTP
    const otp = generateOtp();

    const otpHash = await bcrypt.hash(
      otp,
      10
    );

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    const otpResult = await pool.query(
      `
      INSERT INTO email_verification_otps (
        user_id,
        otp_hash,
        expires_at
      )
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [
        user.id,
        otpHash,
        expiresAt,
      ]
    );

    // Send OTP email
    const { error: emailError } =
      await resend.emails.send({
        from:
          "Lana Wardrobe <onboarding@resend.dev>",

        to: [user.email],

        subject:
          "Your new Lana Wardrobe verification code",

        html: `
          <div
            style="
              font-family: Arial, sans-serif;
              max-width: 500px;
              margin: auto;
              padding: 30px;
            "
          >
            <h2 style="text-align:center;">
              LANA WARDROBE
            </h2>

            <p>
              Hi ${user.full_name},
            </p>

            <p>
              Your new verification code is:
            </p>

            <h1
              style="
                text-align:center;
                letter-spacing:8px;
                margin:30px 0;
              "
            >
              ${otp}
            </h1>

            <p>
              This OTP expires in
              <strong>10 minutes</strong>.
            </p>

            <p>
              If you did not request this code,
              you can ignore this email.
            </p>

            <p
              style="
                text-align:center;
                font-size:12px;
                margin-top:30px;
              "
            >
              Made for Youth. Made with Love.
            </p>
          </div>
        `,
      });

    if (emailError) {
      // Remove unusable OTP if email failed
      await pool.query(
        `
        DELETE FROM email_verification_otps
        WHERE id = $1
        `,
        [otpResult.rows[0].id]
      );

      console.error(
        "Resend OTP email error:",
        emailError
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to send verification OTP.",
      });
    }

    res.json({
      success: true,
      message:
        "A new verification OTP has been sent to your email.",
    });
  } catch (error) {
    console.error(
      "Resend OTP error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to resend verification OTP.",
    });
  }
});

app.post(
  "/api/orders",
  authenticateUser,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
  fullName,
  phone,
  email,
  address,
  city,
  state,
  pincode,
  note,
  paymentMethod,
  items,
} = req.body;   

      if (
        !fullName ||
        !phone ||
        !email ||
        !address ||
        !city ||
        !state ||
        !pincode
      ) {
        return res.status(400).json({
          success: false,
          message:
            "All shipping details are required.",
        });
      }
      
      if (
  paymentMethod !== "cod" &&
  paymentMethod !== "online"
) {
  return res.status(400).json({
    success: false,
    message:
      "Please select a valid payment method.",
  });
}

      if (
        !Array.isArray(items) ||
        items.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Your cart is empty.",
        });
      }

      /*
        Validate every cart item first.
      */

      for (const item of items) {
        if (
          !item.productId ||
          !Number.isInteger(
            Number(item.quantity)
          ) ||
          Number(item.quantity) < 1
        ) {
          return res.status(400).json({
            success: false,
            message:
              "Invalid cart item.",
          });
        }
      }

      const productIds = [
        ...new Set(
          items.map((item) =>
            Number(item.productId)
          )
        ),
      ];

      const productResult =
        await client.query(
          `
          SELECT
            id,
            name,
            price,
            discount_price,
            stock,
            sizes,
            colors
          FROM products
          WHERE id = ANY($1::int[])
          `,
          [productIds]
        );

      if (
        productResult.rows.length !==
        productIds.length
      ) {
        return res.status(400).json({
          success: false,
          message:
            "One or more products no longer exist.",
        });
      }

      const productMap =
        new Map();

      for (
        const product
        of productResult.rows
      ) {
        productMap.set(
          Number(product.id),
          product
        );
      }

      let subtotal = 0;

      const validatedItems = [];

      for (const item of items) {
        const product =
          productMap.get(
            Number(item.productId)
          );

        const quantity =
          Number(item.quantity);

        if (
          quantity >
          Number(product.stock)
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Only ${product.stock} item(s) available for ${product.name}.`,
          });
        }

        if (
          item.selectedSize &&
          Array.isArray(product.sizes) &&
          !product.sizes.includes(
            item.selectedSize
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Invalid size selected for ${product.name}.`,
          });
        }

        if (
          item.selectedColor &&
          Array.isArray(product.colors) &&
          !product.colors.includes(
            item.selectedColor
          )
        ) {
          return res.status(400).json({
            success: false,
            message:
              `Invalid colour selected for ${product.name}.`,
          });
        }

        const unitPrice =
          product.discount_price !== null
            ? Number(
                product.discount_price
              )
            : Number(product.price);

        const lineTotal =
          unitPrice * quantity;

        subtotal += lineTotal;

        validatedItems.push({
          productId:
            Number(product.id),

          productName:
            product.name,

          selectedSize:
            item.selectedSize || null,

          selectedColor:
            item.selectedColor || null,

          quantity,

          unitPrice,

          lineTotal,
        });
      }

      const shippingCharge = 0;

      const totalAmount = subtotal;

      /*
        Start database transaction.
      */

      await client.query("BEGIN");

      const orderResult =
        await client.query(
          `
          INSERT INTO orders (
  user_id,
  full_name,
  phone,
  email,
  address,
  city,
  state,
  pincode,
  order_note,
  subtotal,
  shipping_charge,
  total_amount,
  payment_method,
  payment_gateway
)
VALUES (
  $1, $2, $3, $4,
  $5, $6, $7, $8,
  $9, $10, $11, $12,
  $13, $14
)
          RETURNING
            id,
            user_id,
            subtotal,
            shipping_charge,
            total_amount,
            payment_status,
            order_status,
            created_at
          `,
          [
            req.user.userId,
            fullName.trim(),
            phone.trim(),
            email
              .trim()
              .toLowerCase(),
            address.trim(),
            city.trim(),
            state.trim(),
            pincode.trim(),
           note?.trim() || null,
            subtotal,
            shippingCharge,
            totalAmount,
            paymentMethod,
            paymentMethod === "online"
            ? "razorpay"
            : null,
          ]
        );

      const order =
        orderResult.rows[0];


      for (
  const item
  of validatedItems
) {
  // ========================================
  // ATOMIC STOCK DEDUCTION
  // ========================================

  const stockResult =
    await client.query(
      `
      UPDATE products
      SET
        stock = stock - $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE
        id = $2
        AND stock >= $1
      RETURNING
        id,
        name,
        stock
      `,
      [
        item.quantity,
        item.productId,
      ]
    );

  if (
    stockResult.rows.length === 0
  ) {
    throw new Error(
      `INSUFFICIENT_STOCK:${item.productName}`
    );
  }

  // ========================================
  // SAVE ORDER ITEM
  // ========================================

  await client.query(
    `
    INSERT INTO order_items (
      order_id,
      product_id,
      product_name,
      size,
      color,
      quantity,
      unit_price,
      line_total
    )
    VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8
    )
    `,
    [
      order.id,
      item.productId,
      item.productName,
      item.selectedSize,
      item.selectedColor,
      item.quantity,
      item.unitPrice,
      item.lineTotal,
    ]
  );
}

      await client.query(
        "COMMIT"
      );

      res.status(201).json({
        success: true,
        message:
          "Order created successfully.",
        order,
      });

    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "Create order error:",
        error
      );

       if (
    error.message?.startsWith(
      "INSUFFICIENT_STOCK:"
    )
  ) {
    const productName =
      error.message.split(":")[1];

    return res.status(409).json({
      success: false,
      message:
        `${productName} has just gone out of stock or does not have enough quantity. Please update your cart and try again.`,
    });
  }

      return res.status(500).json({
        success: false,
        message:
          "Failed to create order.",
      });

    } finally {
      client.release();
    }
  }
);

app.post(
  "/api/payments/create-razorpay-order",
  authenticateUser,
  async (req, res) => {
    try {
      const { orderId } = req.body;

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message: "Order ID is required.",
        });
      }

      const orderResult = await pool.query(
        `
        SELECT
          id,
          user_id,
          total_amount,
          payment_status
        FROM orders
        WHERE id = $1
        `,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      const order = orderResult.rows[0];

      if (
        Number(order.user_id) !==
        Number(req.user.userId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not allowed to pay for this order.",
        });
      }

      if (order.payment_status === "paid") {
        return res.status(400).json({
          success: false,
          message:
            "This order is already paid.",
        });
      }

      const amountInPaise =
        Math.round(
          Number(order.total_amount) * 100
        );

      const razorpayOrder =
        await razorpay.orders.create({
          amount: amountInPaise,
          currency: "INR",
          receipt:
            `lana_order_${order.id}`,
        });

      await pool.query(
        `
        UPDATE orders
        SET
          razorpay_order_id = $1,
          payment_method = $2,
          payment_gateway = $3,
          payment_status = $4,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
        `,
        [
          razorpayOrder.id,
          "online",
          "razorpay",
          "pending",
          order.id,
        ]
      );

      res.json({
        success: true,

        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency,
        },

        keyId:
          process.env.RAZORPAY_KEY_ID,
      });

    } catch (error) {
      console.error(
        "Create Razorpay order error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to create Razorpay payment order.",
      });
    }
  }
);

app.post(
  "/api/payments/verify-razorpay-payment",
  authenticateUser,
  async (req, res) => {
    try {
      const {
        orderId,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      } = req.body;

      if (
        !orderId ||
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Payment verification details are incomplete.",
        });
      }

     const orderResult =
  await pool.query(
    `
    SELECT
      id,
      user_id,
      razorpay_order_id,
      payment_status,
      order_status
    FROM orders
    WHERE id = $1
    `,
    [orderId]
  );
      if (
        orderResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      const order =
        orderResult.rows[0];

        if (
        order.order_status === "cancelled"
        ) {
        return res.status(409).json({
            success: false,
            message:
            "This payment session has expired. Please place the order again.",
        });
        }

      if (
        Number(order.user_id) !==
        Number(req.user.userId)
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You are not allowed to verify this order.",
        });
      }

      if (
        order.razorpay_order_id !==
        razorpay_order_id
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Razorpay order mismatch.",
        });
      }

      if (
        order.payment_status === "paid"
      ) {
        return res.json({
          success: true,
          message:
            "Payment is already verified.",
        });
      }

      const expectedSignature =
        crypto
          .createHmac(
            "sha256",
            process.env.RAZORPAY_KEY_SECRET
          )
          .update(
            `${order.razorpay_order_id}|${razorpay_payment_id}`
          )
          .digest("hex");

        const expectedBuffer =
        Buffer.from(
            expectedSignature,
            "hex"
        );

        const receivedBuffer =
        Buffer.from(
            razorpay_signature,
            "hex"
        );

        const isValid =
        expectedBuffer.length ===
            receivedBuffer.length &&
        crypto.timingSafeEqual(
            expectedBuffer,
            receivedBuffer
        );

          if (!isValid) {
        return res.status(400).json({
          success: false,
          message:
            "Payment verification failed.",
        });
      }

      await pool.query(
        `
        UPDATE orders
        SET
          razorpay_payment_id = $1,
          razorpay_signature = $2,
          payment_status = 'paid',
          order_status = 'confirmed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        AND order_status != 'cancelled'
        `,
        [
          razorpay_payment_id,
          razorpay_signature,
          order.id,
        ]
      );

      res.json({
        success: true,
        message:
          "Payment verified successfully.",
      });

    } catch (error) {
      console.error(
        "Verify Razorpay payment error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to verify payment.",
      });
    }
  }
);

// ========================================
// ABANDON UNPAID RAZORPAY ORDER
// RESTORE RESERVED STOCK SAFELY
// ========================================

app.post(
  "/api/payments/abandon-online-order",
  authenticateUser,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const orderId =
        Number(req.body?.orderId);

      if (
        !Number.isInteger(orderId) ||
        orderId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order ID.",
        });
      }

      await client.query("BEGIN");

      const orderResult =
        await client.query(
          `
          SELECT
            id,
            user_id,
            payment_method,
            payment_status,
            order_status,
            stock_restored,
            razorpay_order_id
          FROM orders
          WHERE id = $1
          FOR UPDATE
          `,
          [orderId]
        );

      if (
        orderResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      const order =
        orderResult.rows[0];

      // Only the customer who created
      // the order may abandon it.
      if (
        Number(order.user_id) !==
        Number(req.user.userId)
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(403).json({
          success: false,
          message:
            "You are not allowed to cancel this payment session.",
        });
      }

      // Never use this endpoint for COD.
      if (
        order.payment_method !==
        "online"
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          success: false,
          message:
            "Only online payment sessions can be abandoned.",
        });
      }

      // A successful payment must
      // never be cancelled here.
      if (
        order.payment_status ===
        "paid"
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(409).json({
          success: false,
          message:
            "This order has already been paid.",
        });
      }

      // Idempotent protection.
      // If stock has already been restored,
      // do not restore it again.
      if (
        order.order_status ===
          "cancelled" ||
        order.stock_restored
      ) {
        await client.query(
          "COMMIT"
        );

        return res.json({
          success: true,
          message:
            "Payment session is already cancelled.",
        });
      }

      // Only untouched temporary
      // online orders may be cancelled.
      if (
        order.order_status !==
          "order_placed" ||
        (
          order.payment_status !==
            "pending" &&
          order.payment_status !==
            "failed"
        )
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(409).json({
          success: false,
          message:
            "This payment session cannot be cancelled automatically.",
        });
      }

      // ========================================
      // CHECK RAZORPAY BEFORE RESTORING STOCK
      // ========================================

      if (order.razorpay_order_id) {
        const razorpayOrder =
          await razorpay.orders.fetch(
            order.razorpay_order_id
          );

        const razorpayStatus =
          String(
            razorpayOrder?.status || ""
          ).toLowerCase();

        // "created" means payment has not
        // actually been attempted/completed.
        //
        // If Razorpay says attempted/paid,
        // do NOT restore stock automatically.
        if (
          razorpayStatus &&
          razorpayStatus !== "created"
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(409).json({
            success: false,
            message:
              "Payment activity was detected. The order was not cancelled automatically.",
          });
        }
      }

// ========================================
// MARK PAYMENT SESSION AS ABANDONED
// KEEP STOCK RESERVED TEMPORARILY
// ========================================

      await client.query(
        `
        UPDATE orders
        SET
          payment_status = 'failed',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE
          id = $1
          AND order_status = 'order_placed'
          AND payment_status <> 'paid'
        `,
        [orderId]
      );

      await client.query(
        "COMMIT"
      );

      console.log(
    `Razorpay payment session abandoned for order #${orderId}.`
      );

      return res.json({
        success: true,
        message:
            "Payment session closed safely.",
      });

    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // Ignore rollback error
      }

      console.error(
        "Abandon online order error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to cancel the payment session.",
      });

    } finally {
      client.release();
    }
  }
);

app.get(
  "/api/orders/my-orders",
  authenticateUser,
  async (req, res) => {
    try {
      const ordersResult = await pool.query(
        `
        SELECT
          id,
          full_name,
          phone,
          email,
          address,
          city,
          state,
          pincode,
          order_note,
          subtotal,
          shipping_charge,
          total_amount,
          payment_method,
          payment_gateway,
          payment_status,
          order_status,
          tracking_number,
          courier_name,
          created_at
        FROM orders
        WHERE
          user_id = $1
          AND (
            payment_method = 'cod'
            OR payment_status = 'paid'
          )
        ORDER BY created_at DESC
        `,
        [req.user.userId]
      );

      const orders = [];

      for (const order of ordersResult.rows) {
        const itemsResult = await pool.query(
  `
  SELECT
    oi.id,
    oi.product_id,
    oi.product_name,
    oi.size,
    oi.color,
    oi.quantity,
    oi.unit_price,
    oi.line_total,
    p.image_url
  FROM order_items oi
  LEFT JOIN products p
    ON p.id = oi.product_id
  WHERE oi.order_id = $1
  ORDER BY oi.id ASC
  `,
  [order.id]
);
        orders.push({
          ...order,
          items: itemsResult.rows,
        });
      }

      res.json({
        success: true,
        orders,
      });

    } catch (error) {
      console.error(
        "Fetch my orders error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to fetch your orders.",
      });
    }
  }
);

app.get(
  "/api/admin/test",
  authenticateUser,
  requireAdmin,
  (req, res) => {
    res.json({
      success: true,
      message: "Admin access granted.",
      admin: {
        userId: req.user.userId,
        role: req.user.role,
      },
    });
  }
);

app.get(
  "/api/admin/dashboard-summary",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const [
        productsResult,
        ordersResult,
        pendingOrdersResult,
        paidOrdersResult,
        customersResult,
      ] = await Promise.all([
        pool.query(
          "SELECT COUNT(*)::int AS count FROM products"
        ),

        pool.query(
          "SELECT COUNT(*)::int AS count FROM orders"
        ),

        pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM orders
          WHERE order_status IN (
            'order_placed',
            'confirmed',
            'packed'
          )
          `
        ),

        pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM orders
          WHERE payment_status = 'paid'
          `
        ),

        pool.query(
          `
          SELECT COUNT(*)::int AS count
          FROM users
          WHERE role = 'customer'
          `
        ),
      ]);

      res.json({
        success: true,
        summary: {
          totalProducts:
            productsResult.rows[0].count,

          totalOrders:
            ordersResult.rows[0].count,

          pendingOrders:
            pendingOrdersResult.rows[0].count,

          paidOrders:
            paidOrdersResult.rows[0].count,

          customers:
            customersResult.rows[0].count,
        },
      });

    } catch (error) {
      console.error(
        "Admin dashboard summary error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load dashboard summary.",
      });
    }
  }
);
app.get(
  "/api/admin/products",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          id,
          name,
          category,
          price,
          discount_price,
          description,
          stock,
          sizes,
          colors,
          image_url,
          new_arrival,
          best_seller,
          featured,
          created_at,
          updated_at
        FROM products
        ORDER BY created_at DESC, id DESC
        `
      );

      res.json({
        success: true,
        products: result.rows,
      });
    } catch (error) {
      console.error(
        "Admin products fetch error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load products.",
      });
    }
  }
);
app.post(
  "/api/admin/products",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        name,
        category,
        price,
        discountPrice,
        description,
        sizes,
        colors,
        colorStock,
        newArrival,
        bestSeller,
        featured,
      } = req.body;
      if (!name || !category || price === undefined) {
        return res.status(400).json({
          success: false,
          message:
            "Product name, category and price are required.",
        });
      }

      const numericPrice = Number(price);
      const numericDiscountPrice =
        discountPrice === "" ||
        discountPrice === null ||
        discountPrice === undefined
          ? null
          : Number(discountPrice);


      if (
        Number.isNaN(numericPrice) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product price.",
        });
      }

      if (
        numericDiscountPrice !== null &&
        (
          Number.isNaN(numericDiscountPrice) ||
          numericDiscountPrice < 0
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid discount price.",
        });
      }

      if (!Array.isArray(colorStock)) {
  return res.status(400).json({
    success: false,
    message:
      "Color-wise stock data is required.",
  });
}
      
      const normalizedColorStock =
  colorStock.map((item) => ({
    color_name: String(
      item.color_name || ""
    ).trim(),

    stock_quantity: Number(
      item.stock_quantity || 0
    ),
  }));

          const normalizedColorNames =
  normalizedColorStock.map((item) =>
    item.color_name.toLowerCase()
  );

const hasDuplicateColors =
  new Set(normalizedColorNames).size !==
  normalizedColorNames.length;

if (hasDuplicateColors) {
  return res.status(400).json({
    success: false,
    message:
      "Duplicate color names are not allowed.",
  });
}

      if (
        normalizedColorStock.some(
          (item) =>
            !item.color_name ||
            !Number.isInteger(
              item.stock_quantity
            ) ||
            item.stock_quantity < 0
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid color stock data.",
        });
      }

const totalStock =
  normalizedColorStock.reduce(
    (sum, item) =>
      sum + item.stock_quantity,
    0
  );

      
  const client = await pool.connect();

try {
  await client.query("BEGIN");

  const result = await client.query(
    `
    INSERT INTO products (
      name,
      category,
      price,
      discount_price,
      description,
      stock,
      sizes,
      colors,
      new_arrival,
      best_seller,
      featured
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11
    )
    RETURNING *
    `,
    [
      name.trim(),
      category.trim().toLowerCase(),
      numericPrice,
      numericDiscountPrice,
      description?.trim() || null,
      totalStock,
      Array.isArray(sizes) ? sizes : [],
      Array.isArray(colors) ? colors : [],
      Boolean(newArrival),
      Boolean(bestSeller),
      Boolean(featured),
    ]
  );

  const product = result.rows[0];

  for (
    const item of normalizedColorStock
  ) {
    await client.query(
      `
      INSERT INTO product_color_stock (
        product_id,
        color_name,
        stock_quantity
      )
      VALUES ($1, $2, $3)
      ON CONFLICT (
        product_id,
        color_name
      )
      DO UPDATE SET
        stock_quantity =
          EXCLUDED.stock_quantity,
        updated_at =
          CURRENT_TIMESTAMP
      `,
      [
        product.id,
        item.color_name,
        item.stock_quantity,
      ]
    );
  }

  await client.query("COMMIT");

  res.status(201).json({
    success: true,
    message:
      "Product added successfully.",
    product,
  });

} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Ignore rollback error
  }

  throw error;

} finally {
  client.release();
}
    } catch (error) {
      console.error(
        "Admin add product error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to add product.",
      });
    }
  }
);
app.get(
  "/api/admin/products/:id",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const productId = Number(req.params.id);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
      }

      const result = await pool.query(
  `
  SELECT
    p.*,

    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'color_name',
            pcs.color_name,
            'stock_quantity',
            pcs.stock_quantity
          )
          ORDER BY pcs.id
        )
        FROM product_color_stock pcs
        WHERE pcs.product_id = p.id
      ),
      '[]'::json
    ) AS color_stock

  FROM products p
  WHERE p.id = $1
  `,
  [productId]
);
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      res.json({
        success: true,
        product: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Admin fetch product error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load product.",
      });
    }
  }
);

app.put(
  "/api/admin/products/:id",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const productId = Number(req.params.id);

      const {
          name,
          category,
          price,
          discountPrice,
          description,
          sizes,
          colors,
          colorStock,
          newArrival,
          bestSeller,
          featured,
        } = req.body;

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
      }

      if (!name || !category || price === undefined) {
        return res.status(400).json({
          success: false,
          message:
            "Product name, category and price are required.",
        });
      }

      const numericPrice = Number(price);

      const numericDiscountPrice =
        discountPrice === "" ||
        discountPrice === null ||
        discountPrice === undefined
          ? null
          : Number(discountPrice);


      if (
        Number.isNaN(numericPrice) ||
        numericPrice < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product price.",
        });
      }

      if (
        numericDiscountPrice !== null &&
        (
          Number.isNaN(numericDiscountPrice) ||
          numericDiscountPrice < 0
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid discount price.",
        });
      }

      if (!Array.isArray(colorStock)) {
  return res.status(400).json({
    success: false,
    message:
      "Color-wise stock data is required.",
  });
}

      const normalizedColorStock =
  colorStock.map((item) => ({
    color_name: String(
      item.color_name || ""
    ).trim(),

    stock_quantity: Number(
      item.stock_quantity || 0
    ),
  }));
    
const normalizedColorNames =
  normalizedColorStock.map((item) =>
    item.color_name.toLowerCase()
  );

const hasDuplicateColors =
  new Set(normalizedColorNames).size !==
  normalizedColorNames.length;

if (hasDuplicateColors) {
  return res.status(400).json({
    success: false,
    message:
      "Duplicate color names are not allowed.",
  });
}


if (
  normalizedColorStock.some(
    (item) =>
      !item.color_name ||
      !Number.isInteger(
        item.stock_quantity
      ) ||
      item.stock_quantity < 0
  )
) {
  return res.status(400).json({
    success: false,
    message:
      "Invalid color stock data.",
  });
}

const totalStock =
  normalizedColorStock.reduce(
    (sum, item) =>
      sum + item.stock_quantity,
    0
  );

const client = await pool.connect();

try {
  await client.query("BEGIN");

  const result = await client.query(
    `
    UPDATE products
    SET
      name = $1,
      category = $2,
      price = $3,
      discount_price = $4,
      description = $5,
      stock = $6,
      sizes = $7,
      colors = $8,
      new_arrival = $9,
      best_seller = $10,
      featured = $11,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $12
    RETURNING *
    `,
    [
      name.trim(),
      category.trim().toLowerCase(),
      numericPrice,
      numericDiscountPrice,
      description?.trim() || null,
      totalStock,
      Array.isArray(sizes) ? sizes : [],
      Array.isArray(colors) ? colors : [],
      Boolean(newArrival),
      Boolean(bestSeller),
      Boolean(featured),
      productId,
    ]
  );

  if (result.rows.length === 0) {
    await client.query("ROLLBACK");

    return res.status(404).json({
      success: false,
      message: "Product not found.",
    });
  }

  await client.query(
    `
    DELETE FROM product_color_stock
    WHERE product_id = $1
    `,
    [productId]
  );

  for (
    const item of normalizedColorStock
  ) {
    await client.query(
      `
      INSERT INTO product_color_stock (
        product_id,
        color_name,
        stock_quantity
      )
      VALUES ($1, $2, $3)
      `,
      [
        productId,
        item.color_name,
        item.stock_quantity,
      ]
    );
  }

  await client.query("COMMIT");

  res.json({
    success: true,
    message:
      "Product updated successfully.",
    product: result.rows[0],
  });

} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // Ignore rollback error
  }

  throw error;

} finally {
  client.release();
}

    } catch (error) {
      console.error(
        "Admin update product error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to update product.",
      });
    }
  }
);

app.post(
  "/api/admin/products/:id/images",
  authenticateUser,
  requireAdmin,
  uploadProductImage.array("productImages", 8),
  async (req, res) => {
    const client = await pool.connect();

    const uploadedCloudinaryImages = [];

    try {
      const productId = Number(req.params.id);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message:
            "Please select at least one image.",
        });
      }

      const productResult = await client.query(
        `
        SELECT id, image_url
        FROM products
        WHERE id = $1
        `,
        [productId]
      );

      if (productResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      /*
        Upload images to Cloudinary first.
      */
      for (const file of req.files) {
        const cloudinaryResult =
          await uploadProductImageToCloudinary(
            file.buffer
          );

        uploadedCloudinaryImages.push({
          secure_url:
            cloudinaryResult.secure_url,
          public_id:
            cloudinaryResult.public_id,
        });
      }

      await client.query("BEGIN");

      const existingImagesResult =
        await client.query(
          `
          SELECT COUNT(*)::int AS count
          FROM product_images
          WHERE product_id = $1
          `,
          [productId]
        );

      let nextOrder =
        existingImagesResult.rows[0].count;

      const insertedImages = [];

      for (
        let i = 0;
        i < uploadedCloudinaryImages.length;
        i++
      ) {
        const cloudinaryImage =
          uploadedCloudinaryImages[i];

        const imageUrl =
          cloudinaryImage.secure_url;

        const isPrimary =
          existingImagesResult.rows[0].count ===
            0 &&
          i === 0;

        const imageResult = await client.query(
          `
          INSERT INTO product_images (
            product_id,
            image_url,
            display_order,
            is_primary
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
          `,
          [
            productId,
            imageUrl,
            nextOrder,
            isPrimary,
          ]
        );

        insertedImages.push(
          imageResult.rows[0]
        );

        nextOrder++;
      }

      /*
        If product doesn't already have a main image,
        use the first Cloudinary image.
      */
     if (
        existingImagesResult.rows[0].count === 0 &&
        insertedImages.length > 0
      ) {
        await client.query(
          `
          UPDATE products
          SET
            image_url = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [
            insertedImages[0].image_url,
            productId,
          ]
        );
      }

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message:
          "Product images uploaded successfully.",
        images: insertedImages,
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // No active transaction is also possible
      }

      /*
        If Cloudinary upload succeeded but database
        saving failed, remove those uploaded files
        so we don't leave unused images behind.
      */
      for (
        const image of uploadedCloudinaryImages
      ) {
        try {
          await cloudinary.uploader.destroy(
            image.public_id
          );
        } catch (cleanupError) {
          console.error(
            "Cloudinary cleanup error:",
            cleanupError
          );
        }
      }

      console.error(
        "Product images upload error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to upload product images.",
      });
    } finally {
      client.release();
    }
  }
);
// =========================
// PRODUCT IMAGE GALLERY
// =========================

app.get(
  "/api/products/:id/images",
  async (req, res) => {
    try {
      const productId = Number(req.params.id);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
      }

      // Make sure product exists
      const productResult = await pool.query(
        `
        SELECT id, image_url
        FROM products
        WHERE id = $1
        `,
        [productId]
      );

      if (productResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      const imagesResult = await pool.query(
        `
        SELECT
          id,
          product_id,
          image_url,
          display_order,
          is_primary
        FROM product_images
        WHERE product_id = $1
        ORDER BY
          is_primary DESC,
          display_order ASC,
          id ASC
        `,
        [productId]
      );

      let images = imagesResult.rows;

      // Compatibility with products that only
      // have the old products.image_url field.
      if (
        images.length === 0 &&
        productResult.rows[0].image_url
      ) {
        images = [
          {
            id: null,
            product_id: productId,
            image_url:
              productResult.rows[0].image_url,
            display_order: 0,
            is_primary: true,
          },
        ];
      }

      res.json({
        success: true,
        images,
      });

    } catch (error) {
      console.error(
        "Product gallery fetch error:",
        error
      );

      res.status(500).json({
        success: false,
        message:
          "Failed to load product images.",
      });
    }
  }
);

// ========================================
// ADMIN - SET PRODUCT IMAGE AS PRIMARY
// ========================================

app.put(
  "/api/admin/products/:productId/images/:imageId/primary",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const productId = Number(req.params.productId);
      const imageId = Number(req.params.imageId);

      if (
        !Number.isInteger(productId) ||
        !Number.isInteger(imageId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or image ID.",
        });
      }

      await client.query("BEGIN");

      // Make sure image belongs to this product
      const imageResult = await client.query(
        `
        SELECT id, product_id, image_url
        FROM product_images
        WHERE id = $1
          AND product_id = $2
        `,
        [imageId, productId]
      );

      if (imageResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Product image not found.",
        });
      }

      const selectedImage = imageResult.rows[0];

      // Remove primary flag from all images
      await client.query(
        `
        UPDATE product_images
        SET is_primary = FALSE
        WHERE product_id = $1
        `,
        [productId]
      );

      // Make selected image primary
      await client.query(
        `
        UPDATE product_images
        SET is_primary = TRUE
        WHERE id = $1
          AND product_id = $2
        `,
        [imageId, productId]
      );

      // Keep products.image_url synced
      await client.query(
        `
        UPDATE products
        SET
          image_url = $1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [
          selectedImage.image_url,
          productId,
        ]
      );

      await client.query("COMMIT");

      return res.json({
        success: true,
        message:
          "Primary product image updated successfully.",
        image: {
          ...selectedImage,
          is_primary: true,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Set primary product image error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to set primary product image.",
      });
    } finally {
      client.release();
    }
  }
);
// ========================================
// ADMIN - DELETE PRODUCT
// ========================================

app.delete(
  "/api/admin/products/:id",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const productId = Number(req.params.id);

      if (!Number.isInteger(productId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
      }

      await client.query("BEGIN");

      // Check product exists
      const productResult = await client.query(
        `
        SELECT id, name
        FROM products
        WHERE id = $1
        `,
        [productId]
      );

      if (productResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      // Check whether product exists in previous orders
      const orderUsageResult = await client.query(
        `
        SELECT COUNT(*)::int AS count
        FROM order_items
        WHERE product_id = $1
        `,
        [productId]
      );

      if (orderUsageResult.rows[0].count > 0) {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message:
            "This product exists in previous orders and cannot be permanently deleted.",
        });
      }

      // Get image files before deleting DB rows
      const imageResult = await client.query(
        `
        SELECT image_url
        FROM product_images
        WHERE product_id = $1
        `,
        [productId]
      );

      // Delete product
      // product_images rows will auto-delete because of ON DELETE CASCADE
      await client.query(
        `
        DELETE FROM products
        WHERE id = $1
        `,
        [productId]
      );

      await client.query("COMMIT");

      // Delete actual local image files
      for (const image of imageResult.rows) {
        try {
          if (
            image.image_url &&
            image.image_url.startsWith("/uploads/products/")
          ) {
            const fileName = path.basename(image.image_url);

            const filePath = path.join(
              __dirname,
              "Uploads",
              "products",
              fileName
            );

            fs.unlink(filePath, (error) => {
              if (
                error &&
                error.code !== "ENOENT"
              ) {
                console.error(
                  "Product image file delete error:",
                  error
                );
              }
            });
          }
        } catch (fileError) {
          console.error(
            "Product image cleanup error:",
            fileError
          );
        }
      }

      return res.json({
        success: true,
        message: "Product deleted successfully.",
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Delete product error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to delete product.",
      });
    } finally {
      client.release();
    }
  }
);

// ========================================
// ADMIN - DELETE PRODUCT IMAGE
// ========================================

app.delete(
  "/api/admin/products/:productId/images/:imageId",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const productId = Number(req.params.productId);
      const imageId = Number(req.params.imageId);

      if (
        !Number.isInteger(productId) ||
        !Number.isInteger(imageId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product or image ID.",
        });
      }

      await client.query("BEGIN");

      // Find image first
      const imageResult = await client.query(
        `
        SELECT
          id,
          product_id,
          image_url,
          is_primary
        FROM product_images
        WHERE id = $1
          AND product_id = $2
        `,
        [imageId, productId]
      );

      if (imageResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Product image not found.",
        });
      }

      const image = imageResult.rows[0];

      // Delete image record
      await client.query(
        `
        DELETE FROM product_images
        WHERE id = $1
          AND product_id = $2
        `,
        [imageId, productId]
      );

      // Find the next available image
      const remainingResult =
        await client.query(
          `
          SELECT
            id,
            image_url,
            is_primary
          FROM product_images
          WHERE product_id = $1
          ORDER BY
            is_primary DESC,
            display_order ASC,
            id ASC
          LIMIT 1
          `,
          [productId]
        );

      let newPrimaryImage = null;

      if (
        remainingResult.rows.length > 0
      ) {
        newPrimaryImage =
          remainingResult.rows[0];

        /*
          If deleted image was primary,
          make the next available image primary.
        */
        if (image.is_primary) {
          await client.query(
            `
            UPDATE product_images
            SET is_primary = FALSE
            WHERE product_id = $1
            `,
            [productId]
          );

          await client.query(
            `
            UPDATE product_images
            SET is_primary = TRUE
            WHERE id = $1
            `,
            [newPrimaryImage.id]
          );
        }

        /*
          Get the actual current primary image.
        */
        const primaryResult =
          await client.query(
            `
            SELECT image_url
            FROM product_images
            WHERE product_id = $1
              AND is_primary = TRUE
            ORDER BY id ASC
            LIMIT 1
            `,
            [productId]
          );

        let coverImageUrl;

        if (
          primaryResult.rows.length > 0
        ) {
          coverImageUrl =
            primaryResult.rows[0].image_url;
        } else {
          /*
            Safety fallback if somehow
            no image is marked primary.
          */

          await client.query(
            `
            UPDATE product_images
            SET is_primary = TRUE
            WHERE id = $1
            `,
            [newPrimaryImage.id]
          );

          coverImageUrl =
            newPrimaryImage.image_url;
        }

        await client.query(
          `
          UPDATE products
          SET
            image_url = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [
            coverImageUrl,
            productId,
          ]
        );
      } else {
        // Product has no images left
        await client.query(
          `
          UPDATE products
          SET
            image_url = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          `,
          [productId]
        );
      }

      await client.query("COMMIT");

    

      // ========================================
      // DELETE ACTUAL LOCAL IMAGE FILE
      // ========================================

      try {
        if (
          image.image_url &&
          image.image_url.startsWith(
            "/uploads/products/"
          )
        ) {
          const fileName =
            path.basename(
              image.image_url
            );

          const filePath = path.join(
            __dirname,
            "Uploads",
            "products",
            fileName
          );

          fs.unlink(
            filePath,
            (unlinkError) => {
              if (
                unlinkError &&
                unlinkError.code !==
                  "ENOENT"
              ) {
                console.error(
                  "Image file delete error:",
                  unlinkError
                );
              }
            }
          );
        }
      } catch (fileError) {
        console.error(
          "Local image cleanup error:",
          fileError
        );
      }

      return res.json({
        success: true,
        message:
          "Product image deleted successfully.",
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Delete product image error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete product image.",
      });
    } finally {
      client.release();
    }
  }
);

// ========================================
// ADMIN - GET ALL ORDERS
// ========================================

app.get(
  "/api/admin/orders",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const ordersResult = await pool.query(`
        SELECT
          o.id,
          o.user_id,
          o.full_name,
          o.phone,
          o.email,
          o.address,
          o.city,
          o.state,
          o.pincode,
          o.order_note,
          o.subtotal,
          o.shipping_charge,
          o.total_amount,
          o.payment_method,
          o.payment_status,
          o.order_status,
          o.courier_name,
          o.tracking_number,
          o.payment_gateway,
          o.razorpay_order_id,
          o.razorpay_payment_id,
          o.created_at,
          o.updated_at
       FROM orders o
        WHERE
          o.payment_method = 'cod'
          OR o.payment_status = 'paid'
        ORDER BY o.created_at DESC
      `);

      const orders = [];

      for (const order of ordersResult.rows) {
        const itemsResult = await pool.query(
          `
          SELECT
            oi.id,
            oi.product_id,
            oi.product_name,
            oi.size,
            oi.color,
            oi.quantity,
            oi.unit_price,
            oi.line_total,
            p.image_url
          FROM order_items oi
          LEFT JOIN products p
            ON p.id = oi.product_id
          WHERE oi.order_id = $1
          ORDER BY oi.id ASC
          `,
          [order.id]
        );

        orders.push({
          ...order,
          items: itemsResult.rows,
        });
      }

      return res.json({
        success: true,
        orders,
      });
    } catch (error) {
      console.error(
        "Admin orders fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load admin orders.",
      });
    }
  }
);

// ========================================
// ADMIN - UPDATE ORDER STATUS
// ========================================

app.put(
  "/api/admin/orders/:id/status",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const orderId =
        Number(req.params.id);

      const {
        orderStatus,
      } = req.body;

      if (
        !Number.isInteger(orderId)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order ID.",
        });
      }

      const allowedStatuses = [
        "order_placed",
        "confirmed",
        "packed",
        "shipped",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ];

      if (
        !allowedStatuses.includes(
          orderStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order status.",
        });
      }

      await client.query("BEGIN");

      const existingOrderResult =
        await client.query(
          `
          SELECT
            id,
            payment_method,
            payment_status,
            order_status,
            courier_name,
            tracking_number,
            stock_restored
          FROM orders
          WHERE id = $1
          FOR UPDATE
          `,
          [orderId]
        );

      if (
        existingOrderResult.rows.length ===
        0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      const existingOrder =
        existingOrderResult.rows[0];

      // ========================================
      // SHIPPING VALIDATION
      // ========================================

      const shippingStatuses = [
        "shipped",
        "out_for_delivery",
        "delivered",
      ];

      if (
        shippingStatuses.includes(
          orderStatus
        )
      ) {
        if (
          !existingOrder.courier_name ||
          !existingOrder.courier_name.trim()
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            success: false,
            message:
              "Please assign a courier before marking this order as shipped.",
          });
        }

        if (
          !existingOrder.tracking_number ||
          !existingOrder.tracking_number.trim()
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            success: false,
            message:
              "Please add a tracking / AWB number before marking this order as shipped.",
          });
        }
      }

      // ========================================
      // CANCELLED ORDER RULE
      // ========================================

      if (
        existingOrder.order_status ===
          "cancelled" &&
        orderStatus !== "cancelled"
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          success: false,
          message:
            "A cancelled order cannot be moved to another status.",
        });
      }

      // ========================================
      // DELIVERED ORDER RULE
      // ========================================

      if (
        existingOrder.order_status ===
          "delivered" &&
        orderStatus !== "delivered"
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          success: false,
          message:
            "A delivered order cannot be moved back to another status.",
        });
      }

      // ========================================
      // RESTORE STOCK ON CANCELLATION
      // ========================================

      if (
        orderStatus === "cancelled" &&
        existingOrder.order_status !==
          "cancelled" &&
        !existingOrder.stock_restored
      ) {
        const itemsResult =
          await client.query(
            `
            SELECT
              product_id,
              quantity
            FROM order_items
            WHERE order_id = $1
            `,
            [orderId]
          );

        for (
          const item
          of itemsResult.rows
        ) {
          await client.query(
            `
            UPDATE products
            SET
              stock =
                stock + $1,
              updated_at =
                CURRENT_TIMESTAMP
            WHERE id = $2
            `,
            [
              item.quantity,
              item.product_id,
            ]
          );
        }

        await client.query(
          `
          UPDATE orders
          SET
            stock_restored = TRUE
          WHERE id = $1
          `,
          [orderId]
        );
      }

      // ========================================
      // PAYMENT STATUS LOGIC
      // ========================================

      let newPaymentStatus =
        existingOrder.payment_status;

      if (
        orderStatus === "delivered" &&
        existingOrder.payment_method ===
          "cod"
      ) {
        newPaymentStatus = "paid";
      }

      // ========================================
      // UPDATE ORDER
      // ========================================

      const updatedOrderResult =
        await client.query(
          `
          UPDATE orders
          SET
            order_status = $1,
            payment_status = $2,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING
            id,
            order_status,
            payment_status,
            courier_name,
            tracking_number,
            stock_restored,
            updated_at
          `,
          [
            orderStatus,
            newPaymentStatus,
            orderId,
          ]
        );

      await client.query(
        "COMMIT"
      );

      const updatedOrder =
        updatedOrderResult.rows[0];

      return res.json({
        success: true,

        message:
          orderStatus === "cancelled"
            ? "Order cancelled and stock restored successfully."
            : orderStatus ===
                "delivered" &&
              existingOrder
                .payment_method ===
                "cod"
            ? "Order marked as delivered and COD payment marked as paid."
            : "Order status updated successfully.",

        order:
          updatedOrder,
      });

    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // Ignore rollback error
      }

      console.error(
        "Admin update order status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update order status.",
      });

    } finally {
      client.release();
    }
  }
);
// ========================================
// ADMIN - UPDATE SHIPPING / TRACKING
// ========================================

app.put(
  "/api/admin/orders/:id/tracking",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const orderId = Number(req.params.id);

      const {
        courierName,
        trackingNumber,
      } = req.body;

      if (!Number.isInteger(orderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID.",
        });
      }

      const cleanCourierName =
        courierName?.trim() || null;

      const cleanTrackingNumber =
        trackingNumber?.trim() || null;

      const existingOrder =
        await pool.query(
          `
          SELECT
            id,
            courier_name,
            tracking_number
          FROM orders
          WHERE id = $1
          `,
          [orderId]
        );

      if (
        existingOrder.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      const result =
        await pool.query(
          `
          UPDATE orders
          SET
            courier_name = $1,
            tracking_number = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          RETURNING
            id,
            courier_name,
            tracking_number,
            updated_at
          `,
          [
            cleanCourierName,
            cleanTrackingNumber,
            orderId,
          ]
        );

      return res.json({
        success: true,
        message:
          "Shipping and tracking details saved successfully.",
        order: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Admin update shipping/tracking error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update shipping and tracking details.",
      });
    }
  }
);

// ========================================
// ADMIN - GET ALL SHIPMENTS
// ========================================

app.get(
  "/api/admin/shipments",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          s.id,
          s.order_id,
          s.courier_name,
          s.shipment_provider,
          s.provider_shipment_id,
          s.awb_number,
          s.tracking_url,
          s.shipment_status,
          s.weight,
          s.length,
          s.width,
          s.height,
          s.shipping_cost,
          s.pickup_scheduled,
          s.pickup_date,
          s.shipped_at,
          s.delivered_at,
          s.created_at,
          s.updated_at,

          o.full_name,
          o.phone,
          o.email,
          o.address,
          o.city,
          o.state,
          o.pincode,
          o.payment_method,
          o.payment_status,
          o.order_status,
          o.total_amount

        FROM shipments s

        JOIN orders o
          ON o.id = s.order_id

        ORDER BY s.created_at DESC
      `);

      return res.json({
        success: true,
        shipments: result.rows,
      });

    } catch (error) {
      console.error(
        "Admin shipments fetch error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load shipments.",
      });
    }
  }
);

// ========================================
// ADMIN - CREATE SHIPMENT
// ========================================

app.post(
  "/api/admin/shipments",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        orderId,
        shipmentProvider,
        courierName,
        providerShipmentId,
        awbNumber,
        trackingUrl,
        shipmentStatus,
        weight,
        length,
        width,
        height,
        shippingCost,
      } = req.body;

      // =========================
      // BASIC VALIDATION
      // =========================

      const parsedOrderId = Number(orderId);

      if (!Number.isInteger(parsedOrderId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID.",
        });
      }

      if (!shipmentProvider?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Shipment provider is required.",
        });
      }

      // =========================
      // CHECK ORDER EXISTS
      // =========================

      const orderResult =
        await pool.query(
          `
          SELECT
            id,
            order_status,
            payment_method,
            payment_status
          FROM orders
          WHERE id = $1
          `,
          [parsedOrderId]
        );

      if (orderResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      const order = orderResult.rows[0];

      // =========================
      // DO NOT CREATE FOR
      // CANCELLED / DELIVERED
      // =========================

      if (
        order.order_status ===
          "cancelled" ||
        order.order_status ===
          "delivered"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "A shipment cannot be created for a cancelled or delivered order.",
        });
      }

      // =========================
      // CHECK EXISTING SHIPMENT
      // =========================

      const existingShipment =
        await pool.query(
          `
          SELECT id
          FROM shipments
          WHERE order_id = $1
          LIMIT 1
          `,
          [parsedOrderId]
        );

      if (
        existingShipment.rows.length > 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            "A shipment already exists for this order.",
        });
      }

      // =========================
      // CREATE SHIPMENT
      // =========================

      const result =
        await pool.query(
          `
          INSERT INTO shipments (
            order_id,
            shipment_provider,
            courier_name,
            provider_shipment_id,
            awb_number,
            tracking_url,
            shipment_status,
            weight,
            length,
            width,
            height,
            shipping_cost
          )
          VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12
          )
          RETURNING *
          `,
          [
            parsedOrderId,

            shipmentProvider.trim(),

            courierName?.trim() || null,

            providerShipmentId?.trim() ||
              null,

            awbNumber?.trim() || null,

            trackingUrl?.trim() || null,

            shipmentStatus?.trim() ||
              "pending",

            weight || null,

            length || null,

            width || null,

            height || null,

            shippingCost || null,
          ]
        );

      const shipment =
        result.rows[0];

      // =========================
      // SYNC ORDER COURIER / AWB
      // =========================

      if (
        shipment.courier_name ||
        shipment.awb_number
      ) {
        await pool.query(
          `
          UPDATE orders
          SET
            courier_name = COALESCE($1, courier_name),
            tracking_number = COALESCE($2, tracking_number),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
          `,
          [
            shipment.courier_name,
            shipment.awb_number,
            parsedOrderId,
          ]
        );
      }

      return res.status(201).json({
        success: true,
        message:
          "Shipment created successfully.",
        shipment,
      });

    } catch (error) {
      console.error(
        "Admin create shipment error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to create shipment.",
      });
    }
  }
);

// ========================================
// ADMIN - GET ORDERS READY FOR SHIPPING
// ========================================

app.get(
  "/api/admin/shipping/ready-orders",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          o.id,
          o.full_name,
          o.phone,
          o.email,

          o.address,
          o.city,
          o.state,
          o.pincode,

          o.subtotal,
          o.shipping_charge,
          o.total_amount,

          o.payment_method,
          o.payment_status,
          o.order_status,

          o.courier_name,
          o.tracking_number,

          o.created_at,
          o.updated_at,

          COALESCE(
            json_agg(
              json_build_object(
                'id', oi.id,
                'product_id', oi.product_id,
                'product_name', oi.product_name,
                'size', oi.size,
                'color', oi.color,
                'quantity', oi.quantity,
                'unit_price', oi.unit_price,
                'line_total', oi.line_total
              )
              ORDER BY oi.id
            )
            FILTER (
              WHERE oi.id IS NOT NULL
            ),
            '[]'
          ) AS items

        FROM orders o

        LEFT JOIN order_items oi
          ON oi.order_id = o.id

        LEFT JOIN shipments s
          ON s.order_id = o.id

        WHERE
          s.id IS NULL

          AND o.order_status IN (
            'confirmed',
            'packed'
          )

        GROUP BY o.id

        ORDER BY o.created_at ASC
      `);

      return res.json({
        success: true,
        orders: result.rows,
      });

    } catch (error) {
      console.error(
        "Admin ready shipping orders error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load orders ready for shipping.",
      });
    }
  }
);

// ========================================
// ADMIN - UPDATE SHIPMENT
// ========================================

app.put(
  "/api/admin/shipments/:id",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const shipmentId = Number(req.params.id);

      const {
        awbNumber,
        trackingUrl,
        shipmentStatus,
        shippingCost,
        pickupScheduled,
        pickupDate,
        shippedAt,
        deliveredAt,
      } = req.body;

      // =========================
      // VALIDATE ID
      // =========================

      if (!Number.isInteger(shipmentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid shipment ID.",
        });
      }

      // =========================
      // VALIDATE STATUS
      // =========================

      const allowedStatuses = [
        "pending",
        "created",
        "pickup_scheduled",
        "picked_up",
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ];

      if (
        shipmentStatus !== undefined &&
        !allowedStatuses.includes(shipmentStatus)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid shipment status.",
        });
      }

      // =========================
      // VALIDATE SHIPPING COST
      // =========================

      let numericShippingCost;

      if (
        shippingCost !== undefined &&
        shippingCost !== null &&
        shippingCost !== ""
      ) {
        numericShippingCost = Number(shippingCost);

        if (
          Number.isNaN(numericShippingCost) ||
          numericShippingCost < 0
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid shipping cost.",
          });
        }
      }

      if (
        pickupScheduled !== undefined &&
        typeof pickupScheduled !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid pickup scheduled value.",
        });
      }

      await client.query("BEGIN");

      // =========================
      // CHECK SHIPMENT EXISTS
      // =========================

      const existingResult = await client.query(
        `
        SELECT *
        FROM shipments
        WHERE id = $1
        FOR UPDATE
        `,
        [shipmentId]
      );

      if (existingResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Shipment not found.",
        });
      }

      const existingShipment = existingResult.rows[0];

      const nextShipmentStatus =
        shipmentStatus !== undefined
          ? shipmentStatus
          : existingShipment.shipment_status;

      const cleanAwbNumber =
        awbNumber === undefined
          ? existingShipment.awb_number
          : awbNumber?.trim() || null;

      const cleanTrackingUrl =
        trackingUrl === undefined
          ? existingShipment.tracking_url
          : trackingUrl?.trim() || null;

      const nextShippingCost =
        numericShippingCost !== undefined
          ? numericShippingCost
          : shippingCost === null || shippingCost === ""
            ? null
            : existingShipment.shipping_cost;

      const nextPickupScheduled =
        pickupScheduled !== undefined
          ? pickupScheduled
          : existingShipment.pickup_scheduled;

      const nextPickupDate =
        pickupDate === undefined
          ? existingShipment.pickup_date
          : pickupDate || null;

      const nextShippedAt =
        shippedAt === undefined
          ? existingShipment.shipped_at
          : shippedAt || null;

      const nextDeliveredAt =
        deliveredAt === undefined
          ? existingShipment.delivered_at
          : deliveredAt || null;

      // Shipping stages that should have an AWB.
      const awbRequiredStatuses = [
        "shipped",
        "in_transit",
        "out_for_delivery",
        "delivered",
      ];

      if (
        awbRequiredStatuses.includes(nextShipmentStatus) &&
        !cleanAwbNumber
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "AWB number is required before a shipment can be marked as shipped or later.",
        });
      }

      // =========================
      // CHECK RELATED ORDER
      // =========================

      const orderResult = await client.query(
        `
        SELECT
          id,
          order_status,
          payment_method,
          payment_status
        FROM orders
        WHERE id = $1
        FOR UPDATE
        `,
        [existingShipment.order_id]
      );

      if (orderResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Related order not found.",
        });
      }

      const order = orderResult.rows[0];

      if (
        order.order_status === "delivered" &&
        nextShipmentStatus !== "delivered"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "A delivered order cannot be moved back to another shipment status.",
        });
      }

      if (
        order.order_status === "cancelled" &&
        nextShipmentStatus !== "cancelled"
      ) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message:
            "A cancelled order cannot be moved to another shipment status.",
        });
      }

      // =========================
      // UPDATE SHIPMENT
      // =========================

      const result = await client.query(
        `
        UPDATE shipments
        SET
          courier_name = 'Ekart',
          shipment_provider = 'Ekart',
          awb_number = $1,
          tracking_url = $2,
          shipment_status = $3,
          shipping_cost = $4,
          pickup_scheduled = $5,
          pickup_date = $6,
          shipped_at = $7,
          delivered_at = $8,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $9
        RETURNING *
        `,
        [
          cleanAwbNumber,
          cleanTrackingUrl,
          nextShipmentStatus,
          nextShippingCost,
          nextPickupScheduled,
          nextPickupDate,
          nextShippedAt,
          nextDeliveredAt,
          shipmentId,
        ]
      );

      const updatedShipment = result.rows[0];

      // =========================
      // MAP SHIPMENT -> ORDER STATUS
      // =========================

      let orderStatusToSet = null;

      switch (updatedShipment.shipment_status) {
        case "pending":
        case "created":
          orderStatusToSet = null;
          break;

        case "pickup_scheduled":
        case "picked_up":
          orderStatusToSet = "packed";
          break;

        case "shipped":
        case "in_transit":
          orderStatusToSet = "shipped";
          break;

        case "out_for_delivery":
          orderStatusToSet = "out_for_delivery";
          break;

        case "delivered":
          orderStatusToSet = "delivered";
          break;

        case "cancelled":
          orderStatusToSet = "cancelled";
          break;

        default:
          orderStatusToSet = null;
      }

      // =========================
      // UPDATE RELATED ORDER ONCE
      // =========================

      let paymentStatus = order.payment_status;

      if (
        orderStatusToSet === "delivered" &&
        order.payment_method === "cod"
      ) {
        paymentStatus = "paid";
      }

      if (orderStatusToSet) {
        await client.query(
          `
          UPDATE orders
          SET
            order_status = $1,
            payment_status = $2,
            courier_name = 'Ekart',
            tracking_number = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
          `,
          [
            orderStatusToSet,
            paymentStatus,
            updatedShipment.awb_number,
            updatedShipment.order_id,
          ]
        );
      } else {
        // Pending/created shipment: sync Ekart + AWB only,
        // without changing the order's current status.
        await client.query(
          `
          UPDATE orders
          SET
            courier_name = 'Ekart',
            tracking_number = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [
            updatedShipment.awb_number,
            updatedShipment.order_id,
          ]
        );
      }

      await client.query("COMMIT");

      return res.json({
        success: true,
        message: "Shipment updated successfully.",
        shipment: updatedShipment,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Admin update shipment error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Failed to update shipment.",
      });
    } finally {
      client.release();
    }
  }
);

// =========================
// FORGOT PASSWORD
// =========================

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    const userResult = await pool.query(
      `
      SELECT
        id,
        full_name,
        email,
        is_active
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "This account is disabled.",
      });
    }

    // Remove previous reset OTPs
    await pool.query(
      `
      DELETE FROM password_reset_otps
      WHERE user_id = $1
      `,
      [user.id]
    );

    // Generate new OTP
    const otp = generateOtp();

    const otpHash = await bcrypt.hash(
      otp,
      10
    );

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000
    );

    const otpResult = await pool.query(
      `
      INSERT INTO password_reset_otps (
        user_id,
        otp_hash,
        expires_at
      )
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [
        user.id,
        otpHash,
        expiresAt,
      ]
    );

    try {
      await sendPasswordResetOtpEmail(
        user,
        otp
      );
    } catch (emailError) {
      // Remove OTP if email could not be sent
      await pool.query(
        `
        DELETE FROM password_reset_otps
        WHERE id = $1
        `,
        [otpResult.rows[0].id]
      );

      console.error(
        "Password reset email error:",
        emailError
      );

      return res.status(500).json({
        success: false,
        message:
          "Password reset email could not be sent.",
      });
    }

    res.json({
      success: true,
      message:
        "Password reset OTP has been sent to your email.",
    });

  } catch (error) {
    console.error(
      "Forgot password error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to process password reset request.",
    });
  }
});

// =========================
// RESET PASSWORD
// =========================

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const {
      email,
      otp,
      newPassword,
    } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message:
          "Email, OTP and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 6 characters long.",
      });
    }

    const normalizedEmail =
      email.trim().toLowerCase();

    // Find user
    const userResult = await pool.query(
      `
      SELECT
        id,
        email,
        is_active
      FROM users
      WHERE email = $1
      `,
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message:
          "This account is currently disabled.",
      });
    }

    // Get latest reset OTP
    const otpResult = await pool.query(
      `
      SELECT *
      FROM password_reset_otps
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [user.id]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No password reset OTP found.",
      });
    }

    const otpRecord =
      otpResult.rows[0];

    // Check expiry
    if (
      new Date() >
      new Date(otpRecord.expires_at)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "OTP has expired. Please request a new password reset OTP.",
      });
    }

    // Limit wrong attempts
    if (otpRecord.attempts >= 5) {
      return res.status(429).json({
        success: false,
        message:
          "Too many incorrect attempts. Please request a new OTP.",
      });
    }

    // Compare entered OTP
    const otpMatches =
      await bcrypt.compare(
        otp.toString(),
        otpRecord.otp_hash
      );

    if (!otpMatches) {
      await pool.query(
        `
        UPDATE password_reset_otps
        SET attempts = attempts + 1
        WHERE id = $1
        `,
        [otpRecord.id]
      );

      return res.status(400).json({
        success: false,
        message: "Invalid OTP.",
      });
    }

    // Hash new password
    const newPasswordHash =
      await bcrypt.hash(
        newPassword,
        12
      );

    // Update password
    await pool.query(
      `
      UPDATE users
      SET
        password_hash = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [
        newPasswordHash,
        user.id,
      ]
    );

    // Delete used reset OTP
    await pool.query(
      `
      DELETE FROM password_reset_otps
      WHERE user_id = $1
      `,
      [user.id]
    );

    res.json({
      success: true,
      message:
        "Password reset successfully.",
    });

  } catch (error) {
    console.error(
      "Reset password error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to reset password.",
    });
  }
});

// ========================================
// EKART AUTH TEST
// ========================================

const {
  getEkartAccessToken,
  createEkartShipment,
  checkEkartServiceability,
  trackEkartShipment,
  normalizeEkartStatus,
  mapEkartTrackingToOrderStatus,
} = require("./services/ekartService");

app.get(
  "/api/admin/ekart/test-auth",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const token =
        await getEkartAccessToken();

      return res.json({
        success: true,
        message:
          "Ekart authentication successful.",
        tokenReceived:
          Boolean(token),
      });

    } catch (error) {
      console.error(
        "Ekart auth test error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Ekart authentication failed.",
      });
    }
  }
);

// ========================================
// PREVIEW EKART SHIPMENT PAYLOAD
// DOES NOT CREATE A REAL SHIPMENT
// ========================================

app.get(
  "/api/admin/ekart/preview/:orderId",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const orderId =
        Number(req.params.orderId);

      if (
        !Number.isInteger(orderId) ||
        orderId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order ID.",
        });
      }

      // -------------------------------
      // GET ORDER
      // -------------------------------

      const orderResult =
        await pool.query(
          `
          SELECT *
          FROM orders
          WHERE id = $1
          `,
          [orderId]
        );

      if (
        orderResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Order not found.",
        });
      }

      const order =
        orderResult.rows[0];

      // -------------------------------
      // GET ORDER ITEMS
      // -------------------------------

      const itemsResult =
        await pool.query(
          `
          SELECT *
          FROM order_items
          WHERE order_id = $1
          ORDER BY id ASC
          `,
          [orderId]
        );

      if (
        itemsResult.rows.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Order has no items.",
        });
      }

      // -------------------------------
      // BUILD EKART PAYLOAD
      // -------------------------------

      const {
  weight,
  length,
  width,
  height,
} = req.query;

const payload =
  buildEkartShipmentPayload({
    order,
    items:
      itemsResult.rows,

    packageDetails: {
      weight:
        Number(weight),

      length:
        Number(length),

      width:
        Number(width),

      height:
        Number(height),
    },
  });

      return res.json({
        success: true,

        message:
          "Ekart shipment payload preview generated. No shipment was created.",

        orderId,

        payload,
      });

    } catch (error) {
      console.error(
        "Ekart payload preview error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          error.message ||
          "Failed to build Ekart payload.",
      });
    }
  }
);

// ========================================
// EKART SERVICEABILITY TEST
// ========================================

app.get(
  "/api/admin/ekart/serviceability/:pincode",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const { pincode } =
        req.params;

      const result =
        await checkEkartServiceability(
          pincode
        );

      return res.json({
        success: true,
        pincode,
        ekart: result,
      });

    } catch (error) {
      console.error(
        "Ekart serviceability route error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to check serviceability.",
      });
    }
  }
);

// ========================================
// CREATE REAL EKART SHIPMENT
// ========================================

app.post(
  "/api/admin/ekart/create-shipment/:orderId",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const orderId =
        Number(req.params.orderId);
      const {
        weight,
        length,
        width,
        height,
      } = req.body;
        if (
  !weight ||
  Number(weight) <= 0 ||
  !length ||
  Number(length) <= 0 ||
  !width ||
  Number(width) <= 0 ||
  !height ||
  Number(height) <= 0
) {
  return res.status(400).json({
    success: false,
    message:
      "Valid package weight and dimensions are required.",
  });
}
      if (
        !Number.isInteger(orderId) ||
        orderId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid order ID.",
        });
      }

      // =====================================
      // 1. GET ORDER
      // =====================================

      const orderResult =
        await client.query(
          `
          SELECT *
          FROM orders
          WHERE id = $1
          `,
          [orderId]
        );

      if (
        orderResult.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "Order not found.",
        });
      }

      const order =
        orderResult.rows[0];

      // =====================================
      // 2. VALIDATE ORDER STATUS
      // =====================================

      if (
        !["confirmed", "packed"].includes(
          order.order_status
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Only confirmed or packed orders can be sent to Ekart.",
        });
      }

      // =====================================
      // 3. VALIDATE PREPAID PAYMENT
      // =====================================

      if (
        order.payment_method !== "cod" &&
        order.payment_status !== "paid"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Prepaid order must be paid before shipment creation.",
        });
      }

      // =====================================
      // 4. BLOCK DUPLICATE SHIPMENT
      // =====================================

      const existingShipment =
        await client.query(
          `
          SELECT id
          FROM shipments
          WHERE order_id = $1
          LIMIT 1
          `,
          [orderId]
        );

      if (
        existingShipment.rows.length > 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            "A shipment already exists for this order.",
        });
      }

      // =====================================
      // 5. GET ORDER ITEMS
      // =====================================

      const itemsResult =
        await client.query(
          `
          SELECT *
          FROM order_items
          WHERE order_id = $1
          ORDER BY id ASC
          `,
          [orderId]
        );

      if (
        itemsResult.rows.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Order has no items.",
        });
      }

      // =====================================
      // 6. CHECK SERVICEABILITY
      // =====================================

      const serviceability =
        await checkEkartServiceability(
          order.pincode
        );

      if (
        !serviceability?.status ||
        !serviceability?.details?.forward_drop
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Customer pincode is not serviceable for forward delivery.",
        });
      }

      // COD-specific check
      if (
        order.payment_method === "cod"
      ) {
        if (
          !serviceability.details.cod
        ) {
          return res.status(400).json({
            success: false,
            message:
              "COD is not available for this pincode.",
          });
        }

        const maxCodAmount =
          Number(
            serviceability.details
              .max_cod_amount || 0
          );

        if (
          Number(order.total_amount) >
          maxCodAmount
        ) {
          return res.status(400).json({
            success: false,
            message:
              `COD amount exceeds Ekart's maximum COD limit of ₹${maxCodAmount}.`,
          });
        }
      }

      // =====================================
      // 7. BUILD EKART PAYLOAD
      // =====================================
      
      const payload =
  buildEkartShipmentPayload({
    order,
    items:
      itemsResult.rows,

    packageDetails: {
      weight:
        Number(weight),

      length:
        Number(length),

      width:
        Number(width),

      height:
        Number(height),
    },
  });

      // =====================================
      // 8. CREATE SHIPMENT WITH EKART
      // =====================================

      const ekartResult =
        await createEkartShipment(
          payload
        );

      const trackingId =
        ekartResult.trackingId;

      const awbNumber =
        ekartResult.awbNumber ||
        trackingId;

      const courierName =
        ekartResult.vendor ||
        "EKART";

      const trackingUrl =
        `https://app.elite.ekartlogistics.in/track/${encodeURIComponent(
          trackingId
        )}`;

      // =====================================
      // 9. SAVE EVERYTHING LOCALLY
      // =====================================

      await client.query("BEGIN");

      const shipmentResult =
        await client.query(
          `
          INSERT INTO shipments
          (
            order_id,
            courier_name,
            shipment_provider,
            provider_shipment_id,
            awb_number,
            tracking_url,
            shipment_status,
            weight,
            length,
            width,
            height,
            pickup_scheduled,
            created_at,
            updated_at
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING *
          `,
          [
            orderId,
            courierName,
            "Ekart",
            trackingId,
            awbNumber,
            trackingUrl,
            "created",
            payload.weight,
            payload.length,
            payload.width,
            payload.height,
            false,
          ]
        );

      await client.query(
        `
        UPDATE orders
        SET
          courier_name = $1,
          tracking_number = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        `,
        [
          courierName,
          trackingId,
          orderId,
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,

        message:
          "Ekart shipment created successfully.",

        shipment:
          shipmentResult.rows[0],

        ekart: {
          trackingId,
          awbNumber,
          courierName,
          trackingUrl,
        },
      });

    } catch (error) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // Ignore rollback error
      }

      console.error(
        "Ekart shipment creation route error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to create Ekart shipment.",

          ekartError:
    error.ekartResponse || null,

  ekartHttpStatus:
    error.ekartStatus || null,
      });

    } finally {
      client.release();
    }
  }
);



// ========================================
// GET LIVE EKART TRACKING STATUS
// ========================================

app.get(
  "/api/admin/ekart/track/:trackingId",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const trackingId =
        String(
          req.params.trackingId || ""
        ).trim();

      if (!trackingId) {
        return res.status(400).json({
          success: false,
          message:
            "Ekart tracking ID is required.",
        });
      }

      const trackingResult =
        await trackEkartShipment(
          trackingId
        );

      return res.status(200).json({
        success: true,
        message:
          "Ekart tracking status fetched successfully.",
        tracking: trackingResult,
      });

    } catch (error) {
      console.error(
        "Ekart tracking route error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to fetch Ekart tracking status.",
      });
    }
  }
);

// ========================================
// SYNC EKART SHIPMENT STATUS
// ========================================

app.post(
  "/api/admin/ekart/sync/:trackingId",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    let client;

    try {
      const trackingId = String(
        req.params.trackingId || ""
      ).trim();

      if (!trackingId) {
        return res.status(400).json({
          success: false,
          message:
            "Ekart tracking ID is required.",
        });
      }

      // =====================================
      // 1. GET LIVE EKART STATUS
      // =====================================

      const tracking =
        await trackEkartShipment(
          trackingId
        );

      const ekartStatus =
        tracking.status;

      const shipmentStatus =
        normalizeEkartStatus(
          ekartStatus
        );

      const mappedOrderStatus =
        mapEkartTrackingToOrderStatus(
          tracking
        );

      // =====================================
      // 2. START DATABASE TRANSACTION
      // =====================================

      client =
        await pool.connect();

      await client.query("BEGIN");

      // =====================================
      // 3. LOCK SHIPMENT
      // =====================================

      const shipmentResult =
        await client.query(
          `
          SELECT
            id,
            order_id,
            shipment_status,
            provider_shipment_id
          FROM shipments
          WHERE provider_shipment_id = $1
          FOR UPDATE
          `,
          [trackingId]
        );

      if (
        shipmentResult.rows.length === 0
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          success: false,
          message:
            "Shipment not found in Lana Wardrobe.",
        });
      }

      const shipment =
        shipmentResult.rows[0];

      // =====================================
      // 4. UPDATE SHIPMENT STATUS
      // =====================================

      const updatedShipmentResult =
        await client.query(
          `
          UPDATE shipments
          SET
            shipment_status = $1,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
          `,
          [
            shipmentStatus,
            shipment.id,
          ]
        );

      let updatedOrder = null;
      let orderStatusUpdated = false;

      // =====================================
      // 5. OPTIONAL ORDER STATUS SYNC
      // =====================================

      if (mappedOrderStatus) {
        const orderResult =
          await client.query(
            `
            SELECT
              id,
              payment_method,
              payment_status,
              order_status,
              courier_name,
              tracking_number,
              stock_restored
            FROM orders
            WHERE id = $1
            FOR UPDATE
            `,
            [shipment.order_id]
          );

        if (
          orderResult.rows.length === 0
        ) {
          await client.query(
            "ROLLBACK"
          );

          return res.status(404).json({
            success: false,
            message:
              "Order linked to shipment was not found.",
          });
        }

        const order =
          orderResult.rows[0];

        let shouldUpdateOrder = true;

        // =====================================
        // TERMINAL STATUS PROTECTION
        // =====================================

        if (
          order.order_status ===
            "cancelled" ||
          order.order_status ===
            "delivered"
        ) {
          shouldUpdateOrder = false;
        }

        // =====================================
        // PREVENT BACKWARD STATUS MOVEMENT
        // =====================================

        const statusRank = {
          order_placed: 1,
          confirmed: 2,
          packed: 3,
          shipped: 4,
          out_for_delivery: 5,
          delivered: 6,
        };

        if (
          mappedOrderStatus !==
            "cancelled" &&
          statusRank[
            order.order_status
          ] &&
          statusRank[
            mappedOrderStatus
          ] &&
          statusRank[
            mappedOrderStatus
          ] <=
            statusRank[
              order.order_status
            ]
        ) {
          shouldUpdateOrder = false;
        }

        // =====================================
        // SAFE AUTO-CANCELLATION
        // =====================================

        if (
          mappedOrderStatus ===
          "cancelled"
        ) {
          const cancellableStatuses = [
            "order_placed",
            "confirmed",
            "packed",
          ];

          if (
            !cancellableStatuses.includes(
              order.order_status
            )
          ) {
            shouldUpdateOrder = false;
          }
        }

        if (shouldUpdateOrder) {
          // =================================
          // SHIPPING VALIDATION
          // =================================

          const shippingStatuses = [
            "shipped",
            "out_for_delivery",
            "delivered",
          ];

          if (
            shippingStatuses.includes(
              mappedOrderStatus
            ) &&
            (
              !order.courier_name ||
              !order.tracking_number
            )
          ) {
            throw new Error(
              "Order cannot be automatically moved to a shipping status because courier or tracking information is missing."
            );
          }

          // =================================
          // RESTORE STOCK ON CANCELLATION
          // =================================

          if (
            mappedOrderStatus ===
              "cancelled" &&
            !order.stock_restored
          ) {
            const itemsResult =
              await client.query(
                `
                SELECT
                  product_id,
                  quantity
                FROM order_items
                WHERE order_id = $1
                `,
                [order.id]
              );

            for (
              const item
              of itemsResult.rows
            ) {
              await client.query(
                `
                UPDATE products
                SET
                  stock =
                    stock + $1,
                  updated_at =
                    CURRENT_TIMESTAMP
                WHERE id = $2
                `,
                [
                  item.quantity,
                  item.product_id,
                ]
              );
            }

            await client.query(
              `
              UPDATE orders
              SET stock_restored = TRUE
              WHERE id = $1
              `,
              [order.id]
            );
          }

          // =================================
          // COD PAYMENT ON DELIVERY
          // =================================

          let paymentStatus =
            order.payment_status;

          if (
            mappedOrderStatus ===
              "delivered" &&
            order.payment_method ===
              "cod"
          ) {
            paymentStatus = "paid";
          }

          // =================================
          // UPDATE ORDER
          // =================================

          const updatedOrderResult =
            await client.query(
              `
              UPDATE orders
              SET
                order_status = $1,
                payment_status = $2,
                updated_at =
                  CURRENT_TIMESTAMP
              WHERE id = $3
              RETURNING
                id,
                order_status,
                payment_status,
                courier_name,
                tracking_number,
                stock_restored,
                updated_at
              `,
              [
                mappedOrderStatus,
                paymentStatus,
                order.id,
              ]
            );

          updatedOrder =
            updatedOrderResult.rows[0];

          orderStatusUpdated = true;
        }
      }

      // =====================================
      // 6. COMMIT EVERYTHING
      // =====================================

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,

        message:
          "Ekart shipment status synchronized successfully.",

        ekartStatus,

        shipmentStatus,

        mappedOrderStatus,

        orderStatusUpdated,

        tracking: {
          description:
            tracking.description,

          location:
            tracking.location,

          updatedAt:
            tracking.updatedAt,

          estimatedDelivery:
            tracking.estimatedDelivery,
        },

        shipment:
          updatedShipmentResult.rows[0],

        order:
          updatedOrder,
      });

    } catch (error) {
      if (client) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch {
          // Ignore rollback error
        }
      }

      console.error(
        "Ekart shipment sync error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          "Failed to synchronize Ekart shipment status.",
      });

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// ========================================
// SUBMIT PRODUCT REVIEW
// ========================================

app.post(
  "/api/products/:productId/reviews",
  authenticateUser,
  async (req, res) => {
    try {
      const productId = Number(
        req.params.productId
      );

      const userId = req.user.userId;

      const {
        rating,
        reviewTitle,
        reviewText,
      } = req.body;

      // -----------------------------
      // VALIDATE PRODUCT ID
      // -----------------------------

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid product ID.",
        });
      }

      // -----------------------------
      // VALIDATE RATING
      // -----------------------------

      const numericRating =
        Number(rating);

      if (
        !Number.isInteger(
          numericRating
        ) ||
        numericRating < 1 ||
        numericRating > 5
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Rating must be between 1 and 5.",
        });
      }

      // -----------------------------
      // CHECK PRODUCT EXISTS
      // -----------------------------

      const productResult =
        await pool.query(
          `
          SELECT id, name
          FROM products
          WHERE id = $1
          `,
          [productId]
        );

      if (
        productResult.rows.length ===
        0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Product not found.",
        });
      }

      // -----------------------------
      // CHECK DELIVERED PURCHASE
      // -----------------------------

      const purchaseResult =
        await pool.query(
          `
          SELECT
            o.id AS order_id
          FROM orders o
          INNER JOIN order_items oi
            ON oi.order_id = o.id
          WHERE
            o.user_id = $1
            AND oi.product_id = $2
            AND o.order_status = 'delivered'
          ORDER BY o.created_at DESC
          LIMIT 1
          `,
          [
            userId,
            productId,
          ]
        );

      if (
        purchaseResult.rows.length ===
        0
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can review this product only after a delivered purchase.",
        });
      }

      const orderId =
        purchaseResult.rows[0]
          .order_id;

      // -----------------------------
      // CHECK EXISTING REVIEW
      // -----------------------------

      const existingReview =
        await pool.query(
          `
          SELECT id
          FROM product_reviews
          WHERE
            user_id = $1
            AND product_id = $2
            AND order_id = $3
          LIMIT 1
          `,
          [
            userId,
            productId,
            orderId,
          ]
        );

      if (
        existingReview.rows.length > 0
      ) {
        return res.status(409).json({
          success: false,
          message:
            "You have already reviewed this product for this order.",
        });
      }

      // -----------------------------
      // INSERT REVIEW
      // -----------------------------

      const result =
        await pool.query(
          `
          INSERT INTO product_reviews
          (
            product_id,
            user_id,
            order_id,
            rating,
            review_title,
            review_text,
            is_verified_purchase,
            is_approved,
            created_at,
            updated_at
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            TRUE,
            TRUE,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )
          RETURNING *
          `,
          [
            productId,
            userId,
            orderId,
            numericRating,
            reviewTitle?.trim() ||
              null,
            reviewText?.trim() ||
              null,
          ]
        );

      return res.status(201).json({
        success: true,
        message:
          "Review submitted successfully.",
        review:
          result.rows[0],
      });

    } catch (error) {
      console.error(
        "Submit review error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to submit review.",
      });
    }
  }
);

// ========================================
// GET PRODUCT REVIEWS
// ========================================

app.get(
  "/api/products/:productId/reviews",
  async (req, res) => {
    try {
      const productId =
        Number(req.params.productId);

      if (
        !Number.isInteger(productId) ||
        productId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
      }

      // =====================================
      // GET APPROVED REVIEWS
      // =====================================

      const reviewsResult =
        await pool.query(
          `
          SELECT
            pr.id,
            pr.product_id,
            pr.rating,
            pr.review_title,
            pr.review_text,
            pr.is_verified_purchase,
            pr.created_at,
            u.full_name
          FROM product_reviews pr
          INNER JOIN users u
            ON u.id = pr.user_id
          WHERE
            pr.product_id = $1
            AND pr.is_approved = TRUE
          ORDER BY pr.created_at DESC
          `,
          [productId]
        );

      // =====================================
      // CALCULATE REVIEW SUMMARY
      // =====================================

      const summaryResult =
        await pool.query(
          `
          SELECT
            COUNT(*)::INTEGER
              AS total_reviews,

            COALESCE(
              ROUND(
                AVG(rating)::numeric,
                1
              ),
              0
            )
              AS average_rating,

            COUNT(*) FILTER (
              WHERE rating = 5
            )::INTEGER
              AS five_star,

            COUNT(*) FILTER (
              WHERE rating = 4
            )::INTEGER
              AS four_star,

            COUNT(*) FILTER (
              WHERE rating = 3
            )::INTEGER
              AS three_star,

            COUNT(*) FILTER (
              WHERE rating = 2
            )::INTEGER
              AS two_star,

            COUNT(*) FILTER (
              WHERE rating = 1
            )::INTEGER
              AS one_star

          FROM product_reviews

          WHERE
            product_id = $1
            AND is_approved = TRUE
          `,
          [productId]
        );

      return res.json({
        success: true,

        summary:
          summaryResult.rows[0],

        reviews:
          reviewsResult.rows,
      });

    } catch (error) {
      console.error(
        "Get product reviews error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load product reviews.",
      });
    }
  }
);

// ========================================
// ADMIN - GET ALL REVIEWS
// ========================================

app.get(
  "/api/admin/reviews",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          pr.id,
          pr.product_id,
          pr.user_id,
          pr.order_id,
          pr.rating,
          pr.review_title,
          pr.review_text,
          pr.is_verified_purchase,
          pr.is_approved,
          pr.created_at,
          pr.updated_at,

          p.name AS product_name,

          u.full_name,
          u.email

        FROM product_reviews pr

        INNER JOIN products p
          ON p.id = pr.product_id

        INNER JOIN users u
          ON u.id = pr.user_id

        ORDER BY pr.created_at DESC
        `
      );

      return res.json({
        success: true,
        reviews: result.rows,
      });

    } catch (error) {
      console.error(
        "Admin reviews error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load reviews.",
      });
    }
  }
);

// ========================================
// ADMIN - APPROVE / HIDE REVIEW
// ========================================

app.put(
  "/api/admin/reviews/:id/status",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const reviewId =
        Number(req.params.id);

      const {
        isApproved,
      } = req.body;

      if (
        !Number.isInteger(reviewId) ||
        reviewId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid review ID.",
        });
      }

      if (
        typeof isApproved !== "boolean"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "isApproved must be true or false.",
        });
      }

      const result =
        await pool.query(
          `
          UPDATE product_reviews
          SET
            is_approved = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING *
          `,
          [
            isApproved,
            reviewId,
          ]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message:
            "Review not found.",
        });
      }

      return res.json({
        success: true,
        message:
          isApproved
            ? "Review approved successfully."
            : "Review hidden successfully.",
        review:
          result.rows[0],
      });

    } catch (error) {
      console.error(
        "Update review status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update review status.",
      });
    }
  }
);

// ========================================
// ADMIN - DELETE REVIEW
// ========================================

app.delete(
  "/api/admin/reviews/:id",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const reviewId =
        Number(req.params.id);

      if (
        !Number.isInteger(reviewId) ||
        reviewId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid review ID.",
        });
      }

      const result =
        await pool.query(
          `
          DELETE FROM product_reviews
          WHERE id = $1
          RETURNING id
          `,
          [reviewId]
        );

      if (
        result.rows.length === 0
      ) {
        return res.status(404).json({
          success: false,
          message: "Review not found.",
        });
      }

      return res.json({
        success: true,
        message:
          "Review deleted successfully.",
        reviewId,
      });

    } catch (error) {
      console.error(
        "Delete review error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to delete review.",
      });
    }
  }
);

// ========================================
// ADMIN - GET ALL CUSTOMERS
// ========================================

app.get(
  "/api/admin/customers",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.is_active,
          u.email_verified,
          u.created_at,

          COUNT(o.id)::INTEGER AS total_orders,

          COALESCE(
            SUM(
              CASE
                WHEN o.order_status != 'cancelled'
                THEN o.total_amount
                ELSE 0
              END
            ),
            0
          ) AS total_spent

        FROM users u

        LEFT JOIN orders o
          ON o.user_id = u.id

        WHERE u.role = 'customer'

        GROUP BY
          u.id,
          u.full_name,
          u.email,
          u.phone,
          u.role,
          u.is_active,
          u.email_verified,
          u.created_at

        ORDER BY
          u.created_at DESC
        `
      );

      return res.json({
        success: true,
        customers: result.rows,
      });

    } catch (error) {
      console.error(
        "Admin customers error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to load customers.",
      });
    }
  }
);

// ========================================
// ADMIN - ACTIVATE / DEACTIVATE CUSTOMER
// ========================================

app.put(
  "/api/admin/customers/:id/status",
  authenticateUser,
  requireAdmin,
  async (req, res) => {
    try {
      const customerId = Number(req.params.id);
      const { isActive } = req.body;

      if (
        !Number.isInteger(customerId) ||
        customerId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid customer ID.",
        });
      }

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message:
            "isActive must be true or false.",
        });
      }

      const result = await pool.query(
        `
        UPDATE users
        SET is_active = $1
        WHERE id = $2
          AND role = 'customer'
        RETURNING
          id,
          full_name,
          email,
          is_active
        `,
        [isActive, customerId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Customer not found.",
        });
      }

      return res.json({
        success: true,
        message: isActive
          ? "Customer activated successfully."
          : "Customer deactivated successfully.",
        customer: result.rows[0],
      });

    } catch (error) {
      console.error(
        "Update customer status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to update customer status.",
      });
    }
  }
);

// ========================================
// AUTO-EXPIRE ABANDONED ONLINE ORDERS
// ========================================

let isExpiringOrders = false;

async function expirePendingOnlineOrders() {
  if (isExpiringOrders) {
    return;
  }

  isExpiringOrders = true;

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const expiredOrdersResult =
      await client.query(
        `
        SELECT
          id,
          razorpay_order_id
        FROM orders
        WHERE
          payment_method = 'online'
          AND payment_status IN ('pending', 'failed')
          AND order_status = 'order_placed'
          AND stock_restored = FALSE
          AND updated_at <
    CURRENT_TIMESTAMP
    - INTERVAL '15 minutes'
        FOR UPDATE SKIP LOCKED
        `
      );

    for (
      const order
      of expiredOrdersResult.rows
    ) {
            // ========================================
      // VERIFY RAZORPAY BEFORE EXPIRING ORDER
      // ========================================

      let safeToExpire = true;

      if (order.razorpay_order_id) {
        try {
          const razorpayOrder =
            await razorpay.orders.fetch(
              order.razorpay_order_id
            );

          const razorpayOrderStatus =
            String(
              razorpayOrder?.status || ""
            ).toLowerCase();

          // Razorpay already considers
          // the order fully paid.
          if (
            razorpayOrderStatus === "paid"
          ) {
            safeToExpire = false;
          }

          // At least one payment attempt
          // has happened. Inspect payments.
          else if (
            razorpayOrderStatus ===
            "attempted"
          ) {
            const payments =
              await razorpay.orders
                .fetchPayments(
                  order.razorpay_order_id
                );

            const paymentItems =
              Array.isArray(
                payments?.items
              )
                ? payments.items
                : [];

            // Unexpected/uncertain state:
            // keep the stock reserved.
            if (
              paymentItems.length === 0
            ) {
              safeToExpire = false;
            } else {
              const hasNonFailedPayment =
                paymentItems.some(
                  (payment) => {
                    const status =
                      String(
                        payment?.status ||
                          ""
                      ).toLowerCase();

                    return (
                      status !== "failed"
                    );
                  }
                );

              // captured, authorized,
              // created, or any unknown
              // non-failed payment means
              // we must not restore stock.
              if (hasNonFailedPayment) {
                safeToExpire = false;
              }
            }
          }

          // "created" is safe after our
          // 15-minute timeout because no
          // payment attempt was recorded.
          else if (
            razorpayOrderStatus !==
            "created"
          ) {
            // Unknown Razorpay status:
            // fail safely and preserve stock.
            safeToExpire = false;
          }

        } catch (error) {
          console.error(
            `Could not verify Razorpay status before expiring order #${order.id}:`,
            error
          );

          // If Razorpay cannot be checked,
          // do not risk restoring stock.
          safeToExpire = false;
        }
      }

      if (!safeToExpire) {
        console.log(
          `Skipped expiry for order #${order.id} because Razorpay payment activity may exist.`
        );

        continue;
      }
      const itemsResult =
        await client.query(
          `
          SELECT
            product_id,
            quantity
          FROM order_items
          WHERE order_id = $1
          `,
          [order.id]
        );

      for (
        const item
        of itemsResult.rows
      ) {
        await client.query(
          `
          UPDATE products
          SET
            stock =
              stock + $1,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [
            item.quantity,
            item.product_id,
          ]
        );
      }

      await client.query(
        `
        UPDATE orders
        SET
          order_status = 'cancelled',
          stock_restored = TRUE,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE
          id = $1
          AND payment_status IN ('pending', 'failed')
          AND order_status = 'order_placed'
          AND stock_restored = FALSE
        `,
        [order.id]
      );

      console.log(
        `Expired unpaid order #${order.id} and restored stock.`
      );
    }

    await client.query(
      "COMMIT"
    );

  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {
      // Ignore rollback error
    }

    console.error(
      "Expire pending orders error:",
      error
    );

  } finally {
    client.release();
    isExpiringOrders = false;
  }
}

// Check abandoned online orders every 60 seconds
setInterval(
  expirePendingOnlineOrders,
  60 * 1000
);

// Also check once when backend starts
expirePendingOnlineOrders();

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
  console.log(
    `Server is running on http://localhost:${PORT}`
  );
});