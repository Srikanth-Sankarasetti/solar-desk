const express = require("express");
const userController = require("../controllers/usercontroller");
const authController = require("../controllers/authController");
const router = express.Router();

//user login
router.post("/login", userController.loginUser);

//get all users
router
  .route("/")
  .get(
    authController.protector,
    authController.restrictTo("admin", "manager"),
    userController.getAllUsers
  )
  .post(userController.createUser);

//forgot password
router.post("/forgotPassword", authController.forgotPassword);

router.get(
  "/userRole",
  authController.protector,
  userController.getLoginUserRole
);

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

//password reset
router.patch("/reset-password/:token", authController.resetPassword);

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
