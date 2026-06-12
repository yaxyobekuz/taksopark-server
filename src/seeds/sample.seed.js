import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import User from "../models/user.model.js";
import Car from "../models/car.model.js";
import Driver from "../models/driver.model.js";
import WorkPeriod, { TARIFF } from "../models/workPeriod.model.js";
import CarAssignment from "../models/carAssignment.model.js";
import CarPrice from "../models/carPrice.model.js";
import DailyPlan from "../models/dailyPlan.model.js";
import Transaction from "../models/transaction.model.js";
import DepositTransaction from "../models/depositTransaction.model.js";
import CashbackTransaction from "../models/cashbackTransaction.model.js";
import RestDay from "../models/restDay.model.js";
import { startOfDayTashkent, addDays } from "../utils/timezone.js";
import logger from "../config/logger.js";

// 4 ta mashina + 4 ta haydovchi, har biri to'liq sozlangan: ish davri (Ishda
// ko'rinishi uchun) + mashina biriktirish + narx davri (kunlik planlar uchun).
const DATA = [
  { plate: "01A111AA", model: "Cobalt", notes: "Oq, 2022", firstName: "Ali", lastName: "Valiyev", phone: "+998901111111", tariff: TARIFF.DEPOSIT, price: { dep: 80000, cb: 100000, monthly: 500000 } },
  { plate: "01A222BB", model: "Spark", notes: "Qora, 2021", firstName: "Bobur", lastName: "Karimov", phone: "+998902222222", tariff: TARIFF.CASHBACK, price: { dep: 70000, cb: 90000, monthly: 450000 } },
  { plate: "01A333CC", model: "Nexia 3", notes: "Kumush, 2020", firstName: "Davron", lastName: "Yusupov", phone: "+998903333333", tariff: TARIFF.DEPOSIT, price: { dep: 75000, cb: 95000, monthly: 480000 } },
  { plate: "01A444DD", model: "Gentra", notes: "Kulrang, 2021", firstName: "Sardor", lastName: "Toshmatov", phone: "+998904444444", tariff: TARIFF.CASHBACK, price: { dep: 60000, cb: 80000, monthly: 400000 } },
];

const seed = async () => {
  await connectDB();

  const owner = await User.findOne({ role: "owner" });
  if (!owner) throw new Error("Owner topilmadi — avval reset/owner seed ishga tushiring");

  // Eski biznes data tozalanadi (qayta ishga tushirishda dublikat bo'lmasligi uchun).
  await Promise.all([
    Car.deleteMany({}),
    Driver.deleteMany({}),
    WorkPeriod.deleteMany({}),
    CarAssignment.deleteMany({}),
    CarPrice.deleteMany({}),
    DailyPlan.deleteMany({}),
    Transaction.deleteMany({}),
    DepositTransaction.deleteMany({}),
    CashbackTransaction.deleteMany({}),
    RestDay.deleteMany({}),
  ]);

  const startDate = addDays(startOfDayTashkent(new Date()), -60); // ~2 oy oldin

  for (const d of DATA) {
    const car = await Car.create({ plateNumber: d.plate, model: d.model, notes: d.notes });
    const driver = await Driver.create({
      firstName: d.firstName,
      lastName: d.lastName,
      phone: d.phone,
      car: car._id,
    });
    car.currentDriver = driver._id;
    await car.save();

    await CarPrice.create({
      car: car._id,
      dailyRateDeposit: d.price.dep,
      dailyRateCashback: d.price.cb,
      monthlyCashback: d.price.monthly,
      startDate,
      endDate: null,
      createdBy: owner._id,
    });
    await WorkPeriod.create({
      driver: driver._id,
      tariff: d.tariff,
      startDate,
      endDate: null,
      createdBy: owner._id,
    });
    await CarAssignment.create({
      driver: driver._id,
      car: car._id,
      startDate,
      endDate: null,
      createdBy: owner._id,
    });
  }

  logger.info(`Mashinalar: ${DATA.length}, Haydovchilar: ${DATA.length} (ish davri + biriktirish + narx bilan)`);
  await disconnectDB();
};

seed().catch((err) => {
  logger.error({ err }, "Sample seed xato");
  process.exit(1);
});
