const xlsx = require("xlsx");
const path = require("path");
const fs = require("fs");

const workbook = xlsx.readFile(path.join(__dirname, "Plant details.xlsx"));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];

const jsonData = xlsx.utils.sheet_to_json(worksheet, { raw: false });
fs.writeFileSync(
  path.join(__dirname, "plant-details.json"),
  JSON.stringify(jsonData, null, 2),
  "utf-8"
);
