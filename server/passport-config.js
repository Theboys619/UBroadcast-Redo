const LocalStrategy = require("passport-local").Strategy;
const bcrypt = require("bcrypt");

/**
 * Initalize passport configuration
 * @param {import("passport").PassportStatic} passport Passport
 * @param {import("mongoose").Model<import("mongoose").Document<any, {}>, {}>} User
 */
function initPassport(passport, User) {
  const authenticateUser = async (email, password, done) => {
    const users = await User.find({ email }).catch(e => {}) ?? [];
    const user = users[0];

    if (typeof user === "undefined" || user == null)
      return done(null, false, { message: "Username or password incorrect." });

    console.log(password, user);

    try {
      if (await bcrypt.compare(password, user.password)) {
        return done(null, user);
      } else {
        return done(null, false, { message: "Username or password incorrect." });
      }
    } catch (e) {
      return done(e);
    }
  }

  passport.use(new LocalStrategy({ usernameField: "email" }, authenticateUser));

  passport.serializeUser((user, done) => done(null, user._id));
  passport.deserializeUser((id, done) => {
    User.findById(id, (err, data) => {
      if (err) return done(err);

      return done(null, data);
    });
  });
}

module.exports = initPassport;