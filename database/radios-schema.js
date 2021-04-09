const mongoose = require("mongoose");

const RadioSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  files: {
    type: [Object],
    default: []
  },
  queue: {
    type: [Object],
    default: []
  },
  email: {
    type: String,
    required: true
  },
  genre: String,
  isLive: Boolean,
  playing: {
    type: Object,
    default: {}
  }
});

module.exports = {
  RadioM: mongoose.model("RadioM", RadioSchema)
}