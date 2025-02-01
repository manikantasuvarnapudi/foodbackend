const express = require("express");
const nodemailer = require("nodemailer");
require("dotenv").config();
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const twilio = require("twilio");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = twilio(accountSid, authToken);

// Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// In-memory storage for OTPs
const otpStorage = {};

// Database setup
const dbPath = path.join(__dirname, "fooditems.db");
let db = null;

// Initialize DB and server
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Drop existing tables (for testing/demo purposes)
    await db.run(`DROP TABLE IF EXISTS orders;`);
    await db.run(`DROP TABLE IF EXISTS fooditems;`);
    await db.run(`DROP TABLE IF EXISTS users;`);
    await db.run(
      "DELETE FROM sqlite_sequence WHERE name='fooditems' AND name='orders' and name='users';"
    );

    // Create tables
    await db.run(`
      CREATE TABLE IF NOT EXISTS fooditems (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        imageURL TEXT,
        description TEXT
      );
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          orderId TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          datetime TEXT NOT NULL,
          orderDetails TEXT NOT NULL,
          status TEXT NOT NULL,
          completedtime TEXT NOT NULL
      );
    `);
    await db.run(`
      CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          password TEXT NOT NULL,
          gender TEXT NOT NULL,
          location TEXT NOT NULL
      );
    `);

    // Insert sample data if fooditems table is empty
    const checkDataQuery = `SELECT COUNT(*) AS count FROM fooditems;`;
    const { count } = await db.get(checkDataQuery);
    if (count === 0) {
      await insertSampleData();
    } else {
      console.log("Sample data already exists in the database. Skipping insertion.");
    }

    // ***** SERVER-SIDE CONFIGURATION FOR CLIENT-SIDE ROUTING *****
    // Serve static files from your React app’s build directory.
    // Ensure you have run "npm run build" in your React app.
    app.use(express.static(path.join(__dirname, "build")));

    // Catch-all route: for any request not handled above,
    // send back index.html so that React Router can manage the route.
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "build", "index.html"));
    });
    // **************************************************************

    // Start the server
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

// Sample data insertion function
const insertSampleData = async () => {
  const insertQuery = `
    INSERT INTO fooditems (name, category, price, imageURL, description)
    VALUES (?, ?, ?, ?, ?);
  `;
  const foodData = [
    [
      "Coca Cola",
      "ColdBeverages",
      100,
      "https://res.cloudinary.com/djszohdjt/image/upload/v1732792152/gyygwuac4vcjabriup2f.jpg",
      "A refreshing cold drink with a unique cola flavor",
    ],
    // ... (include all the rest of your sample data here)
  ];
  for (let i = 0; i < foodData.length; i++) {
    await db.run(insertQuery, foodData[i]);
  }
};

initializeDBAndServer();

// JWT Authentication middleware
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, process.env.SECRET_KEY, (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// ------------------------
// API Endpoints
// ------------------------

// Get all food items
app.get("/", async (request, response) => {
  try {
    const getfoodQuery = `SELECT * FROM fooditems;`;
    const fooditemsArray = await db.all(getfoodQuery);
    response.send(fooditemsArray);
  } catch (e) {
    console.log(`Error fetching food items: ${e.message}`);
    response.status(500).send("Error fetching food items");
  }
});

// Get details for a specific food item
app.get("/food/:id/", async (request, response) => {
  const { id } = request.params;
  const getFoodItemQuery = `
    SELECT * FROM fooditems WHERE id = ${id};
  `;
  const FoodItem = await db.get(getFoodItemQuery);
  response.send(FoodItem);
});

// Get all orders with optional search and filter parameters
app.get("/orders", async (req, res) => {
  const { search = "", filter = "" } = req.query;
  const allOrdersQuery = `
    SELECT * FROM orders 
    WHERE name LIKE '%${search}%' AND status LIKE '%${filter}%'
  `;
  const orders = await db.all(allOrdersQuery);
  const updateOrders = orders.map((each) => ({
    ...each,
    orderDetails: JSON.parse(each.orderDetails),
  }));
  res.send(updateOrders);
});

// User registration endpoint
app.post("/users/", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const selectUserQuery = `SELECT * FROM users WHERE username = ?`;
    const dbUser = await db.get(selectUserQuery, [username]);
    if (dbUser === undefined) {
      const createUserQuery = `
        INSERT INTO users (username, name, password, gender, location) 
        VALUES (?, ?, ?, ?, ?)
      `;
      const dbResponse = await db.run(createUserQuery, [
        username,
        name,
        hashedPassword,
        gender,
        location,
      ]);
      const newUserId = dbResponse.lastID;
      response.send(`Created new user with ID ${newUserId}`);
    } else {
      response.status(400).send("User already exists");
    }
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT") {
      response.status(400).send("User already exists");
    } else {
      console.error("Error:", error);
      response.status(500).send("Internal Server Error");
    }
  }
});

