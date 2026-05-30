import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  listSchema,
  createSchema,
  calendarSchema,
  idSchema,
} from "./validators/restdays.validator.js";
import list from "./handlers/list.handler.js";
import create from "./handlers/create.handler.js";
import remove from "./handlers/remove.handler.js";
import calendar from "./handlers/calendar.handler.js";

const router = Router();

router.get(
  "/calendar",
  requireAuth,
  requirePermission(PERMISSIONS.REST_DAYS_READ),
  validate(calendarSchema),
  calendar,
);
router.get("/", requireAuth, requirePermission(PERMISSIONS.REST_DAYS_READ), validate(listSchema), list);
router.post("/", requireAuth, requirePermission(PERMISSIONS.REST_DAYS_MANAGE), validate(createSchema), create);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.REST_DAYS_MANAGE), validate(idSchema), remove);

export default router;
