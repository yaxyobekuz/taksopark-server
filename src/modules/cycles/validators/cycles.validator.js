import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const driverIdParamSchema = z.object({
  params: z.object({ driverId: objectId }),
});

export const listSchema = z.object({
  query: z.object({
    driverId: objectId.optional(),
    status: z.enum(["open", "settled"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }),
});
