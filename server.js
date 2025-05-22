const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const User = require("./models/User");
const ToolRequest = require("./models/ToolRequest");

const app = express();
app.use(cors());
app.use(express.json());

// mongoose.connect("mongodb+srv://mkohlberg95:hKGpQgVvNAoNgNcY@ooihavethat.g3eqyix.mongodb.net/", { this change may or may not be necessary :)
mongoose.connect("mongodb+srv://mkohlberg95:hKGpQgVvNAoNgNcY@ooihavethat.g3eqyix.mongodb.net/?tls=true&retryWrites=true&w=majority", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// REGISTER endpoint
app.post("/api/register", async (req, res) => {
  const { email, firstName, lastName, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save the user
    const newUser = new User({ email, firstName, lastName, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// LOGIN endpoint
app.post("/api/login", async (req, res) => {

  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    res.json({ message: "Login successful",  _id: user._id, email: user.email, firstName: user.firstName, lastName: user.lastName });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// createToolRequest endpoint
app.post("/api/createToolRequest", async (req, res) => {

  const { title, timeNeeded, firstOfferPrice, pictureUrl, createdBy } = req.body;

  try {
    // Create and save the tool request
    const newTR = new ToolRequest({ title, timeNeeded, firstOfferPrice, pictureUrl, createdBy });
    await newTR.save();

    res.status(201).json({ message: "Tool Request created successfully" });
  } catch (err) {
    console.error("Create Tool Request error:", err);
    res.status(500).json({ error: "Create Tool Request error" });
  }
});

app.listen(4000, () => console.log("Server running and hosted on Render"));
