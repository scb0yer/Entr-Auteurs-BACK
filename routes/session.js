const express = require("express");
const router = express.Router();

const Session = require("../models/Session");
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

module.exports = router;
