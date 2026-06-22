import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  monthQuerySchema,
  dateQuerySchema,
  driverIdParamSchema,
  txIdParamSchema,
  cashbackPayoutSchema,
  depositMovementSchema,
} from "./validators/finance.validator.js";
import overview from "./handlers/overview.handler.js";
import dailyPayments, { dailyPaymentsByDate } from "./handlers/dailyPayments.handler.js";
import {
  cashbacksList,
  cashbackDriver,
  cashbackPayout,
  cashbackReverse,
} from "./handlers/cashbacks.handler.js";
import {
  depositsList,
  depositDriver,
  depositMovement,
  depositReverse,
} from "./handlers/deposits.handler.js";

const router = Router();
const read = requirePermission(PERMISSIONS.PAYMENTS_READ);
const manage = requirePermission(PERMISSIONS.PAYMENTS_MANAGE);

// Hisobotlar / umumiy kunlik to'lovlar
router.get("/overview", requireAuth, read, validate(monthQuerySchema), overview);
router.get("/daily-payments", requireAuth, read, validate(monthQuerySchema), dailyPayments);
router.get("/daily-payments/by-date", requireAuth, read, validate(dateQuerySchema), dailyPaymentsByDate);

// Keshbeklar
router.get("/cashbacks", requireAuth, read, cashbacksList);
router.get("/cashbacks/:driverId", requireAuth, read, validate(driverIdParamSchema), cashbackDriver);
router.post("/cashbacks/payout", requireAuth, manage, validate(cashbackPayoutSchema), cashbackPayout);
router.post("/cashbacks/transactions/:id/reverse", requireAuth, manage, validate(txIdParamSchema), cashbackReverse);

// Depozitlar
router.get("/deposits", requireAuth, read, depositsList);
router.get("/deposits/:driverId", requireAuth, read, validate(driverIdParamSchema), depositDriver);
router.post("/deposits/movement", requireAuth, manage, validate(depositMovementSchema), depositMovement);
router.post("/deposits/transactions/:id/reverse", requireAuth, manage, validate(txIdParamSchema), depositReverse);

export default router;
