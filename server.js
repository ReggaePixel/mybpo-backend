const express = require("express");
const cors = require("cors");
const { google } = require("googleapis");

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

const upload = multer({ dest: "uploads/" });

const storage = new Storage({
  keyFilename: "mybpo-platform-dc4d69bdbe41.json"
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
      public: true,
    });

    const fileUrl = `https://storage.googleapis.com/${bucketName}/${destination}`;

    fs.unlinkSync(file.path);

    res.json({
      success: true,
      fileUrl
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ===============================
   Server Start (LAST)
================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
