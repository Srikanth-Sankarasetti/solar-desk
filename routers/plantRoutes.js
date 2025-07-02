const express = require("express");

const router = express.Router({ mergeParams: true });
const plantController = require("../controllers/plantsController");
const authController = require("../controllers/authController");

router
  .route("/")
  .get(authController.protector, plantController.getAllPlants)
  .post(
    authController.protector,
    authController.restrictTo("admin", "manager"),
    plantController.createPlant
  );

router.patch(
  "/assignPlantToUser",
  authController.protector,
  authController.restrictTo("admin", "manager"),
  plantController.plantAssigntoUser
);

module.exports = router;
