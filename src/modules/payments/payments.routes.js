import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import requirePermission from "../../middleware/requirePermission.js";
import validate from "../../middleware/validate.js";
import { PERMISSIONS } from "../../constants/permissions.js";
import {
  listSchema,
  idSchema,
  createSchema,
  updateSchema,
} from "./validators/payments.validator.js";
import list from "./handlers/list.handler.js";
import create from "./handlers/create.handler.js";
import update from "./handlers/update.handler.js";
import remove from "./handlers/remove.handler.js";

const router = Router();

router.get("/", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_READ), validate(listSchema), list);
router.post("/", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_CREATE), validate(createSchema), create);
router.patch("/:id", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_UPDATE), validate(updateSchema), update);
router.delete("/:id", requireAuth, requirePermission(PERMISSIONS.PAYMENTS_DELETE), validate(idSchema), remove);

export default router;
