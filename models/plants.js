const mongoose = require("mongoose");

const plantschema = new mongoose.Schema(
  {
    plantName: {
      type: String,
      required: [true, "Please provide a plant name"],
      trim: true,
      unique: true,
    },
    plantType: {
      type: String,
      required: [true, "Please provide a plant type"],
    },
    capacityKwp: {
      type: Number,
      required: [true, "Please provide a plant capacity"],
    },
    plantOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    Zone: {
      type: String,
      enum: {
        values: ["South", "North", "West", "East"],
        message: "zone should be South, North,West,East",
      },
    },
    vendor: String,
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

plantschema.virtual("Users", {
  ref: "Users",
  foreignField: "name",
  localField: "_id",
});

const PlantNames = mongoose.model("Plants", plantschema);
module.exports = PlantNames;
