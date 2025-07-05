const mongoose = require("mongoose");
const Issues = require("../models/issues");
const PlantNames = require("../models/plants");
const Users = require("../models/user");
const catchAsync = require("../utilis/catchAsync");
const AppError = require("../utilis/appError");
const ApiFeature = require("../utilis/apiFeature");
const qs = require("qs");
const ExcelJS = require("exceljs");
const moment = require("moment");
const path = require("path");

function convertStringsToNumbers(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertStringsToNumbers);
  } else if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertStringsToNumbers(v)])
    );
  } else if (typeof obj === "string" && !isNaN(obj) && obj.trim() !== "") {
    return Number(obj); // convert string to number
  }
  return obj;
}

exports.getAllIssues = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const user = await Users.findById(id);
  if (!user) {
    return next(new AppError("User not found", 404));
  }
  const isAdmin = ["admin", "superadmin"].includes(user.role);

  const basePipeline = [];
  if (!isAdmin) {
    basePipeline.push({
      $match: {
        assignedEngineerName: user.name,
      },
    });
  }

  const feature = new ApiFeature(
    [],
    convertStringsToNumbers(qs.parse(req._parsedUrl.query)),
    true
  )
    .filter()
    .sort()
    .pageLimit();

  feature.pipeline.push({
    $project: {
      issueTitle: 1,
      issueTitleDescription: 1,
      status: 1,
      actionDescription: 1,
      category: 1,
      typeOfLoss: 1,

      resolvedAt: 1,

      generationLossKwh: 1,
      Zone: "$plant.Zone",
      plantName: "$plant.plantName",
      raisedByName: "$raisedByUser.name",
      assignedEngineerName: "$assignedEngineerUser.name",
      // "plant.capacityKwp": 1,
      plantCapacityKwp: "$plant.capacityKwp",
      createdAt: 1,
      subIssue: 1,
    },
  });

  if (feature.matchStage || feature.sortStage) {
    if (Object.keys(feature.matchStage).length > 0) {
      feature.pipeline.push(feature.matchStage);
    }
    if (Object.keys(feature.sortStage).length > 0) {
      feature.pipeline.push(feature.sortStage);
    }
  }

  basePipeline.unshift(...feature.pipeline);
  console.log(basePipeline);

  const issues = await Issues.aggregate(basePipeline);
  if (!issues) {
    return next(new AppError("No issues found", 404));
  }
  return res.status(200).json({
    status: "success",
    result: issues.length,
    data: {
      issues,
    },
  });
});

exports.createIssue = catchAsync(async (req, res, next) => {
  const { plantId, issueTitleDescription, issueTitle } = req.body;
  if (!plantId || !issueTitleDescription || !issueTitle) {
    return next(
      new AppError("Plant name and issueTitleDescription are required", 400)
    );
  }
  const plant = await PlantNames.findById(plantId);

  if (!plant) {
    return next(new AppError("Plant not found", 404));
  }
  const assignedEngineer = plant.plantOwner;
  const Zone = plant.Zone;
  const issue = await Issues.create({
    issueTitle,
    plantId,
    issueTitleDescription,
    assignedEngineer,
    Zone,
    raisedBy: req.userId,
  });
  res.status(201).json({
    status: "success",
    data: {
      issue,
    },
  });
});

