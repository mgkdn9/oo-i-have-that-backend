const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const User = require("./models/User");
const ToolRequest = require("./models/ToolRequest");
const Response = require("./models/Response");

const app = express();
app.use(cors());
app.use(express.json());

// mongoose.connect("mongodb+srv://mkohlberg95:hKGpQgVvNAoNgNcY@ooihavethat.g3eqyix.mongodb.net/", { this change may or may not be necessary :)
mongoose.connect(
  "mongodb+srv://mkohlberg95:hKGpQgVvNAoNgNcY@ooihavethat.g3eqyix.mongodb.net/?tls=true&retryWrites=true&w=majority",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

// register endpoint
app.post("/api/register", async (req, res) => {
  const {
    email,
    firstName,
    lastName,
    password,
    phone,
    address,
    latitude,
    longitude,
  } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save the user
    const newUser = new User({
      email,
      firstName,
      lastName,
      password: hashedPassword,
      phone,
      address,
      latitude,
      longitude,
    });
    await newUser.save();

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// login endpoint
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: "Invalid password" });

    res.json({
      message: "Login successful",
      _id: user._id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// createToolRequest endpoint
app.post("/api/createToolRequest", async (req, res) => {
  const { title, timeNeeded, firstOfferPrice, pictureUrl, createdBy } =
    req.body;

  try {
    // Create and save the tool request
    const newTR = new ToolRequest({
      title,
      timeNeeded,
      firstOfferPrice,
      pictureUrl,
      createdBy,
    });
    await newTR.save();

    res.status(201).json({ message: "Tool Request created successfully" });
  } catch (err) {
    console.error("Create Tool Request error:", err);
    res.status(500).json({ error: "Create Tool Request error" });
  }
});

// edit Tool Request endpoint
app.put("/api/toolRequests/:id", async (req, res) => {
  try {
    const updated = await ToolRequest.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to update request" });
  }
});

// sortedToolRequests endpoint
app.get("/api/sortedToolRequests", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    // Get the requesting user's coordinates
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const userLat = parseFloat(user.latitude);
    const userLon = parseFloat(user.longitude);

    // Get all tool requests and populate creator's coordinates
    const toolRequests = await ToolRequest.find().populate(
      "createdBy",
      "latitude longitude"
    );

    const filteredAndSorted = toolRequests
      .filter((tr) => tr.createdBy && tr.createdBy._id.toString() !== userId)
      .map((tr) => {
        const distanceMi = getDistanceInMiles(
          userLat,
          userLon,
          parseFloat(tr.createdBy.latitude),
          parseFloat(tr.createdBy.longitude)
        ).toFixed(2);

        return {
          ...tr.toObject(),
          distanceMi,
        };
      })

      .sort((a, b) => a.distanceMi - b.distanceMi);

    res.json(filteredAndSorted);
  } catch (err) {
    console.error("Error fetching tool requests:", err);
    res.status(500).json({ error: "Failed to fetch tool requests" });
  }
});
const getDistanceInMiles = (lat1, lon1, lat2, lon2) => {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// myRequests endpoint
app.get("/api/myRequests", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const toolRequests = await ToolRequest.find({ createdBy: userId }).populate(
      "createdBy"
    );

    const requestsWithResponses = await Promise.all(
      toolRequests.map(async (tr) => {
        // Populate only firstName, _id, and phone
        const responses = await Response.find({ originalTR: tr._id }).populate(
          "owner",
          "firstName _id phone"
        );
        return {
          ...tr.toObject(),
          responses,
        };
      })
    );

    res.json(requestsWithResponses);
  } catch (err) {
    console.error("Error fetching toolRequests:", err);
    res.status(500).json({ error: "Failed to fetch toolRequests" });
  }
});

// delete request endpoint
app.delete("/api/request/:id", async (req, res) => {
  try {
    await ToolRequest.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete request" });
  }
});

// createResponse endpoint
app.post("/api/createResponse", async (req, res) => {
  const { originalTR, counterOfferPrice, seeker, owner } = req.body;

  try {
    // Create and save the tool request
    const newResponse = new Response({
      originalTR,
      counterOfferPrice,
      seeker,
      owner,
    });
    await newResponse.save();

    res.status(201).json({ message: "TR Response created successfully" });
  } catch (err) {
    console.error("Create TR Reponse error:", err);
    res.status(500).json({ error: "Create TR Reponse error" });
  }
});

// myResponses endpoint
app.get("/api/myResponses", async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: "Missing userId" });
  }

  try {
    const responses = await Response.find({ owner: userId })
      .populate({
        path: "originalTR",
        populate: { path: "createdBy", model: "User" }, // Also populate the requester (seeker) on the tool request
      })
      .populate("owner"); // Populate full owner details

    res.json(responses);
  } catch (err) {
    console.error("Error fetching responses:", err);
    res.status(500).json({ error: "Failed to fetch responses" });
  }
});

// delete response endpoint
app.delete("/api/response/:id", async (req, res) => {
  try {
    await Response.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete response" });
  }
});

app.listen(4000, () => console.log("Server running and hosted on Render"));
