const express = require("express");
const nodemailer = require('nodemailer');
require('dotenv').config();
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const twilio = require("twilio");
const { v4: uuidv4 } = require('uuid');



const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;

const cors = require('cors');
const app = express();
app.use(cors());
app.use(express.json());



const client = twilio(accountSid, authToken);



const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});



const otpStorage = {};

const dbPath = path.join(__dirname, "fooditems.db");

let db = null;


const initializeDBAndServer = async () => {
  try {

    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    await db.run(`DROP TABLE IF EXISTS orders;`);
    await db.run(`DROP TABLE IF EXISTS fooditems;`);
    await db.run("DELETE FROM sqlite_sequence WHERE name='fooditems' AND name='orders';");

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
          status TEXT NOT NULL
      )
    `);
    const checkDataQuery = `SELECT COUNT(*) AS count FROM fooditems;`;
    const { count } = await db.get(checkDataQuery)
    if (count === 0) {
      await insertSampleData();
    } else {
      console.log("Sample data already exists in the database. Skipping insertion.");
    }

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};


const insertSampleData = async () => {
  const insertQuery = `
    INSERT INTO fooditems (name, category, price, imageURL, description)
    VALUES (?, ?, ?, ?, ?);
  `;
  const foodData = [
    ['Coca Cola', 'ColdBeverages', 100, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732792152/gyygwuac4vcjabriup2f.jpg', 'A refreshing cold drink with a unique cola flavor'],
    ['Maza', 'ColdBeverages', 100, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732792152/rmtayg2lz8jtwxthgaxa.jpg', 'A sweet and fruity mango drink, perfect for hot days'],
    ['Orange Can', 'ColdBeverages', 100, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732792152/zpbjk5f6g2gbzfpkpiz3.jpg', 'A zesty and tangy orange soda to quench your thirst'],
    ['Classic Cheeseburger', 'burgers', 160, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732903151/icrugik0bhlttjhdud9v.jpg', 'A juicy beef patty with cheddar cheese, lettuce, tomato, and our special sauce.'],
    ['Spicy Chicken Burger', 'burgers', 180, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732903607/feurr3j9ryokg90tfavo.jpg', 'Crispy chicken fillet with spicy mayo, lettuce, and pickles.'],
    ['Veggie Delight Sandwich', 'sandwiches', 140, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732906800/mtkp4399jblwvqpwrp6w.jpg', 'A fresh and healthy sandwich with assorted vegetables and creamy dressing.'],
    ['Chicken Club Sandwich', 'sandwiches', 150, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732906801/nck1kqo6dvsi6os9qjoi.jpg', 'A classic club sandwich with tender chicken, lettuce, and tangy sauce.'],
    ['Grilled Cheese Sandwich', 'sandwiches', 160, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732770541/ubalqpxccrb3tsmvmdir.jpg', 'A classic grilled cheese sandwich with melted cheddar and crispy golden bread.'],
    ['Peri Peri', 'frenchfries', 210, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732903152/hpp8onukx9qia2wjodb9.jpg', 'Spicy and flavorful Peri Peri seasoned French fries.'],
    ['Salted', 'frenchfries', 190, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732903152/wtmmnk49ppi0qjkqwgdj.jpg', 'Classic salted French fries with a crisp golden texture.'],
    ['Loaded', 'frenchfries', 220, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732903151/cbdtzqkjpibh7h7heovu.jpg', 'Loaded French fries topped with cheese, sauces, and flavorful seasonings.'],
    ['Expresso', 'HotBeverages', 90, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732907482/xtvwykfrxga6xwrbeqee.jpg', 'A strong and rich shot of expresso coffee.'],
    ['Cappuccino', 'HotBeverages', 120, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732907482/kd39saigrfbepnrea5es.jpg', 'A creamy cappuccino with a perfect blend of coffee and frothy milk.'],
    ['Green Tea', 'HotBeverages', 80, 'https://res.cloudinary.com/djszohdjt/image/upload/v1732907482/kv0anjwanphwirtngblg.jpg', 'A refreshing cup of green tea, perfect for a calm and healthy break.'],
    ['Salt Popcorn', 'popcorn', 210, 'https://res.cloudinary.com/djszohdjt/image/upload/v1733071297/zh96cjwnvhwvprcghjee.jpg', 'A classic salted popcorn snack.'],
    ['Cheese Popcorn', 'popcorn', 230, 'https://res.cloudinary.com/djszohdjt/image/upload/v1733071296/pn3djbnjeowe7zhnzlds.jpg', 'Delicious cheesy-flavored popcorn.'],
    ['Sweet Popcorn', 'popcorn', 230, 'https://res.cloudinary.com/djszohdjt/image/upload/v1733155465/yi9ox9qdumpoxp3o7ne8.jpg', 'Sweet caramel-coated popcorn.'],
    ['Veg Roll', 'Rolls', 120, 'https://res.cloudinary.com/djszohdjt/image/upload/v1733158898/ypexdlzu4a1tvidcg5og.jpg', 'A healthy, fresh, and delicious vegetarian roll filled with assorted veggies.'],
    ['Paneer Roll', 'Rolls', 130, 'https://res.cloudinary.com/djszohdjt/image/upload/v1733158902/yfjmpcfcrkdg6bwe8k1s.jpg', 'A tasty paneer roll with spicy marinated paneer and fresh vegetables.'],
    ['Chicken Roll', 'Rolls', 150, 'https://res.cloudinary.com/djszohdjt/image/upload/v1733158902/dwafzjeudnfqiiypuxkm.jpg', 'A flavorful chicken roll with grilled chicken and a blend of aromatic spices.']
  ];

  for (let i = 0; i < foodData.length; i++) {
    await db.run(insertQuery, foodData[i]);
  }
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

// Endpoint to get all orders 
app.get("/orders", async (req, res) => {
  const {
    search = "",
    filter = ""
  } = req.query;

  const allOrdersQuery = `SELECT * FROM orders WHERE name LIKE '%${search}%' AND status LIKE '%${filter}%'`
  const orders = await db.all(allOrdersQuery);
  const updateOrders = orders.map((each) => ({ ...each, orderDetails: JSON.parse(each.orderDetails) }))
  res.send(updateOrders)
})


// Endpoint to send an OTP
app.post("/send-otp", async (req, res) => {
  const { name, phone, email } = req.body;
  // Generate a 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Send OTP via Twilio SMS
    const message = await client.messages.create({
      body: `Your OTP is: ${otp}`,
      from: "+18669859990",
      to: `+91${phone}`,

    });
    otpStorage[phone] = otp;
    res.json({ message: "OTP sent successfully", otp });
  } catch (error) {
    if (!email) {
      return res.status(400).send({ message: 'Email is required' });
    }
    otpStorage[email] = otp;
    // Email content
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Verify Your Food Order with OTP ${otp}`,
      text: `Dear ${name},\n\nYour One-Time Password (OTP) for verifying your food order is ${otp}.\n\n Use this code to confirm your order. It will expire in 10 minutes.`,
      html: `
      <p>Dear ${name},</p>
      <p>Your One-Time Password (OTP) for verifying your food order is:</p>
      <h2 style="color: #d9534f;">${otp}</h2>
      <p>Use this code to confirm your order. It will expire in <strong>10 minutes</strong>.</p>
      <p>Thank you for choosing Screen Bites!</p>
      <p>Best regards,<br><strong>Screen Bites Team</strong></p>
    `,
      headers: {
        'X-Priority': '1',
        'Priority': 'urgent',
      }
    };

    // Send the OTP email
    try {
      await transporter.sendMail(mailOptions);
      res.status(200).send({ message: 'OTP sent successfully!' });
    } catch (error) {
      console.error('Error sending OTP:', error);
      res.status(500).send({ message: 'Failed to send OTP' });
    }

    // res.status(500).json({ error: "Failed to send OTP" });
  }
});


