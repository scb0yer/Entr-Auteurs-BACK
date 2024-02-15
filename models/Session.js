const mongoose = require("mongoose");

const Session = mongoose.model("Session", {
  status: String,
  index: Number,
  length: Number,
  weeks: Array,
  results: [
    {
      rang: Number,
      author: String,
      story_title: String,
      story_url: String,
      story_cover: String,
    },
  ],
});
module.exports = Session;
