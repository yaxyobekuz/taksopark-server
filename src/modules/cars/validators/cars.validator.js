import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

const dateField = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.date().nullable().optional(),
);

const boolFlag = z.preprocess(
  (v) => (typeof v === "string" ? v === "true" : v),
  z.boolean().optional(),
);

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

export const listExpiringSchema = z.object({
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
    days: z.coerce.number().int().min(0).max(365).optional(),
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
    isActive: boolFlag,
  }),
});

export const addDocumentSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    documentType: objectId,
    expiryDate: dateField,
  }),
});

export const docIdSchema = z.object({
  params: z.object({ id: objectId, docId: objectId }),
});

export const updateDocumentSchema = z.object({
  params: z.object({ id: objectId, docId: objectId }),
  body: z.object({
    expiryDate: dateField,
    removeFile: boolFlag,
  }),
});
