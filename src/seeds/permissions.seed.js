import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import Permission from "../models/permission.model.js";
import Role from "../models/role.model.js";
import { PERMISSIONS, PERMISSION_LABELS } from "../constants/permissions.js";
import { ALL_ROLES } from "../constants/roles.js";
import logger from "../config/logger.js";

const seed = async () => {
  await connectDB();

  // Eski permission key'larni tozalash (cycles → oyliklar migratsiya)
  await Permission.deleteMany({ key: { $in: ["cycles.read", "cycles.settle"] } });

  const permIds = {};
  for (const key of Object.values(PERMISSIONS)) {
    const meta = PERMISSION_LABELS[key] || { label: key, group: "general" };
    const doc = await Permission.findOneAndUpdate(
      { key },
      { $set: { label: meta.label, group: meta.group } },
      { upsert: true, new: true },
    );
    permIds[key] = doc._id;
  }
  logger.info(`Permissions seed qilindi: ${Object.keys(permIds).length}`);

  const labels = { owner: "Egasi" };
  for (const value of ALL_ROLES) {
    await Role.findOneAndUpdate(
      { value },
      {
        $setOnInsert: { value, label: labels[value] },
        $set: { permissions: Object.values(permIds) },
      },
      { upsert: true, new: true },
    );
  }

  // Eski teacher/student rollarini tozalash (shablondan qolgan)
  await Role.deleteMany({ value: { $in: ["teacher", "student"] } });

  logger.info("Rollar seed qilindi");

  await disconnectDB();
};

seed().catch((err) => {
  logger.error({ err }, "Seed xato");
  process.exit(1);
});
