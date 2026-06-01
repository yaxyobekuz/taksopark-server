import { z } from "zod";
import { TRANSACTION_WALLETS } from "../../../models/transaction.model.js";

export const overviewSchema = z.object({
  query: z.object({
    fromDate: z.string().optional(),
    toDate: z.string().optional(),
  }),
});

export const recentSchema = z.object({
  params: z.object({
    wallet: z.enum(Object.values(TRANSACTION_WALLETS)),
  }),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});
