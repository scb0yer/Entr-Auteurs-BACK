const express = require("express");
const router = express.Router();

const Review = require("../models/Review");
const Writer = require("../models/Writer");
const Contestation = require("../models/Contestation");
const Book = require("../models/Book");

const writerIsAuthenticated = require("../middlewares/writerIsAuthenticated");
const writerIsAdmin = require("../middlewares/writerIsAdmin");

// Routes pour les auteurs :
// // 1. Faire une réclamation
// -------- body : object, message, story_review
router.post(
  "/writer/contestation/add",
  writerIsAuthenticated,
  async (req, res) => {
    try {
      const writerFound = req.writerFound;
      const { object, message, story_review } = req.body;
      const date = new Date();
      const newContestation = new Contestation({
        object,
        message,
        story_review,
        date,
        status: "unread",
        book: story_review.book,
      });
      await newContestation.save();
      const contestations = [...writerFound.contestations];
      contestations.push({ contestation: newContestation._id });
      const updatedWriter = await Writer.findByIdAndUpdate(
        writerFound._id,
        {
          contestations,
        },
        { new: true }
      );
      await updatedWriter.save();
      const reviewToUpdate = await Review.findByIdAndUpdate(
        story_review,
        {
          status: "contested",
        },
        { new: true }
      );
      await reviewToUpdate.save();
      res.status(200).json(newContestation);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// Routes pour les admins :
// // 1. Afficher les contestations
// --- rien à transmettre
router.get("/admin/contestations", writerIsAdmin, async (req, res) => {
  try {
    const contestations = await Contestation.find().populate([
      `story_review`,
      `book`,
    ]);
    return res.status(200).json(contestations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// // 2. changer l'état d'une contestation et si terminé -> modifier le statut de la review (Review) + la délier de la fiche du livre (Book) + mettre un avertissement à l'auteur (Writer)
// -------- body : status (pending ou complete) et nullify (true) OU validate (true)
router.post("/admin/contestation/:id", writerIsAdmin, async (req, res) => {
  try {
    const contestation = await Contestation.findByIdAndUpdate(req.params.id);
    if (contestation.status === "complete") {
      return res.status(400).json({
        message: "Cette contestation a déjà été résolue.",
      });
    }
    const result = {};
    let status = "";
    if (req.body.status === "pending") {
      status = "pending";
    } else if (req.body.status === "complete") {
      if (req.body.nullify || req.body.validate) {
        status = "complete";
      } else {
        return res.status(400).json({
          message:
            "Si le statut est `complete`, il faut valider ou annuler la review.",
        });
      }
    } else {
      return res
        .status(400)
        .json({ message: "Le statut ne peut être que `pending`ou `complete`" });
    }
    const contestationToUpdate = await Contestation.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    await contestationToUpdate.save();
    result.contestation = contestationToUpdate;
    if (req.body.status === "complete" && req.body.nullify) {
      const reviewToUpdate = await Review.findByIdAndUpdate(
        contestationToUpdate.story_review,
        {
          status: "null",
        },
        { new: true }
      );
      await reviewToUpdate.save();
      const reviewer = await Writer.findById(reviewToUpdate.reviewer);
      const warnings = [...reviewer.warnings];
      warnings.push({
        admin: req.adminFound.writer_details.username,
        warning:
          "Tu as posté un avis inapproprié (pas objectif, injurieux ou sans bienveillance)",
      });
      const writers_details = reviewer.writer_details;
      if (warnings.length > 2) {
        writers_details.status = "Blacklisted";
      }
      const reviewerToUpdate = await Writer.findByIdAndUpdate(reviewer._id, {
        writers_details,
        warnings,
      });
      await reviewerToUpdate.save();
      result.warning = reviewerToUpdate;
    } else if (req.body.status === "complete" && req.body.validate) {
      const reviewToUpdate = await Review.findByIdAndUpdate(
        contestationToUpdate.story_review,
        {
          status: "approuved",
        },
        { new: true }
      );
      await reviewToUpdate.save();

      const book = await Book.findById(reviewToUpdate.book).populate(
        `story_reviews.story_review`
      );
      let story_reviews = [];
      let note = 0;
      if (book.story_reviews.length > 0) {
        story_reviews = [...book.story_reviews];
        for (let r = 0; r < story_reviews.length; r++) {
          const review = await Review.findById(story_reviews[r]._id);
          note +=
            review.review_details.orthographe.note1 +
            review.review_details.style.note2 +
            review.review_details.coherence.note3 +
            review.review_details.suspens.note4 +
            review.review_details.dialogues.note5;
        }
      }
      note +=
        reviewToUpdate.review_details.orthographe.note1 +
        reviewToUpdate.review_details.style.note2 +
        reviewToUpdate.review_details.coherence.note3 +
        reviewToUpdate.review_details.suspens.note4 +
        reviewToUpdate.review_details.dialogues.note5;
      story_reviews.push({ story_review: reviewToUpdate._id });
      note = note / 2 / story_reviews.length;
      const bookToUpdate = await Book.findByIdAndUpdate(
        book._id,
        {
          note,
          story_reviews,
        },
        { new: true }
      );
      await bookToUpdate.save();

      const writer = await Writer.findById(reviewToUpdate.writer);
      const warnings = [...writer.warnings];
      warnings.push({
        admin: req.adminFound.writer_details.username,
        warning:
          "Tu as contesté un avis alors qu'il n'avait rien d'inapproprié (objectif, pas injurieux et bienveillant)",
      });
      const writers_details = writer.writer_details;
      if (warnings.length > 2) {
        writers_details.status = "Blacklisted";
      }
      const writerToUpdate = await Writer.findByIdAndUpdate(writer._id, {
        writers_details,
        warnings,
      });
      await writerToUpdate.save();
      result.warning = writerToUpdate;
    }
    return res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
