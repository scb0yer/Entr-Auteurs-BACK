const Author = require("../models/Author");

const isAdmin = async (req, res, next) => {
  const token = req.headers.authorization.replace("Bearer ", "");
  const authorFound = await Author.findOne({ token });
  if (authorFound && authorFound.account.role === "Admin") {
    req.adminFound = authorFound;
    next();
  } else {
    console.log("Not authorized");
    return res.status(401).json("Unauthorized 😾");
  }
};
module.exports = isAdmin;