// User login endpoint
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM users WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, process.env.SECRET_KEY);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

// Endpoint to send an OTP
app.post("/send-otp", async (req, res) => {
  const { name, phone, email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  try {
    const message = await client.messages.create({
      body: `
${otp} is your OTP for ScreenBites. Please do not share it with anyone.

@screenbites.vercel.app #${otp}
`,
      from: "+16084077542",
      to: `+91${phone}`,
    });
    otpStorage[phone] = otp;
    res.json({ message: "OTP sent successfully", otp });
  } catch (error) {
    if (!email) {
      return res.status(400).send({ message: "Email is required" });
    }
    otpStorage[email] = otp;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Verify Your Food Order with OTP ${otp}`,
      text: `Dear ${name},\n\nYour One-Time Password (OTP) for verifying your food order is ${otp}.\n\nUse this code to confirm your order. It will expire in 10 minutes.`,
      html: `
      <p>Dear ${name},</p>
      <p>Your One-Time Password (OTP) for verifying your food order is:</p>
      <h2 style="color: #d9534f;">${otp}</h2>
      <p>Use this code to confirm your order. It will expire in <strong>10 minutes</strong>.</p>
      <p>Thank you for choosing Screen Bites!</p>
      <p>Best regards,<br><strong>Screen Bites Team</strong></p>
    `,
      headers: {
        "X-Priority": "1",
        Priority: "urgent",
      },
    };
    try {
      await transporter.sendMail(mailOptions);
      res.status(200).send({ message: "OTP sent successfully!" });
    } catch (error) {
      console.error("Error sending OTP:", error);
      res.status(500).send({ message: "Failed to send OTP" });
    }
  }
});

// API to verify OTP
app.post("/verify-otp", async (req, res) => {
  const { phone, otp, email, name, order } = req.body;
  if (!phone || !otp || !email) {
    return res
      .status(400)
      .json({ success: false, message: "Phone and OTP are required" });
  }
  const storedOtp = otpStorage[phone];
  const storedOtpmail = otpStorage[email];
  console.log(
    `Stored OTP (phone): ${storedOtp}, Stored OTP (email): ${storedOtpmail}`
  );
  const options = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  const dateTime = new Date().toLocaleString("en-IN", options);
  if (storedOtp === otp || storedOtpmail === otp) {
    delete otpStorage[phone];
    delete otpStorage[email];
    const orderId = uuidv4().split("-")[0];
    const status = "Inprogress";
    try {
      await db.run(
        `INSERT INTO orders (name, orderId, email, datetime, orderDetails, status, completedtime) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, orderId, email, dateTime, order, status, dateTime]
      );
      return res.status(200).json({
        success: true,
        message: "OTP verified successfully!",
        orderId: orderId,
      });
    } catch (err) {
      console.error("Error inserting data into orders table:", err.message);
      return res.status(500).json({
        success: false,
        message: "Error storing data in database",
      });
    }
  } else {
    return res.status(400).json({
      success: false,
      message: `Invalid OTP`,
    });
  }
});

// Update order status endpoint
app.put("/update-status", authenticateToken, async (req, res) => {
  const { orderId, action } = req.body;
  console.log("Request received:", req.body);
  if (!orderId || !action) {
    return res.status(400).json({
      success: false,
      message: "Order ID and action are required.",
    });
  }
  const options = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };
  const dateTime = new Date().toLocaleString("en-IN", options);
  const updateQuery = `UPDATE orders SET status = ?, completedtime = ? WHERE orderId = ?`;
  await db.run(updateQuery, [action, dateTime, orderId], function (err) {
    if (err) {
      console.error("Error updating order:", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to update order status.",
      });
    }
  });
  return res.status(200).json({
    success: true,
    message: `Order ${orderId} status updated to '${action}'.`,
  });
});
      
