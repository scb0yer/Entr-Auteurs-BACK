const express = require("express");
const router = express.Router();

const Session = require("../models/Session");
const Author = require("../models/Author");
const Book = require("../models/Book");
const isAdmin = require("../middlewares/isAdmin");

// Routes pour les visiteurs :
// // 1. Récupérer les résultats d'une session (get)
// // 2. Récupérer les résultats de toutes les sessions complètes (get)
// Routes pour les admins :
// // 1. Récupérer les infos des sessions (get)
// // 2. Lancer une nouvelle semaine (post)
// // 3. Enregistrer le classement final et clore une session (post)

// --------------------------- Routes pour les Visiteurs ---------------------------
// 1. Récupérer les résultats d'une session (get)
router.get("/session/:index", async (req, res) => {
  try {
    const name = req.params.index;
    const session = await Session.findOne({ name });
    if (session.status === "ongoing") {
      throw {
        status: 404,
        message:
          "On ne peut pas récupérer les informations d'une session en cours.",
      };
    } else {
      return res.status(200).json(session);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Récupérer les résultats de toutes les sessions complètes (get)
router.get("/sessions", async (req, res) => {
  try {
    const sessions = await Session.find({ status: "complete" });
    return res.status(200).json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --------------------------- Routes pour les Admin ---------------------------
// 1. Récupérer les infos des sessions
router.get("/admin/sessions", isAdmin, async (req, res) => {
  try {
    const sessions = await Session.find();
    const count = await Session.countDocuments();
    return res.status(200).json({ count: count, sessions: sessions });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Lancer une nouvelle semaine
router.post("/admin/week", isAdmin, async (req, res) => {
  try {
    const session = await Session.findOne({ status: "ongoing" });
    const weeks = [...session.weeks];
    const filter = {};
    filter.status = "Active";
    const authors = await Author.find(filter);
    for (let a = 0; a < authors.length; a++) {
      if (authors[a].stories_voted.length < weeks.length) {
        const stories_voted = [...authors[a].stories_voted];
        stories_voted.push({ week: weeks.length, story: "penalty" });
        const author = await Author.findByIdAndUpdate(
          authors[a]._id,
          {
            stories_voted: stories_voted,
          },
          { new: true }
        );
        await author.save();
      }
    }
    if (weeks.length < session.length) {
      const week = weeks.length + 1;
      weeks.push(week);
    }
    const updatedSession = await Session.findOneAndUpdate(
      { status: "ongoing" },
      {
        weeks: weeks,
      },
      { new: true }
    );
    return res.status(200).json(updatedSession);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Enregistrer le classement final et clore une session (mettre le statut de tous les auteurs Active en Inactive)
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
    let score = 0;
    let penalties = 0;
    for (let a = 0; a < count; a++) {
      score = 0;
      for (let s = 0; s < authors[a].scores.length; s++) {
        score += authors[a].scores[s].score;
      }
      penalties = 0;
      for (let w = 0; w < authors[a].stories_voted.length; w++) {
        if (authors[a].stories_voted[w].story === "penalty") {
          penalties += 2;
        }
      }
      const result = score - penalties;
      results.push({
        author: authors[a].account.username,
        story_title: authors[a].story_details.story_title,
        story_url: authors[a].story_details.story_url,
        story_cover: authors[a].story_details.story_cover,
        score: result,
      });
    }
    for (let s = count - 1; s >= -(count * 2); s--) {
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
            ranking[r].rank = 1;
          }
        }
      } else {
        if (ranking[r].score === ranking[r - 1].score) {
          for (let a = 0; a < results.length; a++) {
            if (results[a].story_url === ranking[r].story) {
              results[a].rank = ranking[r - 1].rank;
              ranking[r].rank = ranking[r - 1].rank;
            }
          }
        } else {
          for (let a = 0; a < results.length; a++) {
            if (results[a].story_url === ranking[r].story) {
              results[a].rank = r + 1;
              ranking[r].rank = r + 1;
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
    for (let r = 0; r < results.length; r++) {
      const book = await Book.findOne({
        "story_details.story_url": results[r].story_url,
      });
      const concours = [...book.concours];
      concours.push({ session_name: session.name, rank: results[r].rank });
      const bookUpdated = await Book.findByIdAndUpdate(book._id, {
        concours,
        statusForConcours: "Inactive",
      });
      await bookUpdated.save();
    }
    return res.status(200).json(sessionTerminated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
