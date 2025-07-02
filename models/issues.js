const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    issueTitle: {
      type: String,
      required: true,
    },
    plantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plants",
      required: true,
    },
    issueTitleDescription: {
      type: String,
      required: true,
    },
    actionDescription: {
      type: String,
    },
    category: {
      type: String,
    },
    subIssue: String,
    typeOfLoss: {
      type: String,
      enum: {
        values: ["Controllable", "UnControllable"],
        message: "should be Controllable or UnControllable",
      },
    },
    status: {
      type: String,
      enum: {
        values: ["open", "in progress", "resolved"],
        message: "Status is either: open, in progress, resolved",
      },
      default: "open",
    },
    Zone: {
      type: String,
      enum: {
        values: ["South", "North", "West", "East"],
        message: "zone should be South, North,West,East",
      },
    },
    vendor: String,
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    assignedEngineer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    generationLossKwh: {
      type: Number,
    },
    resolvedAt: {
      type: Date,
    },
  },
  {
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  }
);

issueSchema.pre("aggregate", function (next) {
  this.pipeline().unshift(
    {
      $lookup: {
        from: "plants",
        localField: "plantId",
        foreignField: "_id",
        as: "plant",
      },
    },
    {
      $unwind: { path: "$plant", preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: "users",
        localField: "raisedBy",
        foreignField: "_id",
        as: "raisedByUser",
      },
    },
    {
      $unwind: { path: "$raisedByUser", preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: "users",
        localField: "assignedEngineer",
        foreignField: "_id",
        as: "assignedEngineerUser",
      },
    },
    {
      $unwind: {
        path: "$assignedEngineerUser",
        preserveNullAndEmptyArrays: true,
      },
    }
  );
  next();
});

const Issues = mongoose.model("Issues", issueSchema);

module.exports = Issues;
