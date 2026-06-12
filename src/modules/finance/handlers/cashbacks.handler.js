import asyncHandler from "../../../middleware/asyncHandler.js";
import * as cashbacks from "../services/cashbacks.service.js";

export const cashbacksList = asyncHandler(async (_req, res) => {
  const data = await cashbacks.summaryAll();
  res.json({ success: true, data });
});

export const cashbackDriver = asyncHandler(async (req, res) => {
  const [detail, transactions] = await Promise.all([
    cashbacks.detailForDriver(req.params.driverId),
    cashbacks.transactionsForDriver(req.params.driverId),
  ]);
  res.json({ success: true, data: { ...detail, transactions } });
});

export const cashbackPayout = asyncHandler(async (req, res) => {
  const { driverId, monthStart, amount, note } = req.body;
  const data = await cashbacks.createPayout(driverId, { monthStart, amount, note }, req.user);
  res.status(201).json({ success: true, data, message: "Keshbek to'lovi yozildi" });
});

export const cashbackReverse = asyncHandler(async (req, res) => {
  const data = await cashbacks.reversePayout(req.params.id, req.user);
  res.status(201).json({ success: true, data, message: "Tranzaksiya bekor qilindi" });
});
