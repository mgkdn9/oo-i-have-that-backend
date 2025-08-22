const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const axios = require("axios")
const User = require("./models/User");
const ToolRequest = require("./models/ToolRequest");
const Response = require("./models/Response");

const app = express();
app.use(cors());

// app.use(cors({
//   origin: ['https://mgkdn9.github.io', 'http://localhost:3000'],// Allow GitHub Pages frontend and localhost
//   credentials: true, // Optional: if you use cookies/auth
// }));
// app.options('*', cors({
//   origin: ['https://mgkdn9.github.io', 'http://localhost:3000'],
//   credentials: true,
// }));

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
  const { email, firstName, lastName, password, phone, address } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    // Geocode the address server-side with Axios
    const geoRes = await axios.get(
      `https://nominatim.openstreetmap.org/search`,
      {
        params: { format: "json", q: address },
        headers: { "User-Agent": "OoIHaveThatApp/1.0" }, // required by Nominatim
      }
    );

    const geoData = geoRes.data;

    if (!geoData || geoData.length === 0) {
      return res
        .status(400)
        .json({ error: "Could not geocode the address. Please check it." });
    }

    const latitude = geoData[0].lat;
    const longitude = geoData[0].lon;

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

    const { password: _, ...userWithoutPassword } = newUser.toObject();

    res.status(201).json({
      message: "User registered successfully",
      user: userWithoutPassword,
    });
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
  const { userId, localLat, localLon } = req.query;
  let userLat, userLon;
  try {
    if (!userId && !(localLat && localLon)) {
      return res.status(400).json({ error: "Missing userId" });
    } else if (!userId) {
      userLat = localLat;
      userLon = localLon;
    } else {
      // Get the requesting user's coordinates
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      userLat = parseFloat(user.latitude);
      userLon = parseFloat(user.longitude);
    }

    // Get all tool requests and populate creator's coordinates
    const toolRequests = await ToolRequest.find().populate(
      "createdBy",
      "latitude longitude"
    );

    const filteredAndSorted = toolRequests
      //Filter out any TRs made by user
      .filter((tr) => tr.createdBy && tr.createdBy._id.toString() !== userId)
      //Sort by distance
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
    const requestingUser = await User.findById(userId);
    if (
      !requestingUser ||
      !requestingUser.latitude ||
      !requestingUser.longitude
    ) {
      return res.status(400).json({ error: "User location missing" });
    }

    const toolRequests = await ToolRequest.find({ createdBy: userId }).populate(
      "createdBy"
    );

    const requestsWithResponses = await Promise.all(
      toolRequests.map(async (tr) => {
        const responses = await Response.find({ originalTR: tr._id }).populate(
          "owner",
          "firstName _id phone latitude longitude"
        );

        const enrichedResponses = responses.map((r) => {
          const owner = r.owner;
          let distance = null;

          if (owner?.latitude && owner?.longitude) {
            distance = getDistanceInMiles(
              requestingUser.latitude,
              requestingUser.longitude,
              owner.latitude,
              owner.longitude
            );
          }

          return {
            _id: r._id,
            message: r.message,
            counterOfferPrice: r.counterOfferPrice,
            owner: {
              //Only sends relevant data to front end
              _id: owner._id,
              firstName: owner.firstName,
              phone: owner.phone,
            },
            distance: distance !== null ? distance.toFixed(1) : null, // one decimal mile
            updatedAt: r.updatedAt,
          };
        });

        return {
          ...tr.toObject(),
          responses: enrichedResponses,
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
