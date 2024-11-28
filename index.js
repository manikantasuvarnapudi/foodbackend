const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require('cors');
const app = express();
app.use(cors());

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

    // Insert some sample data (optional)
    await insertSampleData();

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
