const mongoose = require("mongoose");

const Exchange = mongoose.model("Exchange", {
  status: String,
  name: String,
  draw: [
    {
      reviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Writer",
      },
      book: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
      writer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Writer",
      },
      review: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    },
  ],
});
module.exports = Exchange;
