import { z } from "zod";

export const changeMyPasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Joriy parol kerak"),
    newPassword: z.string().min(4, "Yangi parol kamida 4 belgidan iborat"),
  }),
});
