const mongoose = require("mongoose");

const Author = mongoose.model("Author", {
  account: {
    username: String,
    role: String,
  },
  email: String,
  status: String,
  story_details: {
    story_title: String,
    story_url: String,
    story_cover: String,
  },
  token: String,
  hash: String,
  salt: String,
  stories_assigned: [
    {
      week: String,
      stories: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Author",
        },
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Author",
        },
      ],
    },
  ],
  stories_voted: [
    {
      week: Number,
      story: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Author",
      },
    },
  ],
  scores: [{ week: Number, score: Number }],
});
module.exports = Author;
