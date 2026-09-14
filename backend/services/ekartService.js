const EKART_BASE_URL =
  process.env.EKART_BASE_URL ||
  "https://app.elite.ekartlogistics.in";

let cachedToken = null;
let tokenExpiresAt = 0;

// ========================================
// GET EKART ACCESS TOKEN
// ========================================

async function getEkartAccessToken() {
  try {
    // Reuse token if it is still valid.
    // Keep 60 seconds safety margin.
    if (
      cachedToken &&
      Date.now() < tokenExpiresAt - 60000
    ) {
      return cachedToken;
    }

    const clientId =
      process.env.EKART_CLIENT_ID;

    const username =
      process.env.EKART_USERNAME;

    const password =
      process.env.EKART_PASSWORD;

    if (
      !clientId ||
      !username ||
      !password
    ) {
      throw new Error(
        "Ekart API credentials are missing in .env."
      );
    }

    const response = await fetch(
      `${EKART_BASE_URL}/integrations/v2/auth/token/${encodeURIComponent(
        clientId
      )}`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body: JSON.stringify({
          username,
          password,
        }),
      }
    );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Ekart authentication response:",
        data
      );

      throw new Error(
        data.message ||
          data.description ||
          "Ekart authentication failed."
      );
    }

    if (!data.access_token) {
      throw new Error(
        "Ekart did not return an access token."
      );
    }

    cachedToken =
      data.access_token;

    const expiresInSeconds =
      Number(data.expires_in) ||
      86400;

    tokenExpiresAt =
      Date.now() +
      expiresInSeconds * 1000;

    return cachedToken;

  } catch (error) {
    console.error(
      "Ekart token error:",
      error
    );

    throw error;
  }
}

// ========================================
// CREATE EKART SHIPMENT
// ========================================

async function createEkartShipment(shipmentData) {
  try {
    const token =
      await getEkartAccessToken();

    const response = await fetch(
      `${EKART_BASE_URL}/api/v1/package/create`,
      {
        method: "PUT",

        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },

        body: JSON.stringify(
          shipmentData
        ),
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Ekart returned an invalid response."
      );
    }

    if (!response.ok) {
  console.error(
    "================================="
  );
  console.error(
    "EKART SHIPMENT CREATION FAILED"
  );
  console.error(
    "HTTP STATUS:",
    response.status
  );
  console.error(
    "FULL EKART RESPONSE:"
  );
  console.dir(data, {
    depth: null,
  });
  console.error(
    "================================="
  );

  const error =
    new Error(
      data.description ||
        data.message ||
        data.remark ||
        "Failed to create Ekart shipment."
    );

  error.ekartResponse = data;
  error.ekartStatus =
    response.status;

  throw error;
}

    if (!data.status) {
      throw new Error(
        data.remark ||
          "Ekart rejected the shipment."
      );
    }

    if (!data.tracking_id) {
      throw new Error(
        "Ekart did not return a tracking ID."
      );
    }

    return {
      success: true,

      trackingId:
        data.tracking_id,

      vendor:
        data.vendor || "EKART",

      awbNumber:
        data.barcodes?.wbn || null,

      orderBarcode:
        data.barcodes?.order || null,

      codBarcode:
        data.barcodes?.cod || null,

      rawResponse:
        data,
    };

  } catch (error) {
    console.error(
      "Create Ekart shipment error:",
      error
    );

    throw error;
  }
}

// ========================================
// CHECK EKART SERVICEABILITY
// ========================================

async function checkEkartServiceability(pincode) {
  try {
    const pin = String(pincode).trim();

    if (!/^\d{6}$/.test(pin)) {
      throw new Error(
        "A valid 6-digit pincode is required."
      );
    }

    const token =
      await getEkartAccessToken();

    const response = await fetch(
      `${EKART_BASE_URL}/api/v2/serviceability/${pin}`,
      {
        method: "GET",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    let data;

    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Ekart returned an invalid serviceability response."
      );
    }

    if (!response.ok) {
      console.error(
        "Ekart serviceability error:",
        data
      );

      throw new Error(
        data.message ||
          data.description ||
          "Failed to check Ekart serviceability."
      );
    }

    return data;

  } catch (error) {
    console.error(
      "Ekart serviceability check error:",
      error
    );

    throw error;
  }
}

module.exports = {
  getEkartAccessToken,
  createEkartShipment,
  checkEkartServiceability,
};