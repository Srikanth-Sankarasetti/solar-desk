const User = require("../models/user");
const catchAsync = require("../utilis/catchAsync");
const jwt = require("jsonwebtoken");
const AppError = require("../utilis/appError");
const sgMail = require("../utilis/email");

exports.protector = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({
      status: "fail",
      message: "please provide a authentication token",
    });
  }
  const token = authHeader.split(" ")[1];
  const decode = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findById(decode.id);
  if (!user) {
    return res.status(401).json({
      status: "fail",
      message: "user no longer exists",
    });
  }
  if (user.changedPasswordAfter(decode.iat)) {
    return res.status(401).json({
      status: "fail",
      message: "user recently changed password, please log in again",
    });
  }

  req.role = user.role;
  req.userId = decode.id;
  next();
});

exports.updateRole = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  console.log(req.body);
  const { role } = req.body;
  const user = await User.findByIdAndUpdate(
    id,
    { role },
    {
      new: true,
      runValidators: false,
    }
  );
  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});

exports.userAccountApproval = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;

  const user = await User.find({ _id: id });
  if (user.length === 0) {
    return res.status(400).json({
      status: "fail",
      message: "user not found",
    });
  }
  if (!user[0].isEmailVerfied) {
    return res.status(400).json({
      status: "Fail",
      message: "email verfication pending",
    });
  }
  if (user[0].status === "approved") {
    return res.status(400).json({
      status: "fail",
      message: "user account is already approved",
    });
  }
  if (user[0].status === "rejected") {
    return res.status(400).json({
      status: "fail",
      message: "user account is already rejected",
    });
  }
  user[0].status = status;
  await user[0].save({ validateBeforeSave: false });
  res.status(200).json({
    status: "success",
    message: "user account is approved",
  });
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    console.log(req.role);
    if (!roles.includes(req.role)) {
      return next(
        new AppError("you do not have permission to perform this action", 403)
      );
    }
    next();
  };
};

exports.updatePassword = catchAsync(async (req, res, next) => {
  const id = req.userId || req.params.id;
  if (!id) {
    return next(new AppError("user id is required", 400));
  }

  //check password and passwordConfirm are present
  const { currentPassword, password, confirmPassword } = req.body;
  if (!password || !confirmPassword) {
    return next(new AppError("password and passwordConfirm are required", 400));
  }

  //get the user by id
  const user = await User.findOne({ _id: id }).select("+password");

  if (user === null) {
    return next(new AppError("user not found", 404));
  }
  // check current password is correct
  if (!currentPassword) {
    return next(new AppError("current password is required", 400));
  }

  const isCurrentPasswordCorrect = await user.correctPassword(
    currentPassword,
    user.password
  );
  if (!isCurrentPasswordCorrect) {
    return next(new AppError("current password is incorrect", 400));
  }
  // Check if the user is trying to change the password to the same value
  const isPasswordCorrect = await user.correctPassword(password, user.password);
  if (isPasswordCorrect) {
    return next(
      new AppError("new password cannot be same as old password", 400)
    );
  }

  //update the password
  user.password = password;
  user.passwordChangedAt = password ? Date.now() - 1000 : undefined;
  await user.save({ validateBeforeSave: false });

  //send response
  res.status(200).json({
    status: "success",
    message: "Password Update Successfully, please login Again",
  });
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError("there is no user with that emil", 404));
  }
  const resetToken = user.passwordResetTokenCreation();
  await user.save({ validateBeforeSave: false });
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const msg = {
    to: user.email, // Change to your recipient
    from: "srikanthnani72888@gmail.com", // Change to your verified sender
    subject: "Sending with SendGrid is Fun",
    text: "and easy to do anywhere, even with Node.js",
    html: `
    <h2>Password Reset Request</h2>
    <p>Click below to reset your password:</p>
    <a href="${resetUrl}">Reset Your Password</a>
    <p>This link expires in 15 minutes.</p>`,
  };
  try {
    await sgMail.send(msg);
    res.status(200).json({
      status: "success",
      message: "Password resent token sent your mail",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    res.status(500).json({ status: "Fail", message: err });
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res
      .status(400)
      .json({ status: "fail", message: "Token invalid or expired" });
  }

  user.password = req.body.password;
  user.confirmPassword = req.body.confirmPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  res
    .status(200)
    .json({ status: "success", message: "Password reset successful" });
});
