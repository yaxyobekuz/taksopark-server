import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const dailyPlanSchema = z.object({
  query: z.object({
    date: z.string().optional(),
  }),
});

export const financeSchema = z.object({
  query: z.object({
    fromDate: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "Sana noto'g'ri"),
    toDate: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "Sana noto'g'ri"),
    carId: objectId.optional(),
  }),
});

export const depositDriversMonthlySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    driverId: objectId.optional(),
  }),
});

export const dailyIncomeExpenseSchema = z.object({
  query: z.object({
    days: z.coerce.number().int().min(1).max(365).optional(),
  }),
});

export const categoryMonthlySchema = z.object({
  query: z.object({
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
});
