const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const express = require("express");
const morgan = require("morgan");
const cors = require("cors");
const app = express();
const AppError = require("./utilis/appError");
const userRouter = require("./routers/userRoutes");
const plantRouter = require("./routers/plantRoutes");
const issueRouter = require("./routers/issuesRouter");
const globalErrorHandler = require("./utilis/globalErrorHandler");
const compression = require("compression");

app.use(express.json());
app.use(express.static(`${__dirname}/public`));
app.use(morgan("dev"));

app.use(cors());
app.use(compression());

app.use("/api/solar/v1/users", userRouter);
app.use("/api/solar/v1/plants", plantRouter);
app.use("/api/solar/v1/issues", issueRouter);

app.use((req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`);
  err.status = "fail";
  err.statusCode = 404;
  next(err); // Pass the error to the next middleware
});

app.use(globalErrorHandler);

module.exports = app;
