const Writer = require("../models/Writer");

const writerIsAdmin = async (req, res, next) => {
  const token = req.headers.authorization.replace("Bearer ", "");
  const writerFound = await Writer.findOne({
    "connexion_details.token": token,
  });
  if (writerFound && writerFound.writer_details.role === "Admin") {
    req.adminFound = writerFound;
    next();
  } else {
    console.log("Not authorized");
    return res.status(401).json("Unauthorized 😾");
  }
};
module.exports = writerIsAdmin;
