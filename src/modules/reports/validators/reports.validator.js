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

export const driverStatementSchema = z.object({
  params: z.object({ driverId: objectId }),
  query: z.object({
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
});