exports.issuesStats = catchAsync(async (req, res, next) => {
  const { zone = "", engineerId = "" } = req.query;
  const userId = req.userId;
  const user = await Users.findById(userId);

  let allowedPlantIds = [];

  if (user.role !== "admin") {
    // Get only plants owned by this user
    const plants = await PlantNames.find({ plantOwner: user._id }).select(
      "_id"
    );
    allowedPlantIds = plants.map((p) => p._id);
  }

  const matchStage = {};
  if (engineerId && mongoose.Types.ObjectId.isValid(engineerId)) {
    matchStage.assignedEngineer = new mongoose.Types.ObjectId(engineerId);
  }

  const pipeline = [
    // Join with Plants collection
    {
      $lookup: {
        from: "plants", // collection name (lowercase, plural)
        localField: "plantId",
        foreignField: "_id",
        as: "plant",
      },
    },
    { $unwind: "$plant" },

    // Now plant.Zone is available
    {
      $match: {
        ...(zone && { "plant.Zone": zone }),
        ...(user.role !== "admin" && { plantId: { $in: allowedPlantIds } }),
        ...matchStage,
      },
    },
    {
      $addFields: {
        year: { $year: "$createdAt" },
      },
    },
    {
      $group: {
        _id: "$year",
        totalIssues: { $sum: 1 },
        open: { $sum: { $cond: [{ $eq: ["$status", "open"] }, 1, 0] } },
        inProgress: {
          $sum: { $cond: [{ $eq: ["$status", "in progress"] }, 1, 0] },
        },
        resolved: { $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] } },
        generationLossKwh: { $sum: "$generationLossKwh" },
        controllable: {
          $sum: { $cond: [{ $eq: ["$typeOfLoss", "Controllable"] }, 1, 0] },
        },
        uncontrollable: {
          $sum: { $cond: [{ $eq: ["$typeOfLoss", "UnControllable"] }, 1, 0] },
        },
      },
    },
    {
      $project: {
        year: "$_id",
        totalIssues: 1,
        open: 1,
        inProgress: 1,
        resolved: 1,
        generationLossKwh: 1,
        controllable: 1,
        uncontrollable: 1,
        resolutionRate: {
          $cond: [
            { $gt: ["$totalIssues", 0] },
            {
              $round: [
                {
                  $multiply: [{ $divide: ["$resolved", "$totalIssues"] }, 100],
                },
                0,
              ],
            },
            0,
          ],
        },
        _id: 0,
      },
    },
    { $sort: { year: 1 } },
  ];

  const topPlantPipeLine = [
    // Join with Plants to get Zone
    {
      $lookup: {
        from: "plants", // Adjust if your collection name differs
        localField: "plantId",
        foreignField: "_id",
        as: "plant",
      },
    },
    { $unwind: "$plant" },

    // Match by zone from plant, and optionally engineerId
    {
      $match: {
        ...(zone && { "plant.Zone": zone }),
        ...(user.role !== "admin" && { plantId: { $in: allowedPlantIds } }),
        ...matchStage,
      },
    },
    // Group by plantId to get total loss, count, and last issue date

    {
      $group: {
        _id: "$plantId",
        totalGenerationLossKwh: { $sum: "$generationLossKwh" },
        issueCount: { $sum: 1 },
        lastIssueDate: { $max: "$createdAt" },
        plant: { $first: "$plant" }, // keep plant data for projection
      },
    },
    {
      $project: {
        plantName: "$plant.plantName",
        totalGenerationLossKwh: 1,
        issueCount: 1,
        lastIssueDate: 1,
      },
    },
    { $sort: { totalGenerationLossKwh: -1 } },
    { $limit: 5 },
  ];

  const stats = await Issues.aggregate(pipeline);
  const topPlants = await Issues.aggregate(topPlantPipeLine);

  res.status(200).json({
    status: "success",
    stats,
    topPlants,
  });
});

exports.updateAssignedEngineer = catchAsync(async (req, res, next) => {
  const { issueId, assignedEngineer } = req.body;
  if (!issueId || !assignedEngineer) {
    return next(
      new AppError("Issue ID and assigned engineer are required", 400)
    );
  }
  const issue = await Issues.findById(issueId);
  if (!issue) {
    return next(new AppError("Issue not found", 404));
  }
  issue.assignedEngineer = assignedEngineer;
  await issue.save({ validateBeforeSave: false });
  res.status(200).json({
    status: "success",
    data: {
      issue,
    },
  });
});

exports.getIssueByID = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const result = await Issues.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(id) }, // filter by ID
    },
    {
      $lookup: {
        from: "plants",
        localField: "plantId",
        foreignField: "_id",
        as: "plant",
      },
    },
    {
      $unwind: { path: "$plant", preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: "users",
        localField: "raisedBy",
        foreignField: "_id",
        as: "raisedByUser",
      },
    },
    {
      $unwind: { path: "$raisedByUser", preserveNullAndEmptyArrays: true },
    },
    {
      $lookup: {
        from: "users",
        localField: "assignedEngineer",
        foreignField: "_id",
        as: "assignedEngineerUser",
      },
    },
    {
      $unwind: {
        path: "$assignedEngineerUser",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        issueTitle: 1,
        description: 1,
        status: 1,
        createdAt: 1,
        updatedAt: 1,
        issueTitleDescription: 1,
        plantName: "$plant.plantName",
        plantCapacityKwp: "$plant.capacityKwp",
        plantType: "$plant.plantType",
        assignedEngineer: "$assignedEngineerUser.name",
        raisedBy: "$raisedByUser.name",
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    result,
  });
});

