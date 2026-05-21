import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const driverIdParamSchema = z.object({
  params: z.object({ driverId: objectId }),
});

export const payoutIdSchema = z.object({
  params: z.object({ id: objectId, payoutId: objectId }),
});

export const listSchema = z.object({
  query: z.object({
    driverId: objectId.optional(),
    status: z.enum(["active", "closed"]).optional(),
    late: z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }),
});

export const createPayoutSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    amount: z.coerce.number().int().min(1, "Summa noto'g'ri"),
    paidAt: z.union([z.string().datetime(), z.string().min(1)]).optional(),
    note: z.string().max(500).optional(),
  }),
});
