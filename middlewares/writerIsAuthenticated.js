const Writer = require("../models/Writer");

const writerIsAuthenticated = async (req, res, next) => {
  const token = req.headers.authorization.replace("Bearer ", "");
  const writerFound = await Writer.findOne({
    "connexion_details.token": token,
  });
  if (writerFound && writerFound.status !== "Blacklisted") {
    req.writerFound = writerFound;
    const last_connexion = new Date();
    const updatedWriter = await Writer.findByIdAndUpdate(
      writerFound._id,
      {
        "connexion_details.last_connexion": last_connexion,
      },
      { new: true }
    );
    await updatedWriter.save();

    next();
  } else {
    return res.status(401).json("Connexion non autorisée 😾");
  }
};
module.exports = writerIsAuthenticated;
