const mongoose = require("mongoose");
const bcypt = require("bcryptjs");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: {
        value: true,
        message: "name already taken",
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    confirmPassword: {
      type: String,
      required: true,
      select: false,
      validate: {
        validator: function (value) {
          return value === this.password;
        },
        message: "Passwords do not match",
      },
    },
    phone: {
      type: Number,
      unique: true,
    },
    role: {
      type: String,
      enum: {
        values: ["user", "engineer", "admin", "manager", "vendor"],
        message: "Role is either: engineer, admin, manager, vendor",
      },
      default: "engineer",
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: {
        values: ["pending", "approved", "rejected"],
        message: "Status is either: pending, approved, rejected",
      },
      default: "pending",
    },
    photo: {
      type: String,
      default:
        "https://res.cloudinary.com/ducrzzdqj/image/upload/v1748444223/default_wehzad.jpg",
    },
    isEmailVerfied: { type: Boolean, default: false },
    cloudinaryPublicId: String,
    passwordChangedAt: { type: Date },
    emailVerificationToken: String,
    emailVerificationExpires: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcypt.hash(this.password, 12);
  this.confirmPassword = undefined; // remove confirmPassword from the document
  next();
});

userSchema.pre("save", function (next) {
  if (!this.isModified("password") || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000; // to ensure the timestamp is before the JWT issued at time
  next();
});

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  // False means NOT changed
  return false;
};

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcypt.compare(candidatePassword, userPassword);
};

userSchema.methods.createEmailVerificationToken = function () {
  const token = crypto.randomBytes(32).toString("hex");

  this.emailVerificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  this.emailVerificationExpires = Date.now() + 15 * 60 * 1000;
  return token;
};

userSchema.methods.passwordResetTokenCreation = function () {
  const token = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 10 minutes

  return token; // Send this to user via email
};

const User = mongoose.model("Users", userSchema);

module.exports = User;
