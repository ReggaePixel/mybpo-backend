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
   Server Start (LAST)
================================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});