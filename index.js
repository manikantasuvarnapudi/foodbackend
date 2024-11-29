const express = require("express");
require('dotenv').config();
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const twilio = require("twilio");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const cors = require('cors');
const app = express();
app.use(cors());




const client = twilio(accountSid, authToken);


console.log("Twilio client initialized!");


const dbPath = path.join(__dirname, "fooditems.db");

let db = null;

// Initialize the database and create the table if not exists
const initializeDBAndServer = async () => {
  try {
    // Open SQLite database
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Create the fooditems table if it doesn't exist
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
    console.log("Table created successfully or already exists");
    await db.run(`DELETE FROM fooditems;`);
    // Check for existing data and insert sample data only if the table is empty
    const checkDataQuery = `SELECT COUNT(*) AS count FROM fooditems;`;
    const { count } = await db.get(checkDataQuery)
    if (count === 0) {
      await insertSampleData();
    } else {
      console.log("Sample data already exists in the database. Skipping insertion.");
    }



    // Start the Express server
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

// Function to insert sample data
const insertSampleData = async () => {
  const insertQuery = `
    INSERT INTO fooditems (name, category, price, imageURL, description)
    VALUES (?, ?, ?, ?, ?);
  `;
  const foodData = [
    ['Coca Cola', 'ColdBeverages', 100, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732792152/gyygwuac4vcjabriup2f.jpg', 'A refreshing cold drink with a unique cola flavor'],
    ['Maza', 'ColdBeverages', 100, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732792152/rmtayg2lz8jtwxthgaxa.jpg', 'A sweet and fruity mango drink, perfect for hot days'],
    ['Orange Can', 'ColdBeverages', 100, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732792152/zpbjk5f6g2gbzfpkpiz3.jpg', 'A zesty and tangy orange soda to quench your thirst']
  ];

  for (let i = 0; i < foodData.length; i++) {
    await db.run(insertQuery, foodData[i]);
  }

  console.log("Sample data inserted");
};

initializeDBAndServer();

// API endpoint to get all food items
app.get("/food", async (request, response) => {
  try {
    const getfoodQuery = `
      SELECT
        *
      FROM
        fooditems;
    `;
    const fooditemsArray = await db.all(getfoodQuery);
    response.send(fooditemsArray);
  } catch (e) {
    console.log(`Error fetching food items: ${e.message}`);
    response.status(500).send("Error fetching food items");
  }
});

// API endpoint to get food item details
app.get("/food/:id/", async (request, response) => {
  const { id } = request.params;
  const getFoodItemQuery = `
    SELECT
      *
    FROM
      fooditems
    WHERE
      id = ${id};`;
  const FoodItem = await db.get(getFoodItemQuery);
  response.send(FoodItem);
});


// Endpoint to send an OTP
app.post("/send-otp", async (req, res) => {
  const { phone } = req.body;

  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Send OTP via Twilio SMS
    const message = await client.messages.create({
      body: `Your OTP is: ${otp}`,
      from: "+1234567890", // My Twilio phone number
      to: phone,
    });

    console.log(`Sent OTP ${otp} to ${phone}`);
    res.json({ message: "OTP sent successfully", otp }); // Only show OTP for testing (remove in production)
  } catch (error) {
    console.error("Failed to send OTP:", error.message);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

