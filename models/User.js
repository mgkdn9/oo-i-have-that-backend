const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  firstName: {type: String, required: true},
  lastName: {type: String, required: true},
  password: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  latitude: { type: String, required: true },
  longitude: { type: String, required: true },
});

module.exports = mongoose.model("User", UserSchema);
