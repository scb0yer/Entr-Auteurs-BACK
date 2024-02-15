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
    const ranking = [];
    for (let a = 0; a < count; a++) {
      let score = 0;
      for (let s = 0; s < authors[a].scores.length; s++) {
        score += authors[a].scores[s].score;
      }
      results.push({
        author: authors[a].account.username,
        // story_title: authors[a].story_details.story_title,
        story_url: authors[a].story_details.story_url,
        // story_cover: authors[a].story_details.story_cover,
        score: score,
      });
    }
    for (let s = count - 1; s >= 0; s--) {
      for (let a = 0; a < results.length; a++) {
        if (results[a].score === s) {
          ranking.push({
            story: results[a].story_url,
            score: results[a].score,
          });
        }
      }
    }
    console.log(ranking);
    for (let r = 0; r < ranking.length; r++) {
      if (r === 0) {
        for (let a = 0; a < results.length; a++) {
          if (results[a].story_url === ranking[r].story) {
            results[a].rank = 1;
          }
        }
      } else {
        if (ranking[r].score === ranking[r - 1].score) {
          for (let a = 0; a < results.length; a++) {
            if (results[a].story_url === ranking[r].story) {
              results[a].rank = r;
            }
          }
        } else {
          for (let a = 0; a < results.length; a++) {
            if (results[a].story_url === ranking[r].story) {
              results[a].rank = r + 1;
            }
          }
        }
      }
    }
    const sessionTerminated = await Session.findOneAndUpdate(
      { status: "ongoing" },
      {
        status: "complete",
        results: results,
      },
      { new: true }
    );
    await sessionTerminated.save();

    for (let a = 0; a < authors.length; a++) {
      const author = await Author.findByIdAndUpdate(
        authors[a]._id,
        {
          status: "Inactive",
          stories_assigned: [],
          stories_voted: [],
          scores: [],
        },
        { new: true }
      );
      await author.save();
    }
    return res.status(200).json(sessionTerminated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
