const express = require("express");

const router = express.Router({ mergeParams: true });
const issueController = require("../controllers/issuesController");
const authController = require("../controllers/authController");

router
  .route("/stats")
  .get(authController.protector, issueController.issuesStats);

router
  .route("/raiseTicket")
  .post(
    authController.protector,
    authController.restrictTo("admin", "manager"),
    issueController.createIssue
  );

router.post(
  "/download-report",
  authController.protector,
  issueController.downloadExcelReport
);

router
  .route("/updateAssignedEngineer/:id")
  .patch(
    authController.protector,
    authController.restrictTo("admin", "manager"),
    issueController.updateAssignedEngineer
  );

router
  .route("/getPlant/:id")
  .get(authController.protector, issueController.getIssueByID);

router
  .route("/:id")
  .get(authController.protector, issueController.getAllIssues)
  .post(authController.protector, issueController.updateOpenorInprogressIssue);

module.exports = router;
