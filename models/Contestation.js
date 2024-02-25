const mongoose = require("mongoose");

const Contestation = mongoose.model("Contestation", {
  object: String,
  message: String,
  story_review: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Review",
  },
  date: Date,
  status: String,
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book",
  },
});

module.exports = Contestation;
