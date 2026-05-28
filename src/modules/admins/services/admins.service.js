import User from "../../../models/user.model.js";
import ApiError from "../../../utils/ApiError.js";
import { ROLES } from "../../../constants/roles.js";
import { PERMISSIONS, PERMISSION_LABELS } from "../../../constants/permissions.js";
import { normalizePhone } from "../../../utils/phone.js";

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Adminlarga berilishi mumkin bo'lgan ruxsatlar (admins.* bundan mustasno -
// admin hech qachon admin boshqaruvini ololmaydi).
const ASSIGNABLE_KEYS = Object.values(PERMISSIONS).filter(
  (k) => !k.startsWith("admins."),
);
const ASSIGNABLE_SET = new Set(ASSIGNABLE_KEYS);

const sanitizePermissions = (permissions) => {
  if (!Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((k) => ASSIGNABLE_SET.has(k)))];
};

// toJSON parolni olib tashlaydi; owner ko'rishi uchun qayta biriktiramiz.
const toAdminResponse = (doc) => {
  const obj = doc.toJSON();
  obj.password = doc.password ?? null;
  return obj;
};

export const permissionCatalog = () =>
  ASSIGNABLE_KEYS.map((key) => ({
    key,
    ...(PERMISSION_LABELS[key] || { label: key, group: "general" }),
  }));

export const list = async ({ search, isActive, page = 1, limit = 20 }) => {
  const filter = { role: ROLES.ADMIN };
  if (isActive === "true") filter.isActive = true;
  if (isActive === "false") filter.isActive = false;
  if (search && search.trim()) {
    const rx = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [{ firstName: rx }, { lastName: rx }, { username: rx }, { phone: rx }];
  }
  const skip = (page - 1) * limit;
  const [docs, total] = await Promise.all([
    User.find(filter).select("+password").sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items: docs.map(toAdminResponse), total };
};

export const getById = async (id) => {
  const doc = await User.findOne({ _id: id, role: ROLES.ADMIN }).select("+password");
  if (!doc) throw new ApiError(404, "Admin topilmadi");
  return toAdminResponse(doc);
};

export const create = async (body) => {
  const username = String(body.username || "").trim().toLowerCase();
  const exists = await User.findOne({ username });
  if (exists) throw new ApiError(409, "Bunday login band");

  let phone;
  if (body.phone) {
    phone = normalizePhone(body.phone);
    if (!phone) throw new ApiError(400, "Telefon raqam noto'g'ri");
  }

  const doc = await User.create({
    firstName: body.firstName,
    lastName: body.lastName,
    username,
    phone: phone || undefined,
    password: body.password,
    role: ROLES.ADMIN,
    permissions: sanitizePermissions(body.permissions),
    isActive: true,
    birthDate: body.birthDate ? new Date(body.birthDate) : null,
    gender: body.gender || null,
    address: body.address || "",
  });
  return toAdminResponse(doc);
};

export const update = async (id, body) => {
  const doc = await User.findOne({ _id: id, role: ROLES.ADMIN });
  if (!doc) throw new ApiError(404, "Admin topilmadi");

  if (body.firstName !== undefined) doc.firstName = body.firstName.trim();
  if (body.lastName !== undefined) doc.lastName = body.lastName.trim();
  if (body.isActive !== undefined) doc.isActive = !!body.isActive;
  if (body.phone !== undefined) {
    const phone = body.phone ? normalizePhone(body.phone) : null;
    if (body.phone && !phone) throw new ApiError(400, "Telefon raqam noto'g'ri");
    doc.phone = phone || undefined;
  }
  if (body.birthDate !== undefined) doc.birthDate = body.birthDate ? new Date(body.birthDate) : null;
  if (body.gender !== undefined) doc.gender = body.gender || null;
  if (body.address !== undefined) doc.address = body.address || "";

  await doc.save();
  return toAdminResponse(doc);
};

export const remove = async (id) => {
  const doc = await User.findOne({ _id: id, role: ROLES.ADMIN });
  if (!doc) throw new ApiError(404, "Admin topilmadi");
  await doc.deleteOne();
};

export const setPermissions = async (id, permissions) => {
  const doc = await User.findOne({ _id: id, role: ROLES.ADMIN });
  if (!doc) throw new ApiError(404, "Admin topilmadi");
  doc.permissions = sanitizePermissions(permissions);
  await doc.save();
  return toAdminResponse(doc);
};

export const changePassword = async (id, password) => {
  const doc = await User.findOne({ _id: id, role: ROLES.ADMIN }).select("+password");
  if (!doc) throw new ApiError(404, "Admin topilmadi");
  doc.password = password;
  doc.passwordHash = undefined;
  await doc.save();
  return toAdminResponse(doc);
};
