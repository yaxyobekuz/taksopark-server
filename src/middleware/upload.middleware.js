import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import ApiError from "../utils/ApiError.js";

const UPLOAD_ROOT = path.resolve("uploads");
const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME = /^(image\/(jpeg|jpg|png|webp|gif)|application\/pdf)$/i;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const buildStorage = (entity) =>
  multer.diskStorage({
    destination: (_req, _file, cb) => {
      const now = new Date();
      const yyyy = String(now.getUTCFullYear());
      const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
      const dir = path.join(UPLOAD_ROOT, entity, yyyy, mm);
      try {
        ensureDir(dir);
        cb(null, dir);
      } catch (e) {
        cb(e, dir);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || "";
      const name = `${crypto.randomUUID()}${ext.toLowerCase()}`;
      cb(null, name);
    },
  });

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME.test(file.mimetype)) {
    return cb(new ApiError(400, "Fayl turi qo'llab-quvvatlanmaydi"));
  }
  cb(null, true);
};

export const uploader = (entity, { maxFiles = 10 } = {}) =>
  multer({
    storage: buildStorage(entity),
    limits: { fileSize: MAX_SIZE, files: maxFiles },
    fileFilter,
  }).array("attachments", maxFiles);

export const singleUploader = (entity, field = "photo") =>
  multer({
    storage: buildStorage(entity),
    limits: { fileSize: MAX_SIZE, files: 1 },
    fileFilter,
  }).single(field);

export const buildPublicUrl = (entity, filename, date = new Date()) => {
  const yyyy = String(date.getUTCFullYear());
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `/uploads/${entity}/${yyyy}/${mm}/${filename}`;
};

export const fileToAttachment = (entity, file) => {
  const rel = path.relative(UPLOAD_ROOT, file.path).split(path.sep).join("/");
  return {
    url: `/uploads/${rel}`,
    filename: file.originalname,
    mime: file.mimetype,
    size: file.size,
  };
};
