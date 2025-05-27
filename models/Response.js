const mongoose = require("mongoose");

const ResponseSchema = new mongoose.Schema({
  originalTR: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ToolRequest",
    required: true
  },
  counterOfferPrice: {type: String, required: true},
  seeker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  timeResponded: {type: String, required: true}
});

module.exports = mongoose.model("Response", ResponseSchema);
