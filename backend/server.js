const multer = require("multer");
const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { Resend } = require("resend");
require("dotenv").config();
const Razorpay = require("razorpay");
const crypto = require("crypto");

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
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const resend = new Resend(
  process.env.RESEND_API_KEY
);

const PORT = process.env.PORT || 5000;

// =========================
// MIDDLEWARE
// =========================

app.use(cors());
app.use(express.json());

// =========================
// DESIGN FILE UPLOAD SETUP && PRODUCT IMAGE UPLOAD SETUP  
// =========================

const designUploadDirectory = path.join(
  __dirname,
  "Uploads",
  "designs"
);

const productImageDirectory = path.join(
  __dirname,
  "Uploads",
  "products"
);

if (!fs.existsSync(productImageDirectory)) {
  fs.mkdirSync(productImageDirectory, {
    recursive: true,
  });
}

const productImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, productImageDirectory);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

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

const uploadProductImage = multer({
  storage: productImageStorage,
  fileFilter: productImageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

if (!fs.existsSync(designUploadDirectory)) {
  fs.mkdirSync(designUploadDirectory, {
    recursive: true,
  });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, designUploadDirectory);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
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

const uploadDesign = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

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
      "SELECT * FROM products ORDER BY id ASC"
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

      const designFileName = req.file
        ? req.file.originalname
        : null;

      const designFilePath = req.file
        ? `/uploads/designs/${req.file.filename}`
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

      res.status(201).json({
        success: true,
        message:
          "Bulk order request submitted successfully.",
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Bulk order request error:",
        error
      );

      res.status(500).json({
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

      const designFileName = req.file
        ? req.file.originalname
        : null;

      const designFilePath = req.file
        ? `/uploads/designs/${req.file.filename}`
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

      res.status(201).json({
        success: true,
        message:
          "Customization request submitted successfully.",
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        "Customization request error:",
        error
      );

      res.status(500).json({
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

      const shippingCharge =
        subtotal >= 999 ? 0 : 99;

      const totalAmount =
        subtotal + shippingCharge;

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
        WHERE user_id = $1
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
        stock,
        sizes,
        colors,
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

      const numericStock = Number(stock || 0);

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

      if (
        Number.isNaN(numericStock) ||
        numericStock < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid stock value.",
        });
      }

      const result = await pool.query(
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
          numericStock,
          Array.isArray(sizes) ? sizes : [],
          Array.isArray(colors) ? colors : [],
          Boolean(newArrival),
          Boolean(bestSeller),
          Boolean(featured),
        ]
      );

      res.status(201).json({
        success: true,
        message:
          "Product added successfully.",
        product: result.rows[0],
      });

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
        SELECT *
        FROM products
        WHERE id = $1
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
        stock,
        sizes,
        colors,
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

      const numericStock = Number(stock || 0);

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

      if (
        Number.isNaN(numericStock) ||
        numericStock < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid stock value.",
        });
      }

      const result = await pool.query(
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
          numericStock,
          Array.isArray(sizes) ? sizes : [],
          Array.isArray(colors) ? colors : [],
          Boolean(newArrival),
          Boolean(bestSeller),
          Boolean(featured),
          productId,
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Product not found.",
        });
      }

      res.json({
        success: true,
        message:
          "Product updated successfully.",
        product: result.rows[0],
      });
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
          message: "Please select at least one image.",
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

      await client.query("BEGIN");

      const existingImagesResult = await client.query(
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

      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];

        const imageUrl =
          `/uploads/products/${file.filename}`;

        const isPrimary =
          existingImagesResult.rows[0].count === 0 &&
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

      if (
        !productResult.rows[0].image_url &&
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
      await client.query("ROLLBACK");

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

      const payload =
        buildEkartShipmentPayload({
          order,
          items:
            itemsResult.rows,
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
          id
        FROM orders
        WHERE
          payment_method = 'online'
          AND payment_status = 'pending'
          AND order_status = 'order_placed'
          AND stock_restored = FALSE
          AND created_at <
              CURRENT_TIMESTAMP
              - INTERVAL '15 minutes'
        FOR UPDATE SKIP LOCKED
        `
      );

    for (
      const order
      of expiredOrdersResult.rows
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
        SET
          order_status = 'cancelled',
          stock_restored = TRUE,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE
          id = $1
          AND payment_status = 'pending'
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

