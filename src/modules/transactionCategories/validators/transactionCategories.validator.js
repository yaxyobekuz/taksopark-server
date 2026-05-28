import { z } from "zod";
import { TRANSACTION_TYPES } from "../../../models/transaction.model.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const listSchema = z.object({
  query: z.object({
    type: z.enum(Object.values(TRANSACTION_TYPES)).optional(),
  }),
});

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const createSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, "Nom kerak").max(100),
    type: z.enum(Object.values(TRANSACTION_TYPES)),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().trim().min(1, "Nom kerak").max(100),
  }),
});
