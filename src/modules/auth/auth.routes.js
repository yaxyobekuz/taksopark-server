import { Router } from "express";
import requireAuth from "../../middleware/auth.js";
import validate from "../../middleware/validate.js";
import { authLimiter } from "../../middleware/rateLimiter.js";
import { loginSchema } from "./validators/login.validator.js";
import { changeMyPasswordSchema } from "./validators/changeMyPassword.validator.js";
import login from "./handlers/login.handler.js";
import refresh from "./handlers/refresh.handler.js";
import logout from "./handlers/logout.handler.js";
import me from "./handlers/me.handler.js";
import changeMyPassword from "./handlers/changeMyPassword.handler.js";

const router = Router();

router.post("/login", authLimiter, validate(loginSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAuth, me);
router.post("/change-password", requireAuth, validate(changeMyPasswordSchema), changeMyPassword);

export default router;
