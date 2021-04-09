const express = require("express");
const app = express();
const server = require("http").createServer(app);
const io = require("socket.io")(server);

const Path = require("path");
const bcrypt = require("bcrypt");
const flash = require("express-flash");
const session = require("express-session");

const passport = require("passport");
const { routes: radioRoutes } = require("./radio.js");
const { User, UserClass } = require("../database/users-schema.js");

const initPassport = require("./passport-config");
initPassport(passport, User);

app.set("view-engine", "ejs");

function startServer(port) {
  app.use((req, res, next) => {
    res.renderHTML = (file, options = { root: "./client" }) => {
      if (!file.endsWith(".html")) file += ".html";

      res.sendFile(file, options);
    }

    next();
  });
  app.use(express.static("public"));
  app.use(express.urlencoded({ extended: false }));

  app.use(flash());
  app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(radioRoutes(io, { checkAuth, checkNotAuth, passport, User }));

  app.get("/", checkAuth, (req, res) => {
    res.render("index.ejs");
  });

  app.get("/login", checkNotAuth, (req, res) => {
    res.render("login.ejs");
  });

  app.post("/login", passport.authenticate('local', {
    successRedirect: "/",
    failureRedirect: '/login',
    failureFlash: true,
  }));

  app.get("/register", (req, res) => {
    res.render("register.ejs");
  });

  app.post("/register", async (req, res) => {
    const { password, username, email } = req.body;
    const hashPass = await bcrypt.hash(password, Math.floor(Math.random() * 9)).catch(e => {
      res.redirect("/register");
    });

    const user = new User({ email, username, password: hashPass });
    
    user.save().then(data => {
      res.redirect("/login");
    })
    .catch(e => res.redirect("/register"));
  });

  server.listen(port, () => {
    console.log("Server started on port %s", port);
  });
}

function checkNotAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect("/");
  }

  next();
}

function checkAuth(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }

  res.redirect("/login");
}

module.exports = {
  startServer
};