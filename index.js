if (process.env.NODE_ENV != "production") {
  require("dotenv").config();
}
const InitDB = require("./database/db.js");
const { startServer } = require("./server/server.js");

const port = 65515;

InitDB();
startServer(port);