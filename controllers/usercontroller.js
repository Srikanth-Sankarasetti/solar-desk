const User = require("./../models/user");
const PlantNames = require("./../models/plants");
const Issues = require("./../models/issues");
const catchAsync = require("./../utilis/catchAsync");
const jwt = require("jsonwebtoken");
const AppError = require("./../utilis/appError");
const qs = require("qs");
const multer = require("multer");
const sharp = require("sharp");
const cloudinary = require("../utilis/cloudinary");
const storage = multer.memoryStorage();
const sgMail = require("../utilis/email");
const crypto = require("crypto");

const uploadBufferToCloudinary = (buffer, filename) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: "uploads", public_id: filename },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      )
      .end(buffer);
  });
};

exports.upload = multer({ storage });

exports.createUser = catchAsync(async (req, res, next) => {
  const { name, email, password, confirmPassword } = req.body;
  const existingUser = await User.find({ email });
  if (existingUser.length > 0) {
    return res.status(400).json({
      status: "fail",
      message: "user already exists",
    });
  }
  const newUser = await User({
    name,
    email,
    password,
    confirmPassword,
    passwordChangedAt: Date.now() - 1000,
  });
  const verficationToken = newUser.createEmailVerificationToken();
  if (verficationToken) {
    await newUser.save({ validateBeforeSave: false });
  }

  const verficationURL = `${process.env.FRONTEND_URL}/verify-email/${verficationToken}`;

  try {
    await sgMail.send({
      to: email,
      from: "srikanthnani72888@gmail.com",
      subject: "Email Verification",
      html: `<h1>Hi ${name}, please verify your email</h1>
           <p>Click the button below to verify your email and use our services.</p>
           <a href="${verficationURL}">Verify Mail</a>`,
    });
  } catch (err) {
    console.error("Email send failed:", err.response?.body || err.message);
    return res.status(500).json({
      status: "fail",
      message: "Failed to send verification email",
    });
  }
  res.status(201).json({
    status: "success",
    message: "account created , please verify your email",
  });
});

exports.userEmailVerifcation = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const createHashCode = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  const user = await User.findOne({
    emailVerificationToken: createHashCode,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.status(400).json({
      status: "fail",
      message: "Token is invalid or has expired",
    });
  }
  user.isEmailVerfied = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });
  res.status(200).json({
    status: "success",
    message:
      "Email verified successfully!,let you know once account is approved",
  });
});

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = await User.find();
  res.status(200).json({
    status: "success",
    results: users.length,
    data: {
      users,
    },
  });
});

exports.loginUser = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  const user = await User.find({ email }).select("+password");
  if (!user[0]) {
    return res.status(400).json({
      status: "fail",
      message: "No Account With This Email",
    });
  }

  const isPasswordCorrect = await user[0].correctPassword(
    password,
    user[0].password
  );
  console.log(isPasswordCorrect);
  if (!isPasswordCorrect) {
    return res.status(400).json({
      status: "fail",
      message: "Incorrect Password",
    });
  }
  if (!user[0].isEmailVerfied) {
    return res.status(400).json({
      status: "Fail",
      message: "Please Verify Your mail",
    });
  }
  if (user[0].status !== "approved") {
    return res.status(400).json({
      status: "fail",
      message: "Your Account is Not Approved Yet",
    });
  }
  const token = jwt.sign(
    {
      id: user[0]._id,
      role: user[0].role,
      email: user[0].email,
      name: user[0].name,
      image: user[0].photo,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );

  res.status(200).json({
    status: "success",
    token,
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findByIdAndDelete(id, { new: true });
  if (!user) {
    // return res.status(404).json({
    //   status: "fail",
    //   message: "user not found",
    // });
    return next(new AppError("user not found", 404));
  }

  res.status(200).json({
    status: "success",
    message: "user deleted successfully",
  });
});

exports.updateMe = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  if (!id) {
    return next(new AppError("user id is required", 400));
  }

  //get the user by id
  const user = await User.findOne({ _id: id });
  if (user === null) {
    return next(new AppError("user not found", 404));
  }

  if (user.cloudinaryPublicId) {
    await cloudinary.uploader.destroy(user.cloudinaryPublicId);
  }

  let result;
  if (req.file) {
    const resizedImageBuffer = await sharp(req.file.buffer)
      .resize({ width: 300, height: 300 }) // Resize to 300*300px.
      .toFormat("jpeg")
      .jpeg({ quality: 90 }) // Compress to 80% quality JPEG
      .toBuffer();
    result = await uploadBufferToCloudinary(
      resizedImageBuffer,
      req.file.originalname.split(".")[0]
    );
  }

  //update the user profile
  console.log(req.body);
  const { name } = req.body;

  if (name) user.name = name;
  await user.save({ validateBeforeSave: false });

  if (result.secure_url) user.photo = result.secure_url;
  user.cloudinaryPublicId = result.public_id;

  await user.save({ validateBeforeSave: false });

  //send response
  res.status(200).json({
    status: "success",
    user,
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = await User.findById({ _id: id });
  console.log(user);
  if (!user) {
    return next(new AppError("User not found", 400));
  }
  res.status(200).json({
    status: "success",
    user,
  });
});
