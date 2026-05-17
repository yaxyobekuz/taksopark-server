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
} from "./validators/drivers.validator.js";
import list from "./handlers/list.handler.js";
import getById from "./handlers/getById.handler.js";
import getBalance from "./handlers/getBalance.handler.js";
import warnings from "./handlers/warnings.handler.js";
import create from "./handlers/create.handler.js";
import update from "./handlers/update.handler.js";
import remove from "./handlers/remove.handler.js";
import recompute from "./handlers/recompute.handler.js";

const router = Router();

router.get("/warnings", requireAuth, requirePermission(PERMISSIONS.DRIVERS_READ), warnings);
router.get("/", requireAuth, requirePermission(PERMISSIONS.DRIVERS_READ), validate(listSchema), list);
router.get("/:id", requireAuth, requirePermission(PERMISSIONS.DRIVERS_READ), validate(idSchema), getById);
router.get("/:id/balance", requireAuth, requirePermission(PERMISSIONS.DRIVERS_READ), validate(idSchema), getBalance);
router.post("/", requireAuth, requirePermission(PERMISSIONS.DRIVERS_CREATE), validate(createSchema), create);
router.patch("/:id", requireAuth, requirePermission(PERMISSIONS.DRIVERS_UPDATE), validate(updateSchema), update);
router.post("/:id/recompute", requireAuth, requirePermission(PERMISSIONS.DRIVERS_UPDATE), validate(idSchema), recompute);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.DRIVERS_DELETE), validate(idSchema), remove);

export default router;
