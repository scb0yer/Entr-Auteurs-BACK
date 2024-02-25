const express = require("express");
const router = express.Router();

const Book = require("../models/Book");
const Writer = require("../models/Writer");
const Review = require("../models/Review");
const Exchange = require("../models/Exchange");

const writerIsAuthenticated = require("../middlewares/writerIsAuthenticated");

// Routes pour les auteurs :
// // 1. Poster une review
// // 2. Valider une review

// Routes pour les auteurs :
// // 1. Poster une review
// -------- body : note1, comment1, note2, comment2, note3, comment3, note4, comment4, note5, comment5,
router.post("/writer/review/add", writerIsAuthenticated, async (req, res) => {
  try {
    const reviewerFound = JSON.stringify(req.writerFound._id).slice(1, 25);
    const reviewer = req.writerFound._id;
    const {
      note1,
      comment1,
      note2,
      comment2,
      note3,
      comment3,
      note4,
      comment4,
      note5,
      comment5,
    } = req.body;
    const note_global = (note1 + note2 + note3 + note4 + note5) / 2;
    let writer = "";
    let exchange_name = "";
    const exchange = await Exchange.findOne({ status: "ongoing" });
    for (let d = 0; d < exchange.draw.length; d++) {
      const reviewerToFind = JSON.stringify(exchange.draw[d].reviewer).slice(
        1,
        25
      );
      if (reviewerToFind === reviewerFound) {
        if (exchange.draw[d].review) {
          return res.status(400).json({
            message:
              "Tu as déjà posté une review pour cette session d'échange !",
          });
        }
        const book = exchange.draw[d].book;
        writer = exchange.draw[d].writer;
        exchange_name = exchange.name;

        const newReview = new Review({
          exchange_name,
          book,
          reviewer,
          writer,
          reviews_details: {
            orthographe: { note1, comment1 },
            style: { note2, comment2 },
            coherence: { note3, comment3 },
            suspens: { note4, comment4 },
            dialogues: { note5, comment5 },
          },
          note_global,
          status: "sent",
        });
        await newReview.save();

        exchange.draw[d].review = newReview._id;

        const exchangeToUpdate = await Exchange.findByIdAndUpdate(
          exchange._id,
          {
            draw: exchange.draw,
          },
          { new: true }
        );
        await exchangeToUpdate.save();

        const bookToFind = await Book.findById(book);
        const story_reviews = [...bookToFind.story_reviews];
        story_reviews.push(newReview._id);
        const bookToUpdate = await Book.findByIdAndUpdate(bookToFind, {
          story_reviews,
        });
        await bookToUpdate.save();
        const stories_assigned = [...req.writerFound.stories_assigned];
        const storyToFind = JSON.stringify(book).slice(1, 25);
        for (let s = 0; s < stories_assigned; s++) {
          const storyFound = JSON.stringify(
            stories_assigned[s].book_assigned
          ).slice(1, 25);
          if (storyFound === storyToFind) {
            stories_assigned[s].review = newReview._id;
            break;
          }
        }
        const reviews_count = req.writerFound.reviews_count + 1;
        const reviewerToUpdate = await Writer.findByIdAndUpdate(
          reviewer,
          {
            reviews_count,
            stories_assigned,
          },
          { new: true }
        );
        await reviewerToUpdate.save();
        return res.status(200).json(newReview);
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// // 2. Valider une review (et partager ou non)
// -------- body : review_id, share (boolean)
router.post(
  "/writer/review/validate",
  writerIsAuthenticated,
  async (req, res) => {
    try {
      const review_id = req.body.review_id;
      const review = await Review.findById(review_id);
      if (review.status !== "sent") {
        return res
          .status(400)
          .json({ message: "L'avis a déjà été validé ou contesté." });
      }
      const status = "approuved";
      let share = false;
      if (req.body.share === true) {
        share = true;
      }
      const reviewToUpdate = await Review.findByIdAndUpdate(
        review_id,
        {
          status,
          share,
        },
        { new: true }
      );
      await reviewToUpdate.save();
      return res.status(200).json(reviewToUpdate);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

module.exports = router;
