import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "ID noto'g'ri");

const dateField = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z.coerce.date().nullable().optional(),
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

export const createSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1, "Ism kerak"),
    lastName: z.string().trim().min(1, "Familiya kerak"),
    username: z.string().trim().min(3, "Login kamida 3 belgidan iborat"),
    password: z.string().min(4, "Parol kamida 4 belgidan iborat"),
    phone: z.string().trim().optional(),
    permissions: z.array(z.string()).optional(),
    birthDate: dateField,
    gender: z.enum(["male", "female"]).nullable().optional(),
    address: z.string().optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({ id: objectId }),
  body: z
    .object({
      firstName: z.string().trim().min(1).optional(),
      lastName: z.string().trim().min(1).optional(),
      phone: z.string().trim().optional(),
      isActive: z.preprocess((v) => (typeof v === "string" ? v === "true" : v), z.boolean().optional()),
      birthDate: dateField,
      gender: z.enum(["male", "female"]).nullable().optional(),
      address: z.string().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, "Hech qanday maydon berilmadi"),
});

export const setPermissionsSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    permissions: z.array(z.string()),
  }),
});

export const changePasswordSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    password: z.string().min(4, "Parol kamida 4 belgidan iborat"),
  }),
});
