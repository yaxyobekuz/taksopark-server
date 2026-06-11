import { z } from "zod";
import { ALL_TARIFFS } from "../../../constants/tariffs.js";
import { DRIVER_STATUS } from "../../../models/driver.model.js";

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
    tariff: z.enum(ALL_TARIFFS).optional(),
    status: z.enum(Object.values(DRIVER_STATUS)).optional(),
    carId: objectId.optional(),
    search: z.string().optional(),
    depositBelow: z.coerce.number().int().min(0).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }),
});

export const createSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1, "F.I.SH kerak"),
    lastName: z.string().trim().default(""),
    phone: z.string().trim().min(7, "Telefon raqami kerak"),
    tariff: z.enum(ALL_TARIFFS),
    carId: optionalCarId,
    startDate: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "Sana noto'g'ri"),
    depositInitial: z.coerce.number().min(0).optional(),
    notes: z.string().optional(),
  }),
});

export const changeTariffSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    tariff: z.enum(ALL_TARIFFS),
    note: z.string().optional(),
  }),
});

export const adjustDepositSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    delta: z.coerce.number().refine((n) => n !== 0, "Summa 0 bo'lishi mumkin emas"),
    note: z.string().optional(),
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

export const endTrialSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    endDate: z
      .string()
      .refine((s) => !Number.isNaN(new Date(s).getTime()), "Sana noto'g'ri")
      .optional(),
  }),
});
