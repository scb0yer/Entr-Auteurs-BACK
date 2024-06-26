const mongoose = require("mongoose");

const Book = mongoose.model("Book", {
  writer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Writer",
  },
  story_details: {
    story_title: String,
    story_url: String,
    story_cover: String,
    story_cat: String,
    story_description: String,
    story_mature: Boolean,
  },
  concours: [{ session_name: String, rank: Number }],
  statusForConcours: String,
  story_reviews: [
    {
      story_review: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    },
  ],
  note: Number,
  nbReviews: Number,
  views: Number,
  readers: [
    {
      reader: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Writer",
      },
    },
  ],
  isChecked: Boolean,
  status: String,
  isRegistered: String,
  dateOfCreation: Date,
});

module.exports = Book;
