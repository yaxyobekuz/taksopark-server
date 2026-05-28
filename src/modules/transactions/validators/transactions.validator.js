import { z } from "zod";
import { TRANSACTION_TYPES, TRANSACTION_SOURCES } from "../../../models/transaction.model.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const listSchema = z.object({
  query: z.object({
    type: z.enum(Object.values(TRANSACTION_TYPES)).optional(),
    source: z.enum(Object.values(TRANSACTION_SOURCES)).optional(),
    driverId: objectId.optional(),
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }),
});

export const summarySchema = z.object({
  query: z.object({
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
});

export const createSchema = z.object({
  body: z.object({
    type: z.enum(Object.values(TRANSACTION_TYPES)),
    source: z.literal(TRANSACTION_SOURCES.MANUAL),
    category: z.string().trim().min(1, "Kategoriya kerak"),
    amount: z.coerce.number().int().min(1),
    date: z.string().optional(),
    note: z.string().optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    type: z.enum(Object.values(TRANSACTION_TYPES)),
    category: z.string().trim().min(1, "Kategoriya kerak"),
    amount: z.coerce.number().int().min(1),
    date: z.string().optional(),
    note: z.string().optional(),
  }),
});
