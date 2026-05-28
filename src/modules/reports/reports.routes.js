import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  dailyPlanSchema,
  financeSchema,
  depositDriversMonthlySchema,
  dailyIncomeExpenseSchema,
  categoryMonthlySchema,
} from "./validators/reports.validator.js";
import dailyPlanTotal from "./handlers/dailyPlanTotal.handler.js";
import finance from "./handlers/finance.handler.js";
import minYear from "./handlers/minYear.handler.js";
import monthlyIncomeExpense from "./handlers/monthlyIncomeExpense.handler.js";
import depositDriversMonthly from "./handlers/depositDriversMonthly.handler.js";
import dailyIncomeExpense from "./handlers/dailyIncomeExpense.handler.js";
import categoryMonthly from "./handlers/categoryMonthly.handler.js";

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
  "/min-year",
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_READ),
  minYear,
);
router.get(
  "/monthly-income-expense",
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_READ),
  monthlyIncomeExpense,
);
router.get(
  "/deposit-drivers-monthly",
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_READ),
  validate(depositDriversMonthlySchema),
  depositDriversMonthly,
);
router.get(
  "/daily-income-expense",
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_READ),
  validate(dailyIncomeExpenseSchema),
  dailyIncomeExpense,
);
router.get(
  "/category-monthly",
  requireAuth,
  requirePermission(PERMISSIONS.REPORTS_READ),
  validate(categoryMonthlySchema),
  categoryMonthly,
);

export default router;
