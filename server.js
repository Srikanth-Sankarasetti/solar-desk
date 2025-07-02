const app = require("./app");
const mongoose = require("mongoose");

const port = process.env.PORT || 3000;

const db = process.env.DB_URL.replace("<db_password>", process.env.DB_PASSWORD);

const connectDb = async () => {
  try {
    await mongoose.connect(db);
  } catch (error) {
    console.error("Database connection failed", error);
  }
};

connectDb();

app.listen(port, () => {
  console.log("Server is running on port 3000");
});
