import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  dailyPlanSchema,
  financeSchema,
  driverStatementSchema,
} from "./validators/reports.validator.js";
import dailyPlanTotal from "./handlers/dailyPlanTotal.handler.js";
import finance from "./handlers/finance.handler.js";
import driverStatement from "./handlers/driverStatement.handler.js";
import minYear from "./handlers/minYear.handler.js";

const router = Router();

router.get(
  "/daily-plan-total",
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_READ),
  validate(dailyPlanSchema),
  dailyPlanTotal,
);
router.get(
  "/finance",
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_READ),
  validate(financeSchema),
  finance,
);
router.get(
  "/driver-statement/:driverId",
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_READ),
  validate(driverStatementSchema),
  driverStatement,
);
router.get(
  "/min-year",
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_READ),
  minYear,
);

export default router;
