const express = require("express");
const router = express.Router();

const Session = require("../models/Session");
const Author = require("../models/Author");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const newTirage = require("../functions/newTirage");

// Créer une route pour récupérer les infos des sessions
router.get("/admin/sessions", isAdmin, async (req, res) => {
  try {
    const sessions = await Session.find();
    const count = await Session.countDocuments();
    return res.status(200).json({ count: count, sessions: sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Créer une route pour enregistrer le classement final et clore une session (mettre le statut de tous les auteurs Active en Inactive)
router.post("/admin/endSession", isAdmin, async (req, res) => {
  try {
    const session = await Session.findOne({ status: "ongoing" });
    if (session.weeks.length < session.length) {
      return res
        .status(400)
        .json({ message: "La session n'est pas terminée ! 🙀" });
    }
    const filter = {};
    filter.status = "Active";
    const authors = await Author.find(filter);
    const count = await Author.countDocuments(filter);
    const results = [];
    for (let a = 0; a < count; a++) {
      let score = 0;
      for (let s = 0; s < authors[a].scores.length; s++) {
        score += authors[a].scores[s];
      }
    }
    return res.status(200).json({});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
