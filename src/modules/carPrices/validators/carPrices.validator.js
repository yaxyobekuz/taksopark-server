import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

const dateString = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Sana noto'g'ri");

const optionalEndDate = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  dateString.nullable().optional(),
);

const money = z.coerce.number().int().min(0);

export const listSchema = z.object({
  query: z.object({ carId: objectId }),
});

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const createSchema = z.object({
  body: z.object({
    carId: objectId,
    dailyRateDeposit: money,
    dailyRateCashback: money,
    monthlyCashback: money.optional(),
    startDate: dateString,
    endDate: optionalEndDate,
    note: z.string().optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    dailyRateDeposit: money.optional(),
    dailyRateCashback: money.optional(),
    monthlyCashback: money.optional(),
    startDate: dateString.optional(),
    endDate: optionalEndDate,
    note: z.string().optional(),
  }),
});
