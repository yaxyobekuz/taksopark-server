import { z } from "zod";
import { ALL_TARIFFS } from "../../../constants/tariffs.js";
import { DRIVER_STATUS } from "../../../models/driver.model.js";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

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
    carId: objectId.nullable().optional(),
    startDate: z.string().refine((s) => !Number.isNaN(new Date(s).getTime()), "Sana noto'g'ri"),
    notes: z.string().optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().optional(),
    phone: z.string().trim().min(7).optional(),
    carId: objectId.nullable().optional(),
    notes: z.string().optional(),
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
