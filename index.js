const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require('cors');
app.use(cors())
const app = express();

const dbPath = path.join(__dirname, "fooditems.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();


app.get("/food", async (request, response) => {
    const getfoodQuery = `
      SELECT
        *
      FROM
        fooditems;`;
    const fooditemsArray = await db.all(getfoodQuery);
    response.send(fooditemsArray);
  });