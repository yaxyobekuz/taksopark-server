import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import User from "../models/user.model.js";
import Car from "../models/car.model.js";
import Driver, { DRIVER_STATUS } from "../models/driver.model.js";
import DailyPayment from "../models/dailyPayment.model.js";
import Fine from "../models/fine.model.js";
import Damage from "../models/damage.model.js";
import FinePayment, { PAYMENT_SOURCES } from "../models/finePayment.model.js";
import DamagePayment from "../models/damagePayment.model.js";
import Oylik from "../models/oylik.model.js";
import Transaction, { TRANSACTION_TYPES, TRANSACTION_SOURCES } from "../models/transaction.model.js";
import { TARIFFS, TARIFF_CONFIG } from "../constants/tariffs.js";
import { startOfDayTashkent, addDays } from "../utils/timezone.js";
import logger from "../config/logger.js";

const seed = async () => {
  await connectDB();

  // Tozalash
  await Promise.all([
    Car.deleteMany({}),
    Driver.deleteMany({}),
    DailyPayment.deleteMany({}),
    Fine.deleteMany({}),
    Damage.deleteMany({}),
    FinePayment.deleteMany({}),
    DamagePayment.deleteMany({}),
    Oylik.deleteMany({}),
    Transaction.deleteMany({}),
  ]);
  logger.info("Eski demo data tozalandi");

  const owner = await User.findOne({ username: "owner" });
  if (!owner) throw new Error("Owner user yo'q. Avval npm run seed:owner");

  // 4 ta mashina
  const cars = await Car.insertMany([
    { plateNumber: "01A111AA", model: "Cobalt", notes: "Oq, 2022" },
    { plateNumber: "01A222BB", model: "Spark", notes: "Qora, 2021" },
    { plateNumber: "01A333CC", model: "Nexia 3", notes: "Kumush, 2020" },
    { plateNumber: "01A444DD", model: "Lacetti", notes: "Oq, 2019" },
  ]);
  logger.info(`Cars: ${cars.length}`);

  const today = startOfDayTashkent(new Date());
  const daysAgo = (n) => addDays(today, -n);

  const depCfg = TARIFF_CONFIG[TARIFFS.DEPOSIT];

  // 4 ta haydovchi
  const drivers = await Driver.insertMany([
    {
      firstName: "Ali",
      lastName: "Valiyev",
      phone: "+998901111111",
      tariff: TARIFFS.DEPOSIT,
      car: cars[0]._id,
      startDate: daysAgo(10),
      depositInitial: depCfg.depositInitial,
      depositRemaining: 2_300_000,
      status: DRIVER_STATUS.ACTIVE,
      notes: "Tajribali",
    },
    {
      firstName: "Bobur",
      lastName: "Karimov",
      phone: "+998902222222",
      tariff: TARIFFS.DEPOSIT,
      car: cars[1]._id,
      startDate: daysAgo(3),
      depositInitial: depCfg.depositInitial,
      depositRemaining: 2_500_000,
      status: DRIVER_STATUS.ACTIVE,
      notes: "Yangi",
    },
    {
      firstName: "Davron",
      lastName: "Yusupov",
      phone: "+998903333333",
      tariff: TARIFFS.NO_DEPOSIT,
      car: cars[2]._id,
      startDate: daysAgo(20),
      depositInitial: 0,
      depositRemaining: 0,
      status: DRIVER_STATUS.ACTIVE,
      notes: "Depozitsiz, oylik tarif",
    },
    {
      firstName: "Eldor",
      lastName: "Salimov",
      phone: "+998904444444",
      tariff: TARIFFS.DEPOSIT,
      car: cars[3]._id,
      startDate: daysAgo(30),
      depositInitial: depCfg.depositInitial,
      depositRemaining: 480_000,
      status: DRIVER_STATUS.ACTIVE,
      notes: "Depozit kam qoldi",
    },
  ]);
  logger.info(`Drivers: ${drivers.length}`);

  // Mashinalarni driverga bog'lash
  await Promise.all(
    drivers.map((d) => Car.updateOne({ _id: d.car }, { $set: { currentDriver: d._id } })),
  );

  // Kunlik to'lovlar - Ali va Bobur uchun
  const aliPayments = [
    { driver: drivers[0]._id, car: drivers[0].car, date: daysAgo(9), amount: 500_000 },
    { driver: drivers[0]._id, car: drivers[0].car, date: daysAgo(8), amount: 500_000 },
    { driver: drivers[0]._id, car: drivers[0].car, date: daysAgo(7), amount: 400_000 },
    { driver: drivers[0]._id, car: drivers[0].car, date: daysAgo(6), amount: 500_000 },
    { driver: drivers[0]._id, car: drivers[0].car, date: daysAgo(5), amount: 500_000 },
    { driver: drivers[0]._id, car: drivers[0].car, date: daysAgo(3), amount: 500_000 },
    { driver: drivers[0]._id, car: drivers[0].car, date: daysAgo(2), amount: 500_000 },
    { driver: drivers[0]._id, car: drivers[0].car, date: daysAgo(1), amount: 500_000 },
  ];
  const boburPayments = [
    { driver: drivers[1]._id, car: drivers[1].car, date: daysAgo(2), amount: 500_000 },
    { driver: drivers[1]._id, car: drivers[1].car, date: daysAgo(1), amount: 500_000 },
  ];
  const davronPayments = [
    { driver: drivers[2]._id, car: drivers[2].car, date: daysAgo(5), amount: 560_000 },
    { driver: drivers[2]._id, car: drivers[2].car, date: daysAgo(4), amount: 560_000 },
    { driver: drivers[2]._id, car: drivers[2].car, date: daysAgo(3), amount: 400_000 },
    { driver: drivers[2]._id, car: drivers[2].car, date: daysAgo(1), amount: 560_000 },
  ];

  const allPayments = [...aliPayments, ...boburPayments, ...davronPayments].map((p) => ({
    ...p,
    expectedPlan: p.driver.equals(drivers[2]._id) ? 560_000 : 500_000,
    tariffSnapshot: p.driver.equals(drivers[2]._id) ? TARIFFS.NO_DEPOSIT : TARIFFS.DEPOSIT,
    oylik: null,
    note: "",
    createdBy: owner._id,
  }));
  await DailyPayment.insertMany(allPayments);
  logger.info(`Payments: ${allPayments.length}`);

  // Fake attachment (haqiqiy fayl yo'q, faqat metadata)
  const fakeAttachment = {
    url: "/uploads/fines/demo/demo.jpg",
    filename: "demo.jpg",
    mime: "image/jpeg",
    size: 12345,
  };

  // 2 ta jarima
  const aliFine = await Fine.create({
    driver: drivers[0]._id,
    car: drivers[0].car,
    amount: 800_000,
    issueDate: daysAgo(5),
    oylik: null,
    attachments: [fakeAttachment],
    paidAmount: 0,
    paymentStatus: "pending",
    createdBy: owner._id,
    note: "Tezlik oshirgan (qarz)",
  });

  const davronFine = await Fine.create({
    driver: drivers[2]._id,
    car: drivers[2].car,
    amount: 500_000,
    issueDate: daysAgo(3),
    oylik: null,
    attachments: [fakeAttachment],
    paidAmount: 500_000,
    paymentStatus: "paid",
    createdBy: owner._id,
    note: "Yo'l harakati qoidasi (to'liq to'langan)",
  });
  // Davron jarima uchun to'lov + transaction
  const davronFinePayment = await FinePayment.create({
    fine: davronFine._id,
    amount: 500_000,
    source: PAYMENT_SOURCES.DRIVER_CASH,
    paidAt: daysAgo(2),
    note: "Naqd to'ladi",
    createdBy: owner._id,
  });
  await Transaction.create({
    type: TRANSACTION_TYPES.INCOME,
    source: TRANSACTION_SOURCES.FINE_PAYMENT_CASH,
    amount: 500_000,
    date: daysAgo(2),
    driver: drivers[2]._id,
    fine: davronFine._id,
    finePayment: davronFinePayment._id,
    note: "Naqd to'ladi",
    createdBy: owner._id,
  });

  logger.info("Fines yaratildi");

  // 1 ta zarar - partial
  const davronDamage = await Damage.create({
    driver: drivers[2]._id,
    car: drivers[2].car,
    amount: 1_200_000,
    incidentDate: daysAgo(7),
    oylik: null,
    attachments: [fakeAttachment],
    paidAmount: 500_000,
    paymentStatus: "partial",
    createdBy: owner._id,
    note: "Old qanot urilgan",
  });
  const davronDamagePayment = await DamagePayment.create({
    damage: davronDamage._id,
    amount: 500_000,
    source: PAYMENT_SOURCES.DRIVER_CASH,
    paidAt: daysAgo(6),
    note: "Avval naqd qism",
    createdBy: owner._id,
  });
  await Transaction.create({
    type: TRANSACTION_TYPES.INCOME,
    source: TRANSACTION_SOURCES.DAMAGE_PAYMENT_CASH,
    amount: 500_000,
    date: daysAgo(6),
    driver: drivers[2]._id,
    damage: davronDamage._id,
    damagePayment: davronDamagePayment._id,
    note: "Avval naqd qism",
    createdBy: owner._id,
  });
  logger.info("Damage yaratildi (partial)");

  // 3 ta qo'lda transaction
  await Transaction.insertMany([
    {
      type: TRANSACTION_TYPES.INCOME,
      source: TRANSACTION_SOURCES.MANUAL,
      category: "Boshqa daromad",
      amount: 200_000,
      date: daysAgo(1),
      note: "Qo'shimcha buyurtma",
      createdBy: owner._id,
    },
    {
      type: TRANSACTION_TYPES.EXPENSE,
      source: TRANSACTION_SOURCES.MANUAL,
      category: "Yoqilg'i",
      amount: 150_000,
      date: daysAgo(2),
      note: "Benzin",
      createdBy: owner._id,
    },
    {
      type: TRANSACTION_TYPES.EXPENSE,
      source: TRANSACTION_SOURCES.MANUAL,
      category: "Ta'mirlash",
      amount: 800_000,
      date: daysAgo(7),
      note: "Cobalt - moy almashtirish, balon",
      createdBy: owner._id,
    },
  ]);
  logger.info("Manual transactions: 3");

  logger.info("Demo seed tugadi!");
  await disconnectDB();
};

seed().catch((err) => {
  logger.error({ err }, "Demo seed xato");
  process.exit(1);
});
