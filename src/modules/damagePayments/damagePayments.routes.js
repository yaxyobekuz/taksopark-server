import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import { byDamageSchema, createSchema, idSchema } from "./validators/damagePayments.validator.js";
import listByDamage from "./handlers/listByDamage.handler.js";
import create from "./handlers/create.handler.js";
import remove from "./handlers/remove.handler.js";

const router = Router();

router.get("/by-damage/:damageId", requireAuth, requirePermission(PERMISSIONS.DAMAGES_READ), validate(byDamageSchema), listByDamage);
router.post("/", requireAuth, requirePermission(PERMISSIONS.DAMAGES_PAY), validate(createSchema), create);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.DAMAGES_PAY), validate(idSchema), remove);

export default router;
