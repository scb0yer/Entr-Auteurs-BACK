const Author = require("../models/Author");

const isAuthenticated = async (req, res, next) => {
  const token = req.headers.authorization.replace("Bearer ", "");
  const authorFound = await Author.findOne({ token });
  if (authorFound) {
    req.authorFound = authorFound;
    next();
  } else {
    return res.status(401).json("Unauthorized 😾");
  }
};
module.exports = isAuthenticated;
