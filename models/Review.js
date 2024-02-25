const mongoose = require("mongoose");

const Review = mongoose.model("Review", {
  exchange_name: String,
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book",
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Writer",
  },
  writer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Writer",
  },
  review_details: {
    orthographe: { note1: Number, comment1: String },
    style: { note2: Number, comment2: String },
    coherence: { note3: Number, comment3: String },
    suspens: { note4: Number, comment4: String },
    dialogues: { note5: Number, comment5: String },
  },
  note_global: Number,
  status: String,
  share: Boolean,
});

module.exports = Review;
