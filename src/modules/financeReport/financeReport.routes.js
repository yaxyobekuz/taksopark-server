import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { overviewSchema, recentSchema } from "./validators/financeReport.validator.js";
import overview from "./handlers/overview.handler.js";
import recent from "./handlers/recent.handler.js";
import integrity from "./handlers/integrity.handler.js";

const router = Router();

router.get(
  "/overview",
  requireAuth,
  requirePermission(PERMISSIONS.FINANCE_REPORT_READ),
  validate(overviewSchema),
  overview,
);

router.get(
  "/integrity",
  requireAuth,
  requirePermission(PERMISSIONS.FINANCE_REPORT_READ),
  integrity,
);

router.get(
  "/wallets/:wallet/recent",
  requireAuth,
  requirePermission(PERMISSIONS.FINANCE_REPORT_READ),
  validate(recentSchema),
  recent,
);

export default router;
