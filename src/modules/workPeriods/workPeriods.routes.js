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
} from "./validators/workPeriods.validator.js";
import list from "./handlers/list.handler.js";
import create from "./handlers/create.handler.js";
import update from "./handlers/update.handler.js";
import remove from "./handlers/remove.handler.js";

const router = Router();

router.get("/", requireAuth, requirePermission(PERMISSIONS.WORK_PERIODS_READ), validate(listSchema), list);
router.post("/", requireAuth, requirePermission(PERMISSIONS.WORK_PERIODS_MANAGE), validate(createSchema), create);
router.patch("/:id", requireAuth, requirePermission(PERMISSIONS.WORK_PERIODS_MANAGE), validate(updateSchema), update);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.WORK_PERIODS_MANAGE), validate(idSchema), remove);

export default router;
