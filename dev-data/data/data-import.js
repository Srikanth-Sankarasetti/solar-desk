const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });
const PlantNames = require("../../models/plants");
const mongoose = require("mongoose");

const plant = JSON.parse(
  fs.readFileSync(`${__dirname}/plant-details.json`, "utf-8")
);

const port = process.env.PORT || 3000;

const db = process.env.DB_URL.replace("<db_password>", process.env.DB_PASSWORD);

const connectDb = async () => {
  try {
    await mongoose.connect(db);
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Database connection failed", error);
  }
};

connectDb();

const importData = async () => {
  try {
    await PlantNames.create(plant);
  } catch (error) {
    console.error(error);
  }
  process.exit();
};

const deleteData = async () => {
  try {
    await PlantNames.deleteMany();
  } catch (error) {
    console.error(error);
  }
  process.exit();
};

if (process.argv[2] === "--import") {
  importData();
}

if (process.argv[2] === "--delete") {
  deleteData();
}