exports.updateOpenorInprogressIssue = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  console.log(id);
  if (!id) {
    next(new AppError("id required to update", 404));
  }
  const updatedData = req.body;
  const updatedIssue = await Issues.findByIdAndUpdate(
    id,
    { $set: updatedData },
    {
      validateBeforeSave: false,
      new: true,
    }
  );

  if (!updatedIssue) {
    return res.status(404).json({ message: "Issue not found" });
  }

  res.status(200).json({
    status: "success",
    updatedIssue,
  });
});

exports.downloadExcelReport = catchAsync(async (req, res, next) => {
  const { startDate, endDate, plantType, zone, plantOwner } = req.body;
  const { userId } = req.userId;
  const user = await Users.findById(userId);

  const filter = {};
  if (startDate & endDate) {
    filter.createAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  if (plantType) filter["plant.plantType"] = plantType;
  if (zone) filter["plant.Zone"] = zone;
  if (plantOwner) filter["plant.plantOwner"] = plantOwner;

  const pipeline = [];
  if (Object.keys(filter).length > 0) {
    pipeline.push({
      $match: filter,
    });
  }

  pipeline.push({
    $project: {
      issueTitle: 1,
      issueTitleDescription: 1,
      createdAt: 1,
      resolvedAt: 1,
      generationLossKwh: 1,
      actionDescription: 1,
      category: 1,
      typeOfLoss: 1,
      status: 1,
      tat: {
        $cond: {
          if: { $and: ["$resolvedAt", "$createdAt"] },
          then: {
            $floor: {
              $divide: [
                { $subtract: ["$resolvedAt", "$createdAt"] },
                1000 * 60 * 60 * 24, // milliseconds to days
              ],
            },
          },
          else: null,
        },
      },
      plantName: "$plant.plantName",
      zone: "$plant.Zone",
      plantType: "$plant.plantType",
      plantOwner: "$assignedEngineerUser.name",
      capacityKwp: "$plant.capacityKwp",
    },
  });

  const issues = await Issues.aggregate(pipeline);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Issues Report");

  worksheet.columns = [
    { header: "Plant Name", key: "plantName", width: 30 },
    { header: "Plant Capacity Kwp", key: "capacityKwp", width: 30 },
    { header: "Zone", key: "zone", width: 15 },
    { header: "Plant Type", key: "plantType", width: 15 },
    { header: "Plant Owner", key: "plantOwner", width: 25 },
    { header: "Issue Title", key: "issueTitle", width: 25 },
    { header: "Issue Description", key: "issueTitleDescription", width: 40 },
    { header: "Action Taken", key: "actionDescription", width: 40 },
    { header: "Category", key: "category", width: 25 },
    { header: "Generation Loss (kWh)", key: "generationLossKwh", width: 20 },
    { header: "Type of Loss", key: "typeOfLoss", width: 20 },
    { header: "Status", key: "status", width: 15 },
    { header: "Created At", key: "createdAt", width: 18 },
    { header: "Resolved At", key: "resolvedAt", width: 18 },
    { header: "TAT (Days)", key: "tat", width: 12 },
  ];

  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E78" }, // Dark blue
    };
  });

  issues.forEach((issue) => {
    const createdAt = moment(issue.createdAt).format("DD-MM-YYYY");
    const solvedAt = issue.resolvedAt
      ? moment(issue.resolvedAt).format("DD-MM-YYYY")
      : null;
    worksheet.addRow({
      issueTitle: issue.issueTitle,
      status: issue.status,
      createdAt: createdAt,
      issueTitleDescription: issue.issueTitleDescription,
      actionDescription: issue.actionDescription,
      category: issue.category,
      generationLossKwh: issue.generationLossKwh,
      resolvedAt: solvedAt,
      typeOfLoss: issue.typeOfLoss,
      tat: issue.tat,
      plantName: issue.plantName,
      zone: issue.zone,
      plantType: issue.plantType,
      plantOwner: issue.plantOwner,
      capacityKwp: issue.capacityKwp,
    });
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=Issues_Report.xlsx`
  );

  await workbook.xlsx.write(res);
  res.end();
});
