import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { uploader } from "../../middleware/upload.middleware.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  listSchema,
  idSchema,
  createSchema,
  updateSchema,
} from "./validators/fines.validator.js";
import list from "./handlers/list.handler.js";
import getById from "./handlers/getById.handler.js";
import create from "./handlers/create.handler.js";
import update from "./handlers/update.handler.js";
import remove from "./handlers/remove.handler.js";

const router = Router();

router.get("/", requireAuth, requirePermission(PERMISSIONS.FINES_READ), validate(listSchema), list);
router.get("/:id", requireAuth, requirePermission(PERMISSIONS.FINES_READ), validate(idSchema), getById);
router.post(
  "/",
  requireAuth,
  requirePermission(PERMISSIONS.FINES_CREATE),
  uploader("fines"),
  validate(createSchema),
  create,
);
router.patch("/:id", requireAuth, requirePermission(PERMISSIONS.FINES_UPDATE), validate(updateSchema), update);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.FINES_DELETE), validate(idSchema), remove);

export default router;
