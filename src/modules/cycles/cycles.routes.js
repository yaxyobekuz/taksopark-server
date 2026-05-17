import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { listSchema, idSchema, driverIdParamSchema } from "./validators/cycles.validator.js";
import list from "./handlers/list.handler.js";
import getById from "./handlers/getById.handler.js";
import current from "./handlers/current.handler.js";
import settle from "./handlers/settle.handler.js";

const router = Router();

router.get("/", requireAuth, requirePermission(PERMISSIONS.CYCLES_READ), validate(listSchema), list);
router.get(
  "/driver/:driverId/current",
  requireAuth,
  requirePermission(PERMISSIONS.CYCLES_READ),
  validate(driverIdParamSchema),
  current,
);
router.get("/:id", requireAuth, requirePermission(PERMISSIONS.CYCLES_READ), validate(idSchema), getById);
router.post(
  "/:id/settle",
  requireAuth,
  requirePermission(PERMISSIONS.CYCLES_SETTLE),
  validate(idSchema),
  settle,
);

export default router;
