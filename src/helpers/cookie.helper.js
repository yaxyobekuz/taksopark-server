import env, { isProd } from "../config/env.js";

const REFRESH_COOKIE = "refreshToken";
// 7 kun (millisekundda)
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// Dev'da bir xil host (localhost) turli portlardagi panellar cookie'ni ulashib
// yuboradi (cookie domeni portni ajratmaydi). Sessiyalarni ajratish uchun dev'da
// cookie nomiga so'rov kelgan portni qo'shamiz. Prod'da nom o'zgarmaydi.
const cookieName = (req) => {
  if (isProd) return REFRESH_COOKIE;
  const source = req?.headers?.origin || req?.headers?.referer || "";
  const match = source.match(/:(\d+)/);
  return match ? `${REFRESH_COOKIE}_${match[1]}` : REFRESH_COOKIE;
};

const cookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  domain: env.COOKIE_DOMAIN || undefined,
  path: "/api/auth",
  signed: true,
});

export const setRefreshCookie = (req, res, token) => {
  res.cookie(cookieName(req), token, { ...cookieOptions(), maxAge: REFRESH_MAX_AGE });
};

export const clearRefreshCookie = (req, res) => {
  res.clearCookie(cookieName(req), cookieOptions());
};

export const getRefreshFromCookies = (req) =>
  req.signedCookies?.[cookieName(req)] || null;
