import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const listSchema = z.object({
  query: z.object({
    driverId: objectId.optional(),
    carId: objectId.optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }),
});

export const createSchema = z.object({
  body: z.object({
    driverId: objectId,
    date: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "Sana noto'g'ri"),
    amount: z.coerce.number().int().min(0),
    note: z.string().optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    amount: z.coerce.number().int().min(0).optional(),
    note: z.string().optional(),
  }),
});
