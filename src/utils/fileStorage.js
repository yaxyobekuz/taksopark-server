import fs from "node:fs";
import path from "node:path";

const UPLOAD_ROOT = path.resolve("uploads");

export const removeFileByUrl = (url) => {
  if (!url || typeof url !== "string") return;
  const rel = url.replace(/^\/uploads\//, "");
  if (!rel || rel === url) return;
  const full = path.resolve(UPLOAD_ROOT, rel);
  if (!full.startsWith(UPLOAD_ROOT)) return;
  fs.unlink(full, () => {});
};

export const fileToPublicUrl = (file) => {
  const rel = path.relative(UPLOAD_ROOT, file.path).split(path.sep).join("/");
  return `/uploads/${rel}`;
};
