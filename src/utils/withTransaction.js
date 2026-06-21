import mongoose from "mongoose";

// Bir nechta yozuvni ATOMAR (hammasi yoki hech narsa) bajaradi (§6). Masalan
// settlement'da depozit "out" chiqimi + kunlik plan "payment" kirimi ikkalasi birga
// yozilishi shart - aks holda pul yarim yo'lda qolib ledger buziladi.
//
// MUHIM: MongoDB tranzaksiyalari faqat REPLICA SET / mongos da ishlaydi. Yakka
// (standalone) mongod'da `startSession`+transaction xato beradi. Shu sababli agar
// tranzaksiya qo'llab-quvvatlanmasa, fn'ni sessiyasiz bajaramiz (eski xatti-harakat) -
// hech bo'lmasa ishlaydi, lekin atomiklik faqat replica set'da kafolatlanadi.
let txSupported = null;

export const withTransaction = async (fn) => {
  if (txSupported === false) return fn(null);

  let session;
  try {
    session = await mongoose.startSession();
  } catch {
    txSupported = false;
    return fn(null);
  }

  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    txSupported = true;
    return result;
  } catch (e) {
    // Tranzaksiya qo'llab-quvvatlanmaganini bir marta aniqlab, keyin sessiyasiz ketamiz.
    const msg = String(e?.message || e?.codeName || "");
    if (
      txSupported === null &&
      /Transaction numbers are only allowed|replica set|not supported|mongos/i.test(msg)
    ) {
      txSupported = false;
      return fn(null);
    }
    throw e;
  } finally {
    await session.endSession();
  }
};
