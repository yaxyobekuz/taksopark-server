import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  monthViewSchema,
  planIdSchema,
  listTransactionsSchema,
  createPaymentSchema,
  reverseSchema,
} from "./validators/payments.validator.js";
import monthView from "./handlers/monthView.handler.js";
import getPlan from "./handlers/getPlan.handler.js";
import listTransactions from "./handlers/listTransactions.handler.js";
import createPayment from "./handlers/createPayment.handler.js";
import reverseTransaction from "./handlers/reverseTransaction.handler.js";
import releaseAuto from "./handlers/releaseAuto.handler.js";

const router = Router();

// Kunlik planlar (oylik ko'rinish + bitta plan)
router.get("/plans", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_READ), validate(monthViewSchema), monthView);
router.get("/plans/:id", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_READ), validate(planIdSchema), getPlan);
// Plandagi avtomatik (depozit/keshbek) qoplashni bekor qilish - pul manbaga qaytadi.
router.post("/plans/:id/release-auto", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_MANAGE), validate(planIdSchema), releaseAuto);

// Tranzaksiyalar (append-only)
router.get("/transactions", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_READ), validate(listTransactionsSchema), listTransactions);
router.post("/transactions", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_MANAGE), validate(createPaymentSchema), createPayment);
router.post("/transactions/:id/reverse", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_MANAGE), validate(reverseSchema), reverseTransaction);

export default router;
