import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  listSchema,
  idSchema,
  createSchema,
  updateSchema,
  setPermissionsSchema,
  changePasswordSchema,
} from "./validators/admins.validator.js";
import list from "./handlers/list.handler.js";
import getById from "./handlers/getById.handler.js";
import create from "./handlers/create.handler.js";
import update from "./handlers/update.handler.js";
import remove from "./handlers/remove.handler.js";
import setPermissions from "./handlers/setPermissions.handler.js";
import changePassword from "./handlers/changePassword.handler.js";
import permissionCatalog from "./handlers/permissionCatalog.handler.js";

const router = Router();

router.get("/permission-catalog", requireAuth, requirePermission(PERMISSIONS.ADMINS_READ), permissionCatalog);
router.get("/", requireAuth, requirePermission(PERMISSIONS.ADMINS_READ), validate(listSchema), list);
router.get("/:id", requireAuth, requirePermission(PERMISSIONS.ADMINS_READ), validate(idSchema), getById);
router.post("/", requireAuth, requirePermission(PERMISSIONS.ADMINS_CREATE), validate(createSchema), create);
router.patch("/:id", requireAuth, requirePermission(PERMISSIONS.ADMINS_UPDATE), validate(updateSchema), update);
router.patch(
  "/:id/permissions",
  requireAuth,
  requirePermission(PERMISSIONS.ADMINS_UPDATE),
  validate(setPermissionsSchema),
  setPermissions,
);
router.patch(
  "/:id/password",
  requireAuth,
  requirePermission(PERMISSIONS.ADMINS_UPDATE),
  validate(changePasswordSchema),
  changePassword,
);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.ADMINS_DELETE), validate(idSchema), remove);

export default router;
