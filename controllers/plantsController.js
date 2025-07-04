const PlantNames = require("../models/plants");
const catchAsync = require("../utilis/catchAsync");
const User = require("../models/user");
const Issues = require("../models/issues");

exports.createPlant = catchAsync(async (req, res, next) => {
  const existingPlant = await PlantNames.findOne({
    plantName: req.body.plantName,
  });

  if (existingPlant) {
    return res.status(400).json({
      status: "fail",
      message: "Plant name already exists",
    });
  }

  const newPlant = await PlantNames.create(req.body);
  const plant = await PlantNames.findById(newPlant._id).populate(
    "plantOwner",
    "name"
  );
  console.log(plant.plantOwner);

  res.status(201).json({
    status: "success",
    data: {
      plant,
    },
  });
});

exports.getAllPlants = catchAsync(async (req, res, next) => {
  const plants = await PlantNames.find().populate("plantOwner", "name");
  res.status(200).json({
    status: "success",
    results: plants.length,
    data: {
      plants,
    },
  });
});

exports.plantAssigntoUser = catchAsync(async (req, res, next) => {
  const { plantId, ...fieldsToUpdate } = req.body;
  if (!plantId || !fieldsToUpdate) {
    return res.status(400).json({
      status: "fail",
      message: "plantIds and assignedEngineer are required",
    });
  }
  const plant = await PlantNames.findByIdAndUpdate(plantId, fieldsToUpdate, {
    new: true,
  });

  // Update all issues related to this plant
  await Issues.updateMany(
    { plantId: plant._id },
    { assignedEngineer: plant.plantOwner },
    { runValidators: false }
  );

  res.status(200).json({
    status: "success",
    data: {
      plant,
    },
  });
});
