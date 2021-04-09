const mongoose = require("mongoose");
const URI = `mongodb+srv://${process.env.ADMINUSER}:${process.env.ADMINPASS}@cluster0.ldor1.mongodb.net/Ubroadcast?retryWrites=true&w=majority`;

const InitDB = () =>
mongoose.connect(URI, { useNewUrlParser: true, useUnifiedTopology: true }, () => {
  console.log("Database connected");
});

module.exports = InitDB;