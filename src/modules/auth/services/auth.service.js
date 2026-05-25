import User from "../../../models/user.model.js";
import RefreshToken from "../../../models/refreshToken.model.js";
import ApiError from "../../../utils/ApiError.js";
import { signAccess, signRefresh, verifyRefresh } from "../../../utils/jwt.js";
import { comparePassword } from "../../../helpers/password.helper.js";
import { collectPermissions } from "../../../helpers/permission.helper.js";
import { sha256 } from "../../../utils/hashToken.js";
import { normalizePhone, isPhoneLike } from "../../../utils/phone.js";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const buildRefreshExpiry = () => new Date(Date.now() + REFRESH_TTL_MS);

export const issueTokens = async (user, { userAgent, ip }) => {
  const payload = { sub: String(user._id), role: user.role };
  const accessToken = signAccess(payload);
  const refreshToken = signRefresh(payload);

  await RefreshToken.create({
    user: user._id,
    tokenHash: sha256(refreshToken),
    userAgent,
    ip,
    expiresAt: buildRefreshExpiry(),
  });

  return { accessToken, refreshToken };
};

export const sanitizeUser = (user) => {
  const obj = user.toJSON ? user.toJSON() : user;
  delete obj.passwordHash;
  return obj;
};

export const login = async ({ login, password, userAgent, ip }) => {
  const trimmed = String(login || "").trim();
  if (!trimmed) throw new ApiError(400, "Login kerak");

  const phone = isPhoneLike(trimmed) ? normalizePhone(trimmed) : null;
  const filters = [{ username: trimmed.toLowerCase() }];
  if (phone) filters.push({ phone });

  const user = await User.findOne({ $or: filters }).select("+passwordHash");
  if (!user || !user.isActive) {
    throw new ApiError(401, "Login yoki parol noto'g'ri");
  }

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Login yoki parol noto'g'ri");

  const { accessToken, refreshToken } = await issueTokens(user, {
    userAgent,
    ip,
  });

  return { accessToken, refreshToken, user: sanitizeUser(user) };
};

export const rotateRefresh = async ({ rawRefresh, userAgent, ip }) => {
  if (!rawRefresh) throw new ApiError(401, "Sessiya topilmadi");

  let payload;
  try {
    payload = verifyRefresh(rawRefresh);
  } catch {
    throw new ApiError(401, "Sessiya muddati tugagan");
  }

  const tokenHash = sha256(rawRefresh);
  const now = new Date();
  const revoked = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now } },
    { new: true },
  );
  if (!revoked) throw new ApiError(401, "Sessiya tugagan");

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new ApiError(401, "Foydalanuvchi topilmadi");
  }

  const { accessToken, refreshToken } = await issueTokens(user, {
    userAgent,
    ip,
  });

  return { accessToken, refreshToken, user: sanitizeUser(user) };
};

export const logout = async ({ rawRefresh }) => {
  if (!rawRefresh) return;
  const tokenHash = sha256(rawRefresh);
  await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
};

export const me = async (user) => {
  const permissions = await collectPermissions(user.role);
  return {
    user: sanitizeUser(user),
    role: user.role,
    permissions,
  };
};

