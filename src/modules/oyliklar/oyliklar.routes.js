import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  listSchema,
  idSchema,
  driverIdParamSchema,
  createPayoutSchema,
  updatePayoutSchema,
  payoutIdSchema,
} from "./validators/oyliklar.validator.js";
import list from "./handlers/list.handler.js";
import getById from "./handlers/getById.handler.js";
import current from "./handlers/current.handler.js";
import statement from "./handlers/statement.handler.js";
import createPayout from "./handlers/createPayout.handler.js";
import updatePayout from "./handlers/updatePayout.handler.js";
import deletePayout from "./handlers/deletePayout.handler.js";

const router = Router();

router.get(
  "/",
  requireAuth,
  requirePermission(PERMISSIONS.OYLIKLAR_READ),
  validate(listSchema),
  list,
);
router.get(
  "/driver/:driverId/current",
  requireAuth,
  requirePermission(PERMISSIONS.OYLIKLAR_READ),
  validate(driverIdParamSchema),
  current,
);
router.get(
  "/driver/:driverId/statement",
  requireAuth,
  requirePermission(PERMISSIONS.OYLIKLAR_READ),
  validate(driverIdParamSchema),
  statement,
);
router.get(
  "/:id",
  requireAuth,
  requirePermission(PERMISSIONS.OYLIKLAR_READ),
  validate(idSchema),
  getById,
);
router.post(
  "/:id/payouts",
  requireAuth,
  requirePermission(PERMISSIONS.OYLIKLAR_PAYOUT),
  validate(createPayoutSchema),
  createPayout,
);
router.patch(
  "/:id/payouts/:payoutId",
  requireAuth,
  requirePermission(PERMISSIONS.OYLIKLAR_PAYOUT),
  validate(updatePayoutSchema),
  updatePayout,
);
router.delete(
  "/:id/payouts/:payoutId",
  requireAuth,
  requirePermission(PERMISSIONS.OYLIKLAR_PAYOUT),
  validate(payoutIdSchema),
  deletePayout,
);

export default router;
