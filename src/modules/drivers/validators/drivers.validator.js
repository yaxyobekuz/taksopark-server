import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

// FormData bo'sh tanlovni "" qilib yuboradi - uni null deb qabul qilamiz
const optionalCarId = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  objectId.nullable().optional(),
);

export const idSchema = z.object({
  params: z.object({ id: objectId }),
});

export const listSchema = z.object({
  query: z.object({
    status: z.enum(["working", "idle"]).optional(),
    carId: objectId.optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }),
});

export const createSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1, "F.I.SH kerak"),
    lastName: z.string().trim().default(""),
    phone: z.string().trim().min(7, "Telefon raqami kerak"),
    carId: optionalCarId,
    notes: z.string().optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().optional(),
    phone: z.string().trim().min(7).optional(),
    carId: optionalCarId,
    notes: z.string().optional(),
  }),
});

export const autoSettleSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({ enabled: z.boolean() }),
});

const dateField = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.date().nullable().optional(),
);

const stringArray = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return [];
  if (Array.isArray(v)) return v;
  return [v];
}, z.array(z.string()).optional());

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
    removeFileUrls: stringArray,
  }),
});
