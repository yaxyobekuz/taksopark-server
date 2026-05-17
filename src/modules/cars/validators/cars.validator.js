import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const listSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    isActive: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }),
});

export const createSchema = z.object({
  body: z.object({
    plateNumber: z.string().trim().optional(),
    model: z.string().trim().min(1, "Model kerak"),
    notes: z.string().optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    plateNumber: z.string().trim().optional(),
    model: z.string().trim().min(1).optional(),
    notes: z.string().optional(),
    isActive: z.boolean().optional(),
  }),
});
