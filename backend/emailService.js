const { Resend } = require("resend");

const resend = new Resend(
  process.env.RESEND_API_KEY
);

async function sendPasswordResetOtpEmail(
  user,
  otp
) {
  const { error } = await resend.emails.send({
    from:
      "Lana Wardrobe <no-reply@lanawardrobe.in>",

    to: [user.email],

    subject:
      "Reset your Lana Wardrobe password",

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
        <h2 style="text-align: center;">
          LANA WARDROBE
        </h2>

        <p>
          Hi ${user.full_name},
        </p>

        <p>
          We received a request to reset
          your Lana Wardrobe password.
        </p>

        <p>
          Your password reset code is:
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
          If you didn't request a password
          reset, you can ignore this email.
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

  if (error) {
    throw new Error(
      error.message ||
      "Failed to send password reset email."
    );
  }
}

module.exports = {
  sendPasswordResetOtpEmail,
};