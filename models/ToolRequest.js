const mongoose = require("mongoose");

const ToolRequestSchema = new mongoose.Schema({
  title: { type: String, required: true },
  timeNeeded: {type: String, required: true},
  firstOfferPrice: {type: String, required: true},
  pictureUrl: { type: String },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

module.exports = mongoose.model("ToolRequest", ToolRequestSchema);
