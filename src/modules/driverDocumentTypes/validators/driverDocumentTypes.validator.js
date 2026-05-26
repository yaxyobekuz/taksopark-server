import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const createSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Nom kerak").max(100),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().trim().min(1, "Nom kerak").max(100),
  }),
});