// API to verify OTP
app.post('/verify-otp', async (req, res) => {
  const { phone, otp, email, name, order } = req.body;

  if (!phone || !otp || !email) {
    return res.status(400).json({ success: false, message: 'Phone and OTP are required' });
  }

  const storedOtp = otpStorage[phone];
  const storedOtpmail = otpStorage[email];

  console.log(`Stored OTP (phone): ${storedOtp}, Stored OTP (email): ${storedOtpmail}`);

  if (storedOtp === otp || storedOtpmail === otp) {
    delete otpStorage[phone];
    delete otpStorage[email];
    const orderId = uuidv4().split('-')[0];
    const status = "Inprogress";
    const options = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    };
    
    const dateTime = new Date().toLocaleString('en-IN', options);
    

    try {
      await db.run(
        `INSERT INTO orders (name, orderId, email, datetime, orderDetails, status) VALUES (?, ?, ?, ?, ?, ?)`,
        [name, orderId, email, dateTime, order, status]
      );

      return res.status(200).json({
        success: true,
        message: 'OTP verified successfully!',
        orderId: orderId,
      });

    } catch (err) {
      console.error("Error inserting data into orders table:", err.message);
      return res.status(500).json({
        success: false,
        message: 'Error storing data in database',
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
app.post('/orders/update-order', (req, res) => {
  const { orderId, action } = req.body;
  // Validate input
  if (!orderId || !action) {
      return res.status(400).json({
          success: false,
          message: 'Order ID and action are required.',
      });
  }
  // Update query
  const updateQuery = `UPDATE orders SET status = ? WHERE orderId = ?`;
  db.run(updateQuery, [action, orderId], function (err) {
      if (err) {
          console.error('Error updating order:', err.message);
          return res.status(500).json({
              success: false,
              message: 'Failed to update order status.',
          });
      }

      // Check if any row was updated
      if (this.changes === 0) {
          return res.status(404).json({
              success: false,
              message: 'Order not found.',
          });
      }

      res.status(200).json({
          success: true,
          message: `Order ${orderId} status updated to '${action}'.`,
      });
  });
});



