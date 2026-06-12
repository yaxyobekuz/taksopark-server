import { z } from "zod";
import { DEPOSIT_TX_TYPE } from "../../../models/depositTransaction.model.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const monthQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
  }),
});

export const driverIdParamSchema = z.object({
  params: z.object({ driverId: objectId }),
});

export const txIdParamSchema = z.object({
  params: z.object({ id: objectId }),
});

export const cashbackPayoutSchema = z.object({
  body: z.object({
    driverId: objectId,
    monthStart: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "Sana noto'g'ri"),
    amount: z.coerce.number().positive("Summa musbat bo'lishi kerak"),
    note: z.string().optional(),
  }),
});

export const depositMovementSchema = z.object({
  body: z.object({
    driverId: objectId,
    type: z.enum(Object.values(DEPOSIT_TX_TYPE)),
    amount: z.coerce.number().positive("Summa musbat bo'lishi kerak"),
    note: z.string().optional(),
  }),
});
