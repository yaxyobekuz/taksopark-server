import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import Transaction, {
  TRANSACTION_DIRECTIONS,
  TRANSACTION_WALLETS,
} from "../models/transaction.model.js";
import logger from "../config/logger.js";

// Eski tranzaksiya sourcelari uchun (artifact) yangi tizimda bu sourcelar yo'q.
// Quyidagi sourcelar bilan yozilgan eski yozuvlar o'chiriladi (sun'iy daromad/xarajat hisobotlarni buzayotgan edi).
const OBSOLETE_SOURCES = [
  "fine_system",
  "damage_system",
  "fine_auto_oylik",
  "damage_auto_oylik",
  "fine_payment_cash",
  "fine_payment_deposit",
  "damage_payment_cash",
  "damage_payment_deposit",
];

// Yangi tizimda saqlanadigan source → wallet + direction xaritasi
const SOURCE_MAP = {
  daily_payment: { wallet: TRANSACTION_WALLETS.REVENUE, direction: TRANSACTION_DIRECTIONS.IN },
  oylik_payout: { wallet: TRANSACTION_WALLETS.REVENUE, direction: TRANSACTION_DIRECTIONS.OUT },
  deposit_topup: { wallet: TRANSACTION_WALLETS.DEPOSIT, direction: TRANSACTION_DIRECTIONS.IN },
  deposit_withdraw: { wallet: TRANSACTION_WALLETS.DEPOSIT, direction: TRANSACTION_DIRECTIONS.OUT },
  deposit_refund: { wallet: TRANSACTION_WALLETS.DEPOSIT, direction: TRANSACTION_DIRECTIONS.OUT },
  manual: null, // manual tx uchun type ga qarab aniqlanadi
};

const migrate = async () => {
  await connectDB();

  // 1. Obsolete (sun'iy) yozuvlarni o'chirib tashlash
  const obsoleteDel = await Transaction.deleteMany({ source: { $in: OBSOLETE_SOURCES } });
  logger.info(`O'chirilgan obsolete tranzaksiyalar: ${obsoleteDel.deletedCount}`);

  // 2. Qolganlariga wallet + direction qo'shish
  const docs = await Transaction.find({
    $or: [{ wallet: { $exists: false } }, { direction: { $exists: false } }],
  });
  let updated = 0;
  for (const doc of docs) {
    let mapping = SOURCE_MAP[doc.source];
    if (!mapping) {
      // manual: type'dan deriv qilamiz
      if (doc.source === "manual") {
        mapping = {
          wallet: TRANSACTION_WALLETS.REVENUE,
          direction:
            doc.type === "income" ? TRANSACTION_DIRECTIONS.IN : TRANSACTION_DIRECTIONS.OUT,
        };
      } else {
        logger.warn(`Noma'lum source: ${doc.source}, id=${doc._id} — skip`);
        continue;
      }
    }
    doc.wallet = mapping.wallet;
    doc.direction = mapping.direction;
    await doc.save();
    updated += 1;
  }
  logger.info(`Yangilangan tranzaksiyalar: ${updated}`);

  await disconnectDB();
};

migrate().catch((err) => {
  logger.error({ err }, "Wallet migration xato");
  process.exit(1);
});
