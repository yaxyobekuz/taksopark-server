import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";
import usersRouter from "../modules/users/users.routes.js";
import adminsRouter from "../modules/admins/admins.routes.js";
import activityLogsRouter from "../modules/activityLogs/activityLogs.routes.js";
import carsRouter from "../modules/cars/cars.routes.js";
import carDocumentTypesRouter from "../modules/carDocumentTypes/carDocumentTypes.routes.js";
import driverDocumentTypesRouter from "../modules/driverDocumentTypes/driverDocumentTypes.routes.js";
import driversRouter from "../modules/drivers/drivers.routes.js";
import paymentsRouter from "../modules/payments/payments.routes.js";
import finesRouter from "../modules/fines/fines.routes.js";
import damagesRouter from "../modules/damages/damages.routes.js";
import oyliklarRouter from "../modules/oyliklar/oyliklar.routes.js";
import reportsRouter from "../modules/reports/reports.routes.js";
import finePaymentsRouter from "../modules/finePayments/finePayments.routes.js";
import damagePaymentsRouter from "../modules/damagePayments/damagePayments.routes.js";
import transactionsRouter from "../modules/transactions/transactions.routes.js";
import transactionCategoriesRouter from "../modules/transactionCategories/transactionCategories.routes.js";

const router = Router();

router.get("/health", (_req, res) =>
  res.json({ success: true, message: "Server ishlayapti" }),
);

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/admins", adminsRouter);
router.use("/activity-logs", activityLogsRouter);
router.use("/cars", carsRouter);
router.use("/car-document-types", carDocumentTypesRouter);
router.use("/driver-document-types", driverDocumentTypesRouter);
router.use("/drivers", driversRouter);
router.use("/payments", paymentsRouter);
router.use("/fines", finesRouter);
router.use("/damages", damagesRouter);
router.use("/oyliklar", oyliklarRouter);
router.use("/reports", reportsRouter);
router.use("/fine-payments", finePaymentsRouter);
router.use("/damage-payments", damagePaymentsRouter);
router.use("/transactions", transactionsRouter);
router.use("/transaction-categories", transactionCategoriesRouter);

export default router;
