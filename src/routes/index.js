import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";
import usersRouter from "../modules/users/users.routes.js";
import adminsRouter from "../modules/admins/admins.routes.js";
import activityLogsRouter from "../modules/activityLogs/activityLogs.routes.js";
import carsRouter from "../modules/cars/cars.routes.js";
import carPricesRouter from "../modules/carPrices/carPrices.routes.js";
import carDocumentTypesRouter from "../modules/carDocumentTypes/carDocumentTypes.routes.js";
import driverDocumentTypesRouter from "../modules/driverDocumentTypes/driverDocumentTypes.routes.js";
import driversRouter from "../modules/drivers/drivers.routes.js";
import workPeriodsRouter from "../modules/workPeriods/workPeriods.routes.js";
import carAssignmentsRouter from "../modules/carAssignments/carAssignments.routes.js";
import restdaysRouter from "../modules/restdays/restdays.routes.js";
import finesRouter from "../modules/fines/fines.routes.js";
import damagesRouter from "../modules/damages/damages.routes.js";
import paymentsRouter from "../modules/payments/payments.routes.js";
import financeRouter from "../modules/finance/finance.routes.js";

const router = Router();

router.get("/health", (_req, res) =>
  res.json({ success: true, message: "Server ishlayapti" }),
);

router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/admins", adminsRouter);
router.use("/activity-logs", activityLogsRouter);
router.use("/cars", carsRouter);
router.use("/car-prices", carPricesRouter);
router.use("/car-document-types", carDocumentTypesRouter);
router.use("/driver-document-types", driverDocumentTypesRouter);
router.use("/drivers", driversRouter);
router.use("/work-periods", workPeriodsRouter);
router.use("/car-assignments", carAssignmentsRouter);
router.use("/rest-days", restdaysRouter);
router.use("/fines", finesRouter);
router.use("/damages", damagesRouter);
router.use("/payments", paymentsRouter);
router.use("/finance", financeRouter);

export default router;
