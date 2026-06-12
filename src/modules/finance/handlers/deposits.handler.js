import asyncHandler from "../../../middleware/asyncHandler.js";
import * as deposits from "../services/deposits.service.js";

export const depositsList = asyncHandler(async (_req, res) => {
  const data = await deposits.summaryAll();
  res.json({ success: true, data });
});

export const depositDriver = asyncHandler(async (req, res) => {
  const [transactions, balance] = await Promise.all([
    deposits.transactionsForDriver(req.params.driverId),
    deposits.balanceForDriver(req.params.driverId),
  ]);
  res.json({ success: true, data: { balance, transactions } });
});

export const depositMovement = asyncHandler(async (req, res) => {
  const { driverId, type, amount, note } = req.body;
  const data = await deposits.createMovement(driverId, { type, amount, note }, req.user);
  res.status(201).json({ success: true, data, message: "Depozit harakati yozildi" });
});

export const depositReverse = asyncHandler(async (req, res) => {
  const data = await deposits.reverseMovement(req.params.id, req.user);
  res.status(201).json({ success: true, data, message: "Tranzaksiya bekor qilindi" });
});
