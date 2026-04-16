const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");
const twilio = require("twilio"); // ✅ NEW

const app = express();

app.use(cors());
app.use(express.json());

/* ===============================
   Google Sheets Authentication
================================= */

const auth = new google.auth.JWT(
  process.env.GOOGLE_CLIENT_EMAIL,
  null,
  process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  ["https://www.googleapis.com/auth/spreadsheets"]
);

const sheets = google.sheets({ version: "v4", auth });

const SPREADSHEET_ID = "1sg4RyEdSYpJB74Y_kV3PEwOzsroRl4U8NOjtuYgQ0MM";

/* ===============================
   Get Twilio Credentials (SAFE)
================================= */

async function getTwilioCredentials(businessId) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "CUSTOMERS"
  });

  const rows = response.data.values;

  if (!rows || rows.length === 0) {
    throw new Error("CUSTOMERS sheet is empty");
  }

  const headers = rows[0];

  // 🔥 Normalize headers (THIS fixes your issue)
  const normalize = (str) => String(str || "").trim().toUpperCase();
  const headersNormalized = headers.map(h => normalize(h));

  const idIndex = headersNormalized.indexOf("ASSIGNED ID");
  const sidIndex = headersNormalized.indexOf("SID");
  const tokenIndex = headersNormalized.indexOf("AUTH TOKEN");

  // ✅ Hard fail with debug info
  if (idIndex === -1 || sidIndex === -1 || tokenIndex === -1) {
    console.error("TWILIO HEADER ERROR:", headers);
    throw new Error("Required columns missing in CUSTOMERS sheet");
  }

  // 🔍 Find user
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];

    if (String(row[idIndex]).trim() === String(businessId).trim()) {
      return {
        accountSid: String(row[sidIndex]).trim(),
        authToken: String(row[tokenIndex]).trim()
      };
    }
  }

  throw new Error("User not found");
}

/* ===============================
   Test Routes
================================= */

app.get("/", (req, res) => {
  res.send("MyBPO backend running");
});

app.get("/call", (req, res) => {
  res.send("call route working");
});

/* ===============================
   Read Google Sheets
================================= */

app.get("/customers", async (req, res) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "CUSTOMERS"
  });
  res.json(response.data.values);
});

app.get("/campaigns", async (req, res) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "CAMPAIGN LISTS"
  });
  res.json(response.data.values);
});

app.get("/ivr", async (req, res) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "IVR LISTS"
  });
  res.json(response.data.values);
});

app.get("/call-logs", async (req, res) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "CALL LOGS"
  });
  res.json(response.data.values);
});

app.get("/message-counter", async (req, res) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "MESSAGE COUNTER"
  });
  res.json(response.data.values);
});

app.get("/contacts", async (req, res) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "CONTACTS"
  });
  res.json(response.data.values);
});

app.get("/plans", async (req, res) => {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "PLANS"
  });
  res.json(response.data.values);
});

/* ===============================
   Upload Campaign File (GCS)
================================= */

const multer = require("multer");
const { Storage } = require("@google-cloud/storage");
const fs = require("fs");

const upload = multer({ dest: "/tmp/" });

const storage = new Storage({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
});

const bucketName = "mybpo-platform-storage";

app.post("/upload-campaign", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const destination = `campaign_lists/${Date.now()}_${file.originalname}`;

    await storage.bucket(bucketName).upload(file.path, {
      destination,
    });

    const [signedUrl] = await storage
      .bucket(bucketName)
      .file(destination)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7
      });

    fs.unlinkSync(file.path);

    res.json({
      success: true,
      fileUrl: signedUrl,
      filePath: destination
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ===============================
   Create Campaign (Google Sheets)
================================= */

app.post("/create-campaign", async (req, res) => {
  try {
    const { businessId, sheetId, sheetName, status } = req.body;

    if (!businessId || !sheetId || !sheetName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "CAMPAIGN LISTS!A:D",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [
          [
            businessId,
            sheetId,
            sheetName,
            status || "New"
          ]
        ],
      },
    });

    res.json({ success: true });

  } catch (err) {
    console.error("Create campaign error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   Check Minutes (CUSTOMERS sheet)
================================= */

app.get("/check-mins", async (req, res) => {
  try {
    const { businessId } = req.query;

    if (!businessId) {
      return res.status(400).json({ error: "Missing businessId" });
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: "CUSTOMERS"
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      return res.status(500).json({ error: "CUSTOMERS sheet is empty" });
    }

    const headers = rows[0];

    // 🔥 Normalize headers (prevents ALL your current issues)
    const normalize = (str) => String(str || "").trim().toUpperCase();
    const headersNormalized = headers.map(h => normalize(h));

    const idIndex = headersNormalized.indexOf("ASSIGNED ID");
    const minsIndex = headersNormalized.indexOf("MINS AVAIL");

    // ✅ Hard fail if structure is wrong (with debug info)
    if (idIndex === -1 || minsIndex === -1) {
      console.error("HEADER ERROR:", headers);
      return res.status(500).json({
        error: "Required columns missing in CUSTOMERS sheet",
        headersFound: headers
      });
    }

    // 🔍 Find user
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];

      if (String(row[idIndex]).trim() === String(businessId).trim()) {
        return res.json({
          mins: Number(row[minsIndex] || 0)
        });
      }
    }

    return res.status(404).json({ error: "User not found" });

  } catch (err) {
    console.error("Check mins error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   Make Call (Twilio - SaaS)
================================= */

app.post("/make-call", async (req, res) => {
  try {
    const { to, from, businessId } = req.body;

    if (!to || !from || !businessId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const creds = await getTwilioCredentials(businessId);

    const client = twilio(creds.accountSid, creds.authToken);

    const call = await client.calls.create({
      to: to,
      from: from,
      url: `https://mybpo-backend.onrender.com/voice?businessId=${businessId}`
    });

    res.json({
      success: true,
      callSid: call.sid
    });

  } catch (err) {
    console.error("Call error:", err);
    res.status(500).json({ error: err.message });
  }
});

const AccessToken = require("twilio").jwt.AccessToken;
const VoiceGrant = AccessToken.VoiceGrant;

/* ===============================
   Generate Twilio Voice Token
================================= */

app.get("/voice-token", async (req, res) => {
  try {
    const { businessId } = req.query;

    if (!businessId) {
      return res.status(400).json({ error: "Missing businessId" });
    }

    // 🔥 Get user's Twilio credentials
    const creds = await getTwilioCredentials(businessId);

    // These MUST be set in your Render env
    const TWILIO_API_KEY = process.env.TWILIO_API_KEY;
    const TWILIO_API_SECRET = process.env.TWILIO_API_SECRET;
    const TWIML_APP_SID = process.env.TWIML_APP_SID;

    const identity = businessId; // unique per user

    const token = new AccessToken(
      creds.accountSid,
      TWILIO_API_KEY,
      TWILIO_API_SECRET,
      { identity }
    );

    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWIML_APP_SID,
      incomingAllow: true
    });

    token.addGrant(voiceGrant);

    res.json({ token: token.toJwt() });

  } catch (err) {
    console.error("Voice token error:", err);
    res.status(500).json({ error: err.message });
  }
});

/* ===============================
   Twilio Voice Webhook
================================= */

app.post("/voice", (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();

  twiml.say("Hello. This is a test call from MyBPO.");

  res.type("text/xml");
  res.send(twiml.toString());
});

/* ===============================
   Server Start (LAST)
================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
