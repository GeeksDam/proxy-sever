const mongoose = require("mongoose");

const dataSchema = new mongoose.Schema({
  clientIp: {
    required: true,
    type: String,
  },
  clientPort: {
    required: true,
    type: String,
  },
  destinationtAddress: {
    type: String,
  },
  requestTime: {
    required: true,
    type: Date,
  },
});

module.exports = mongoose.model("Log", dataSchema);
