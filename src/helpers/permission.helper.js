import Role from "../models/role.model.js";
import { ROLES } from "../constants/roles.js";

// Owner gets ["*"] (code-base rule: super-admin). Adminlar ruxsatlari userning
// o'zida (user.permissions) saqlanadi. Boshqa rollar uchun eski Role lookup.
export const collectPermissions = async (user) => {
  if (!user) return [];
  if (user.role === ROLES.OWNER) return ["*"];
  if (user.role === ROLES.ADMIN) return user.permissions || [];
  const doc = await Role.findOne({ value: user.role }).populate("permissions");
  return (doc?.permissions || []).map((p) => p.key);
};

export const hasPermission = (permissions, key) => {
  if (!permissions) return false;
  if (permissions.includes("*")) return true;
  return permissions.includes(key);
};
