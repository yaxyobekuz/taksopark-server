import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { uploader, singleUploader } from "../../middleware/upload.middleware.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  listSchema,
  idSchema,
  createSchema,
  updateSchema,
  listExpiringSchema,
  addDocumentSchema,
  updateDocumentSchema,
  docIdSchema,
} from "./validators/cars.validator.js";
import list from "./handlers/list.handler.js";
import listExpiring from "./handlers/listExpiring.handler.js";
import getById from "./handlers/getById.handler.js";
import create from "./handlers/create.handler.js";
import update from "./handlers/update.handler.js";
import remove from "./handlers/remove.handler.js";
import addDocument from "./handlers/addDocument.handler.js";
import updateDocument from "./handlers/updateDocument.handler.js";
import removeDocument from "./handlers/removeDocument.handler.js";

const router = Router();

router.get("/expiring", requireAuth, requirePermission(PERMISSIONS.CARS_READ), validate(listExpiringSchema), listExpiring);
router.get("/", requireAuth, requirePermission(PERMISSIONS.CARS_READ), validate(listSchema), list);
router.get("/:id", requireAuth, requirePermission(PERMISSIONS.CARS_READ), validate(idSchema), getById);
router.post("/", requireAuth, requirePermission(PERMISSIONS.CARS_CREATE), singleUploader("cars", "photo"), validate(createSchema), create);
router.patch("/:id", requireAuth, requirePermission(PERMISSIONS.CARS_UPDATE), singleUploader("cars", "photo"), validate(updateSchema), update);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.CARS_DELETE), validate(idSchema), remove);

router.post(
  "/:id/documents",
  requireAuth,
  requirePermission(PERMISSIONS.CARS_UPDATE),
  uploader("cars"),
  validate(addDocumentSchema),
  addDocument,
);
router.patch(
  "/:id/documents/:docId",
  requireAuth,
  requirePermission(PERMISSIONS.CARS_UPDATE),
  uploader("cars"),
  validate(updateDocumentSchema),
  updateDocument,
);
router.delete(
  "/:id/documents/:docId",
  requireAuth,
  requirePermission(PERMISSIONS.CARS_UPDATE),
  validate(docIdSchema),
  removeDocument,
);

export default router;
