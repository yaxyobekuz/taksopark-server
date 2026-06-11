import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import User from "../models/user.model.js";
import Role from "../models/role.model.js";
import Permission from "../models/permission.model.js";
import RefreshToken from "../models/refreshToken.model.js";
import ActivityLog from "../models/activityLog.model.js";
import Car from "../models/car.model.js";
import Driver from "../models/driver.model.js";
import Fine from "../models/fine.model.js";
import Damage from "../models/damage.model.js";
import { PERMISSIONS, PERMISSION_LABELS } from "../constants/permissions.js";
import { ALL_ROLES, ROLES } from "../constants/roles.js";
import { hashPassword } from "../helpers/password.helper.js";
import logger from "../config/logger.js";

// Faqat owner login/parol qoladi - qolgan hamma data o'chiriladi
const OWNER = {
  username: "owner",
  firstName: "Bosh",
  lastName: "Ega",
  password: "owner123",
};

const seed = async () => {
  await connectDB();

  // Barcha biznes data + foydalanuvchilar + sessiyalarni tozalash
  await Promise.all([
    User.deleteMany({}),
    RefreshToken.deleteMany({}),
    ActivityLog.deleteMany({}),
    Car.deleteMany({}),
    Driver.deleteMany({}),
    Fine.deleteMany({}),
    Damage.deleteMany({}),
  ]);
  logger.info("Barcha data tozalandi (foydalanuvchilar, sessiyalar, biznes data)");

  // Permissionlarni qayta seed qilish
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

  // Eski teacher/student rollarini tozalash (shablondan qolgan)
  await Role.deleteMany({ value: { $in: ["teacher", "student"] } });

  // Rollarni qayta seed qilish - owner barcha permissionga ega
  const labels = { owner: "Egasi" };
  for (const value of ALL_ROLES) {
    await Role.findOneAndUpdate(
      { value },
      {
        $set: {
          label: labels[value],
          permissions: value === ROLES.OWNER ? Object.values(permIds) : [],
        },
      },
      { upsert: true, new: true },
    );
  }
  logger.info("Rollar seed qilindi");

  // Bitta owner foydalanuvchi
  const passwordHash = await hashPassword(OWNER.password);
  await User.create({
    firstName: OWNER.firstName,
    lastName: OWNER.lastName,
    username: OWNER.username,
    passwordHash,
    role: ROLES.OWNER,
    isActive: true,
  });
  logger.info(`Owner yaratildi (login: ${OWNER.username}, parol: ${OWNER.password})`);

  logger.info("Reset tugadi - faqat owner qoldi");
  await disconnectDB();
};

seed().catch((err) => {
  logger.error({ err }, "Reset seed xato");
  process.exit(1);
});
