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
      stories: Array,
    },
  ],
  stories_voted: [
    {
      week: Number,
      story: String,
    },
  ],
  scores: [{ week: Number, score: Number }],
});
module.exports = Author;
