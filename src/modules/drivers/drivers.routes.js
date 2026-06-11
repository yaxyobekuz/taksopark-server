import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { singleUploader, uploader } from "../../middleware/upload.middleware.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  listSchema,
  idSchema,
  createSchema,
  updateSchema,
  addDocumentSchema,
  updateDocumentSchema,
  docIdSchema,
} from "./validators/drivers.validator.js";
import list from "./handlers/list.handler.js";
import getById from "./handlers/getById.handler.js";
import create from "./handlers/create.handler.js";
import update from "./handlers/update.handler.js";
import remove from "./handlers/remove.handler.js";
import addDocument from "./handlers/addDocument.handler.js";
import updateDocument from "./handlers/updateDocument.handler.js";
import removeDocument from "./handlers/removeDocument.handler.js";

const router = Router();

router.get("/", requireAuth, requirePermission(PERMISSIONS.DRIVERS_READ), validate(listSchema), list);
router.get("/:id", requireAuth, requirePermission(PERMISSIONS.DRIVERS_READ), validate(idSchema), getById);
router.post("/", requireAuth, requirePermission(PERMISSIONS.DRIVERS_CREATE), singleUploader("drivers", "photo"), validate(createSchema), create);
router.patch("/:id", requireAuth, requirePermission(PERMISSIONS.DRIVERS_UPDATE), singleUploader("drivers", "photo"), validate(updateSchema), update);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.DRIVERS_DELETE), validate(idSchema), remove);

router.post(
  "/:id/documents",
  requireAuth,
  requirePermission(PERMISSIONS.DRIVERS_UPDATE),
  uploader("drivers"),
  validate(addDocumentSchema),
  addDocument,
);
router.patch(
  "/:id/documents/:docId",
  requireAuth,
  requirePermission(PERMISSIONS.DRIVERS_UPDATE),
  uploader("drivers"),
  validate(updateDocumentSchema),
  updateDocument,
);
router.delete(
  "/:id/documents/:docId",
  requireAuth,
  requirePermission(PERMISSIONS.DRIVERS_UPDATE),
  validate(docIdSchema),
  removeDocument,
);

export default router;
