import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

const dateString = z
  .string()
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Sana noto'g'ri");

const optionalEndDate = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  dateString.nullable().optional(),
);

export const listSchema = z.object({
  query: z.object({ driverId: objectId }),
});

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const createSchema = z.object({
  body: z.object({
    driverId: objectId,
    carId: objectId,
    startDate: dateString,
    endDate: optionalEndDate,
    note: z.string().optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    carId: objectId.optional(),
    startDate: dateString.optional(),
    endDate: optionalEndDate,
    note: z.string().optional(),
  }),
});

export const changeCarSchema = z.object({
  body: z.object({
    driverId: objectId,
    carId: objectId,
    fromDate: optionalEndDate,
  }),
});
