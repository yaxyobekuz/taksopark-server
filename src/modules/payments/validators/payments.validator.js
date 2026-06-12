import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const monthViewSchema = z.object({
  query: z.object({
    driverId: objectId,
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
  }),
});

export const planIdSchema = z.object({
  params: z.object({ id: objectId }),
});

export const listTransactionsSchema = z.object({
  query: z
    .object({
      dailyPlanId: objectId.optional(),
      driverId: objectId.optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
    })
    .refine((q) => q.dailyPlanId || q.driverId, {
      message: "dailyPlanId yoki driverId kerak",
    }),
});

export const createPaymentSchema = z.object({
  body: z.object({
    dailyPlanId: objectId,
    amount: z.coerce.number().positive("To'lov summasi musbat bo'lishi kerak"),
    note: z.string().optional(),
  }),
});

export const reverseSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    note: z.string().optional(),
  }),
});
