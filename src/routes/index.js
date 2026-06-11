import { Router } from "express";
import authRouter from "../modules/auth/auth.routes.js";
import usersRouter from "../modules/users/users.routes.js";
import adminsRouter from "../modules/admins/admins.routes.js";
import activityLogsRouter from "../modules/activityLogs/activityLogs.routes.js";
import carsRouter from "../modules/cars/cars.routes.js";
import carDocumentTypesRouter from "../modules/carDocumentTypes/carDocumentTypes.routes.js";
import driverDocumentTypesRouter from "../modules/driverDocumentTypes/driverDocumentTypes.routes.js";
import driversRouter from "../modules/drivers/drivers.routes.js";
import restdaysRouter from "../modules/restdays/restdays.routes.js";
import finesRouter from "../modules/fines/fines.routes.js";
import damagesRouter from "../modules/damages/damages.routes.js";

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
router.use("/rest-days", restdaysRouter);
router.use("/fines", finesRouter);
router.use("/damages", damagesRouter);

export default router;
