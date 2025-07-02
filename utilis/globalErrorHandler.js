const AppError = require("../utilis/appError");

module.exports = (err, req, res, next) => {
  // Set default status code and status
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  if (err.name === "CastError") {
    const message = `Invalid ${err.path}: ${err.value}`;
    err = new AppError(message, 400);
  }

  if (process.env.NODE_ENV === "development") {
    // In development, send detailed error information
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      stack: err.stack,
    });
  }
  if (process.env.NODE_ENV === "production") {
    // In production, send a generic error message
    res.status(err.statusCode).json({
      status: err.status,
      message: err.isOperational ? err.message : "Something went wrong!",
    });
  }
};
