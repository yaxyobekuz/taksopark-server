import { z } from "zod";
import { PAYMENT_SOURCES } from "../../../models/finePayment.model.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const byFineSchema = z.object({
  params: z.object({ fineId: objectId }),
});

export const createSchema = z.object({
  body: z.object({
    fineId: objectId,
    amount: z.coerce.number().int().min(1),
    source: z.enum(Object.values(PAYMENT_SOURCES)),
    paidAt: z.string().optional(),
    note: z.string().optional(),
  }),
});
