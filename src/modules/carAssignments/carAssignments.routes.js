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
  changeCarSchema,
} from "./validators/carAssignments.validator.js";
import list from "./handlers/list.handler.js";
import create from "./handlers/create.handler.js";
import update from "./handlers/update.handler.js";
import remove from "./handlers/remove.handler.js";
import changeCar from "./handlers/changeCar.handler.js";

const router = Router();
const read = requirePermission(PERMISSIONS.DRIVERS_READ);
const manage = requirePermission(PERMISSIONS.DRIVERS_UPDATE);

router.get("/", requireAuth, read, validate(listSchema), list);
router.post("/", requireAuth, manage, validate(createSchema), create);
router.post("/change-car", requireAuth, manage, validate(changeCarSchema), changeCar);
router.patch("/:id", requireAuth, manage, validate(updateSchema), update);
router.delete("/:id", requireAuth, manage, validate(idSchema), remove);

export default router;
