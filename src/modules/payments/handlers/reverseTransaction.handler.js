import asyncHandler from "../../../middleware/asyncHandler.js";
import * as transactionsService from "../services/transactions.service.js";

const reverseTransaction = asyncHandler(async (req, res) => {
  const data = await transactionsService.reverseTransaction(req.params.id, { note: req.body.note }, req.user);
  res.status(201).json({ success: true, data, message: "Tranzaksiya bekor qilindi" });
});

export default reverseTransaction;
