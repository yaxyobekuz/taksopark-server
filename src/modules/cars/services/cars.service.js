import Car from "../../../models/car.model.js";
import Driver from "../../../models/driver.model.js";
import ApiError from "../../../utils/ApiError.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const list = async ({ search, isActive, page = 1, limit = 20 }) => {
  const filter = {};
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;
  if (search && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [{ plateNumber: rx }, { model: rx }];
  }
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Car.find(filter)
      .populate("currentDriver", "firstName lastName phone status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Car.countDocuments(filter),
  ]);
  return { items, total };
};

export const getById = async (id) => {
  const car = await Car.findById(id).populate(
    "currentDriver",
    "firstName lastName phone status tariff",
  );
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  return car;
};

export const create = async (body) => {
  const plate = body.plateNumber?.trim() || null;
  if (plate) {
    const exists = await Car.findOne({ plateNumber: plate });
    if (exists) throw new ApiError(409, "Bunday raqamli mashina allaqachon mavjud");
  }
  return Car.create({
    plateNumber: plate,
    model: body.model,
    notes: body.notes || "",
    licenseExpiryDate: body.licenseExpiryDate ?? null,
    powerOfAttorneyExpiryDate: body.powerOfAttorneyExpiryDate ?? null,
  });
};

export const update = async (id, body) => {
  const car = await Car.findById(id);
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  if (body.plateNumber !== undefined) {
    const plate = body.plateNumber?.trim() || null;
    if (plate) {
      const dupe = await Car.findOne({
        plateNumber: plate,
        _id: { $ne: car._id },
      });
      if (dupe) throw new ApiError(409, "Bunday raqamli mashina allaqachon mavjud");
    }
    car.plateNumber = plate;
  }
  if (body.model !== undefined) car.model = body.model;
  if (body.notes !== undefined) car.notes = body.notes;
  if (body.isActive !== undefined) car.isActive = body.isActive;
  if (body.licenseExpiryDate !== undefined) car.licenseExpiryDate = body.licenseExpiryDate || null;
  if (body.powerOfAttorneyExpiryDate !== undefined) car.powerOfAttorneyExpiryDate = body.powerOfAttorneyExpiryDate || null;
  await car.save();
  return car;
};

export const listExpiring = async ({ limit = 5, days = 30 }) => {
  const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const items = await Car.find({
    isActive: true,
    $or: [
      { licenseExpiryDate: { $ne: null, $lte: cutoff } },
      { powerOfAttorneyExpiryDate: { $ne: null, $lte: cutoff } },
    ],
  })
    .populate("currentDriver", "firstName lastName phone")
    .lean();

  const minOf = (c) =>
    Math.min(
      c.licenseExpiryDate ? new Date(c.licenseExpiryDate).getTime() : Infinity,
      c.powerOfAttorneyExpiryDate ? new Date(c.powerOfAttorneyExpiryDate).getTime() : Infinity,
    );
  items.sort((a, b) => minOf(a) - minOf(b));
  return items.slice(0, limit);
};

export const softRemove = async (id) => {
  const car = await Car.findById(id);
  if (!car) throw new ApiError(404, "Mashina topilmadi");
  if (car.currentDriver) {
    const driver = await Driver.findById(car.currentDriver);
    if (driver && driver.status === "active") {
      throw new ApiError(409, "Mashinaga faol haydovchi biriktirilgan. Avval haydovchini ajrating");
    }
  }
  car.isActive = false;
  await car.save();
  return car;
};
