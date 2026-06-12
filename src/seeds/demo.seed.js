import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import User from "../models/user.model.js";
import Car from "../models/car.model.js";
import Driver from "../models/driver.model.js";
import WorkPeriod, { TARIFF } from "../models/workPeriod.model.js";
import CarPrice from "../models/carPrice.model.js";
import CarAssignment from "../models/carAssignment.model.js";
import DailyPlan from "../models/dailyPlan.model.js";
import Transaction from "../models/transaction.model.js";
import Fine from "../models/fine.model.js";
import Damage from "../models/damage.model.js";
import RestDay from "../models/restDay.model.js";
import { startOfDayTashkent, addDays } from "../utils/timezone.js";
import logger from "../config/logger.js";

const seed = async () => {
  await connectDB();

  // Tozalash
  await Promise.all([
    Car.deleteMany({}),
    Driver.deleteMany({}),
    WorkPeriod.deleteMany({}),
    CarPrice.deleteMany({}),
    CarAssignment.deleteMany({}),
    DailyPlan.deleteMany({}),
    Transaction.deleteMany({}),
    Fine.deleteMany({}),
    Damage.deleteMany({}),
    RestDay.deleteMany({}),
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

  // 4 ta haydovchi
  const drivers = await Driver.insertMany([
    {
      firstName: "Ali",
      lastName: "Valiyev",
      phone: "+998901111111",
      car: cars[0]._id,
      notes: "Tajribali",
    },
    {
      firstName: "Bobur",
      lastName: "Karimov",
      phone: "+998902222222",
      car: cars[1]._id,
      notes: "Yangi",
    },
    {
      firstName: "Davron",
      lastName: "Yusupov",
      phone: "+998903333333",
      car: cars[2]._id,
      notes: "",
    },
    {
      firstName: "Eldor",
      lastName: "Salimov",
      phone: "+998904444444",
      car: cars[3]._id,
      notes: "",
    },
  ]);
  logger.info(`Drivers: ${drivers.length}`);

  // Mashinalarni driverga bog'lash
  await Promise.all(
    drivers.map((d) => Car.updateOne({ _id: d.car }, { $set: { currentDriver: d._id } })),
  );

  // Ish davrlari - ish boshlash sanasi shu davrlardan kelib chiqadi.
  // Davron (drivers[2]) - eski yopilgan davr + yangi ochiq davr (tarif almashgan).
  await WorkPeriod.insertMany([
    { driver: drivers[0]._id, tariff: TARIFF.DEPOSIT, startDate: daysAgo(10), endDate: null, createdBy: owner._id },
    { driver: drivers[1]._id, tariff: TARIFF.CASHBACK, startDate: daysAgo(3), endDate: null, createdBy: owner._id },
    { driver: drivers[2]._id, tariff: TARIFF.DEPOSIT, startDate: daysAgo(40), endDate: daysAgo(21), createdBy: owner._id },
    { driver: drivers[2]._id, tariff: TARIFF.CASHBACK, startDate: daysAgo(20), endDate: null, createdBy: owner._id },
    // Eldor (drivers[3]) - yopilgan davr, hozir ishlamayotgan.
    { driver: drivers[3]._id, tariff: TARIFF.DEPOSIT, startDate: daysAgo(30), endDate: daysAgo(5), createdBy: owner._id },
  ]);
  logger.info("Ish davrlari yaratildi");

  // Mashina biriktirish davrlari - kunlik plan mashinani SHU tarixdan oladi (§2).
  // Har biri ish davrini qamrash uchun eng erta ish sanasidan ochiq biriktiriladi.
  await CarAssignment.insertMany([
    { driver: drivers[0]._id, car: cars[0]._id, startDate: daysAgo(10), endDate: null, createdBy: owner._id },
    { driver: drivers[1]._id, car: cars[1]._id, startDate: daysAgo(3), endDate: null, createdBy: owner._id },
    { driver: drivers[2]._id, car: cars[2]._id, startDate: daysAgo(40), endDate: null, createdBy: owner._id },
    { driver: drivers[3]._id, car: cars[3]._id, startDate: daysAgo(30), endDate: null, createdBy: owner._id },
  ]);
  logger.info("Mashina biriktirish davrlari yaratildi");

  // Mashina narx davrlari (ochiq) - kunlik planlar shu narxlardan snapshot oladi.
  await CarPrice.insertMany([
    { car: cars[0]._id, dailyRateDeposit: 80000, dailyRateCashback: 100000, monthlyCashback: 500000, startDate: daysAgo(60), endDate: null, createdBy: owner._id },
    { car: cars[1]._id, dailyRateDeposit: 70000, dailyRateCashback: 90000, monthlyCashback: 450000, startDate: daysAgo(60), endDate: null, createdBy: owner._id },
    { car: cars[2]._id, dailyRateDeposit: 75000, dailyRateCashback: 95000, monthlyCashback: 480000, startDate: daysAgo(60), endDate: null, createdBy: owner._id },
    { car: cars[3]._id, dailyRateDeposit: 60000, dailyRateCashback: 80000, monthlyCashback: 400000, startDate: daysAgo(60), endDate: null, createdBy: owner._id },
  ]);
  logger.info("Mashina narx davrlari yaratildi");

  // Fake attachment (haqiqiy fayl yo'q, faqat metadata)
  const fakeAttachment = {
    url: "/uploads/fines/demo/demo.jpg",
    filename: "demo.jpg",
    mime: "image/jpeg",
    size: 12345,
  };

  // 2 ta jarima
  await Fine.insertMany([
    {
      driver: drivers[0]._id,
      car: drivers[0].car,
      amount: 800_000,
      issueDate: daysAgo(5),
      attachments: [fakeAttachment],
      createdBy: owner._id,
      note: "Tezlik oshirgan",
    },
    {
      driver: drivers[2]._id,
      car: drivers[2].car,
      amount: 500_000,
      issueDate: daysAgo(3),
      attachments: [fakeAttachment],
      createdBy: owner._id,
      note: "Yo'l harakati qoidasi",
    },
  ]);
  logger.info("Fines yaratildi");

  // 1 ta zarar
  await Damage.create({
    driver: drivers[2]._id,
    car: drivers[2].car,
    amount: 1_200_000,
    incidentDate: daysAgo(7),
    attachments: [fakeAttachment],
    createdBy: owner._id,
    note: "Old qanot urilgan",
  });
  logger.info("Damage yaratildi");

  // 1 ta dam olish kuni
  await RestDay.create({
    driver: drivers[0]._id,
    car: drivers[0].car,
    date: daysAgo(1),
    note: "Oilaviy sabab",
    createdBy: owner._id,
  });
  logger.info("Rest day yaratildi");

  logger.info("Demo seed tugadi!");
  await disconnectDB();
};

seed().catch((err) => {
  logger.error({ err }, "Demo seed xato");
  process.exit(1);
});
