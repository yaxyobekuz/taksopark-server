import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { byFineSchema, createSchema, idSchema } from "./validators/finePayments.validator.js";
import listByFine from "./handlers/listByFine.handler.js";
import create from "./handlers/create.handler.js";
import remove from "./handlers/remove.handler.js";

const router = Router();

router.get("/by-fine/:fineId", requireAuth, requirePermission(PERMISSIONS.FINES_READ), validate(byFineSchema), listByFine);
router.post("/", requireAuth, requirePermission(PERMISSIONS.FINES_PAY), validate(createSchema), create);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.FINES_PAY), validate(idSchema), remove);

export default router;
