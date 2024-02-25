const mongoose = require("mongoose");

const Session = mongoose.model("Session", {
  status: String,
  name: String,
  length: Number,
  weeks: Array,
  results: [
    {
      rank: Number,
      author: String,
      story_title: String,
      story_url: String,
      story_cover: String,
      score: Number,
    },
  ],
});
module.exports = Session;
