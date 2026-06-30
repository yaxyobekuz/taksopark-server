import asyncHandler from "../../../middleware/asyncHandler.js";
import * as transactionsService from "../services/transactions.service.js";

const deleteTransaction = asyncHandler(async (req, res) => {
  const data = await transactionsService.deleteTransaction(req.params.id);
  res.json({ success: true, data, message: "Tranzaksiya o'chirildi" });
});

export default deleteTransaction;
