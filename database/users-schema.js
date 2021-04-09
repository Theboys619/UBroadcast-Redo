const mongoose = require("mongoose");

const UsersSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  Radios: {
    type: [String],
    default: []
  }
});

class UserClass {
  static getUserById(id) {
    return this.findById(id);
  }

  static getUserByEmail(email) {
    return this.findOne({ email });
  }
}
UsersSchema.loadClass(UserClass);

module.exports = {
  User: mongoose.model("User", UsersSchema),
  UserClass
}