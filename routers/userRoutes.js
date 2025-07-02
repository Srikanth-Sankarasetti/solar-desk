const express = require("express");
const userController = require("../controllers/usercontroller");
const authController = require("../controllers/authController");
const router = express.Router();

//user login
router.post("/login", userController.loginUser);

//account approval
router.post(
  "/approve/:id",
  authController.protector,
  authController.restrictTo("admin", "manager"),
  authController.userAccountApproval
);

//passwordUpdate
router.patch(
  "/updatePassword/:id",
  authController.protector,
  authController.updatePassword
);

//userUpdate
router.patch(
  "/updateMe/:id",
  authController.protector,
  userController.upload.single("photo"),
  userController.updateMe
);

//email verfication on signup
router.get("/verifyEmail/:token", userController.userEmailVerifcation);

//forgot password
router.post("/forgotPassword", authController.forgotPassword);

//password reset
router.patch("/reset-password/:token", authController.resetPassword);

//get all users
router
  .route("/")
  .get(
    authController.protector,
    authController.restrictTo("admin", "manager"),
    userController.getAllUsers
  )
  .post(userController.createUser);

router.get("/:id/getUser", authController.protector, userController.getUser);

//delete users
router.delete(
  "/:id/delete",
  authController.protector,
  authController.restrictTo("admin", "manager"),
  userController.deleteUser
);

//updateRole
router.patch(
  "/:id/updateRole",
  authController.protector,
  authController.restrictTo("admin", "manager"),
  authController.updateRole
);
module.exports = router;
