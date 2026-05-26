import mongoose from "mongoose";
import DailyPayment from "../../../models/dailyPayment.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import Oylik from "../../../models/oylik.model.js";
import Driver, { DRIVER_STATUS } from "../../../models/driver.model.js";
import Car from "../../../models/car.model.js";
import Transaction, { TRANSACTION_TYPES } from "../../../models/transaction.model.js";
import { startOfDayTashkent, endOfDayTashkent } from "../../../utils/timezone.js";
import { getActiveTariffPhase } from "../../drivers/services/drivers.service.js";
import { TARIFFS, TARIFF_CONFIG } from "../../../constants/tariffs.js";

export const dailyPlanTotal = async ({ date }) => {
  const target = startOfDayTashkent(date || new Date());

  const drivers = await Driver.find({
    status: "active",
    car: { $ne: null },
  })
    .populate("car", "plateNumber model")
    .lean();

  const paidRows = await DailyPayment.aggregate([
    { $match: { date: target } },
    { $group: { _id: "$car", amount: { $sum: "$amount" } } },
  ]);
  const paidByCar = new Map(paidRows.map((r) => [String(r._id), r.amount]));

  const perCar = drivers
    .filter((d) => d.car)
    .map((d) => {
      const phase = getActiveTariffPhase(d, target);
      const expected = phase.phase === "salary" ? 0 : phase.dailyPlan;
      return {
        carId: String(d.car._id),
        plateNumber: d.car.plateNumber,
        model: d.car.model,
        driverName: `${d.firstName} ${d.lastName}`.trim(),
        expected,
        amount: paidByCar.get(String(d.car._id)) || 0,
      };
    })
    .sort((a, b) => (a.plateNumber || "").localeCompare(b.plateNumber || ""));

  const totalExpected = perCar.reduce((s, r) => s + r.expected, 0);
  const totalAmount = perCar.reduce((s, r) => s + r.amount, 0);

  return { date: target, totalAmount, totalExpected, perCar };
};

export const minYear = async () => {
  const [payment, fine, damage] = await Promise.all([
    DailyPayment.findOne().sort({ date: 1 }).select("date").lean(),
    Fine.findOne().sort({ issueDate: 1 }).select("issueDate").lean(),
    Damage.findOne().sort({ incidentDate: 1 }).select("incidentDate").lean(),
  ]);
  const dates = [payment?.date, fine?.issueDate, damage?.incidentDate].filter(Boolean);
  if (!dates.length) return { year: new Date().getFullYear() };
  const earliest = dates.reduce((min, d) => (d < min ? d : min));
  return { year: new Date(earliest).getFullYear() };
};

const oid = (id) => new mongoose.Types.ObjectId(id);

export const finance = async ({ fromDate, toDate, carId }) => {
  const from = startOfDayTashkent(fromDate);
  const to = endOfDayTashkent(toDate);
  const carFilter = carId ? { car: oid(carId) } : {};

  const [revenue, fines, damages, salaryRows] = await Promise.all([
    DailyPayment.aggregate([
      { $match: { date: { $gte: from, $lte: to }, ...carFilter } },
      { $group: { _id: "$car", amount: { $sum: "$amount" } } },
    ]),
    Fine.aggregate([
      { $match: { issueDate: { $gte: from, $lte: to }, ...carFilter } },
      { $group: { _id: "$car", amount: { $sum: "$paidAmount" } } },
    ]),
    Damage.aggregate([
      { $match: { incidentDate: { $gte: from, $lte: to }, ...carFilter } },
      { $group: { _id: "$car", amount: { $sum: "$paidAmount" } } },
    ]),
    Oylik.aggregate([
      { $match: { ...(carId ? { car: oid(carId) } : {}) } },
      { $unwind: "$payouts" },
      { $match: { "payouts.paidAt": { $gte: from, $lte: to } } },
      { $group: { _id: "$car", amount: { $sum: "$payouts.amount" } } },
    ]),
  ]);

  const byCar = new Map();
  const upsert = (carIdStr, patch) => {
    const cur = byCar.get(carIdStr) || { carId: carIdStr, revenue: 0, fines: 0, damages: 0, salary: 0 };
    Object.assign(cur, patch);
    byCar.set(carIdStr, cur);
  };

  revenue.forEach((r) => upsert(String(r._id), { revenue: r.amount }));
  fines.forEach((r) => {
    const cur = byCar.get(String(r._id)) || { carId: String(r._id), revenue: 0, fines: 0, damages: 0, salary: 0 };
    cur.fines = r.amount;
    byCar.set(String(r._id), cur);
  });
  damages.forEach((r) => {
    const cur = byCar.get(String(r._id)) || { carId: String(r._id), revenue: 0, fines: 0, damages: 0, salary: 0 };
    cur.damages = r.amount;
    byCar.set(String(r._id), cur);
  });

  salaryRows.forEach((r) => {
    const k = String(r._id);
    const cur = byCar.get(k) || { carId: k, revenue: 0, fines: 0, damages: 0, salary: 0 };
    cur.salary = (cur.salary || 0) + r.amount;
    byCar.set(k, cur);
  });

  // Bitta mashina so'ralganda, harakati bo'lmasa ham row qaytsin
  if (carId && !byCar.has(String(carId))) {
    upsert(String(carId), {});
  }

  const carIds = Array.from(byCar.keys());
  const cars = await Car.find({ _id: { $in: carIds } }).lean();
  const drivers = await Driver.find({ car: { $in: carIds }, status: "active" }).lean();
  const driverByCar = new Map(drivers.map((d) => [String(d.car), `${d.firstName} ${d.lastName}`]));

  const rows = cars
    .map((car) => {
      const data = byCar.get(String(car._id));
      const revenue = data?.revenue || 0;
      const fines = data?.fines || 0;
      const damages = data?.damages || 0;
      const salary = data?.salary || 0;
      const profit = revenue - fines - damages - salary;
      return {
        carId: String(car._id),
        plateNumber: car.plateNumber,
        model: car.model,
        driver: driverByCar.get(String(car._id)) || null,
        revenue,
        fines,
        damages,
        salary,
        profit,
      };
    })
    .sort((a, b) => (a.plateNumber || "").localeCompare(b.plateNumber || ""));

  const totals = rows.reduce(
    (acc, r) => {
      acc.revenue += r.revenue;
      acc.fines += r.fines;
      acc.damages += r.damages;
      acc.salary += r.salary;
      acc.profit += r.profit;
      return acc;
    },
    { revenue: 0, fines: 0, damages: 0, salary: 0, profit: 0 },
  );

  return { from, to, rows, totals };
};

const UZ_MONTHS_SHORT = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyn",
  "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek",
];

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // Asia/Tashkent UTC+5

// So'nggi 12 oy bo'yicha kirim/chiqim (diagramma uchun)
export const monthlyIncomeExpense = async () => {
  // Joriy sana Tashkent vaqti bo'yicha aniqlanadi
  const nowTashkent = new Date(Date.now() + TZ_OFFSET_MS);
  const curYear = nowTashkent.getUTCFullYear();
  const curMonth = nowTashkent.getUTCMonth(); // 0-11

  // So'nggi 12 oy ro'yxati: 11 oy orqadan joriy oygacha
  const seq = [];
  for (let i = 11; i >= 0; i--) {
    const total = curYear * 12 + curMonth - i;
    seq.push({ year: Math.floor(total / 12), month: (total % 12) + 1 });
  }

  // Eng eski oy boshidan to hozirgacha bo'lgan oraliq (Tashkent oy chegarasi -> UTC instant)
  const first = seq[0];
  const from = new Date(Date.UTC(first.year, first.month - 1, 1) - TZ_OFFSET_MS);
  const to = new Date();

  const rows = await Transaction.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: {
          ym: { $dateToString: { format: "%Y-%m", date: "$date", timezone: "Asia/Tashkent" } },
          type: "$type",
        },
        amount: { $sum: "$amount" },
      },
    },
  ]);

  // "YYYY-MM" -> { income, expense }
  const byMonth = new Map();
  for (const r of rows) {
    const cur = byMonth.get(r._id.ym) || { income: 0, expense: 0 };
    if (r._id.type === TRANSACTION_TYPES.INCOME) cur.income = r.amount;
    else if (r._id.type === TRANSACTION_TYPES.EXPENSE) cur.expense = r.amount;
    byMonth.set(r._id.ym, cur);
  }

  const months = seq.map(({ year, month }) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    const data = byMonth.get(key) || { income: 0, expense: 0 };
    return {
      year,
      month,
      label: `${UZ_MONTHS_SHORT[month - 1]} ${String(year).slice(2)}`,
      income: data.income,
      expense: data.expense,
      profit: data.income - data.expense,
    };
  });

  return { months };
};

// So'nggi N kun bo'yicha kunlik kirim/chiqim (line chart uchun).
export const dailyIncomeExpense = async ({ days = 30 }) => {
  const nowTashkent = new Date(Date.now() + TZ_OFFSET_MS);
  const curYear = nowTashkent.getUTCFullYear();
  const curMonth = nowTashkent.getUTCMonth();
  const curDay = nowTashkent.getUTCDate();

  const seq = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(curYear, curMonth, curDay - i));
    seq.push({
      y: d.getUTCFullYear(),
      m: d.getUTCMonth() + 1,
      d: d.getUTCDate(),
    });
  }

  const first = seq[0];
  const from = new Date(Date.UTC(first.y, first.m - 1, first.d) - TZ_OFFSET_MS);
  const to = new Date();

  const rows = await Transaction.aggregate([
    { $match: { date: { $gte: from, $lte: to } } },
    {
      $group: {
        _id: {
          ymd: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$date",
              timezone: "Asia/Tashkent",
            },
          },
          type: "$type",
        },
        amount: { $sum: "$amount" },
      },
    },
  ]);

  const byDay = new Map();
  for (const r of rows) {
    const cur = byDay.get(r._id.ymd) || { income: 0, expense: 0 };
    if (r._id.type === TRANSACTION_TYPES.INCOME) cur.income = r.amount;
    else if (r._id.type === TRANSACTION_TYPES.EXPENSE) cur.expense = r.amount;
    byDay.set(r._id.ymd, cur);
  }

  const pad = (n) => String(n).padStart(2, "0");
  const items = seq.map(({ y, m, d }) => {
    const key = `${y}-${pad(m)}-${pad(d)}`;
    const data = byDay.get(key) || { income: 0, expense: 0 };
    return {
      date: key,
      label: `${pad(d)}.${pad(m)}`,
      income: data.income,
      expense: data.expense,
      profit: data.income - data.expense,
    };
  });

  return { days, items };
};

// Tanlangan oydagi depozitli haydovchilar progressi: kutilgan/to'langan/qarz.
export const depositDriversMonthly = async ({ year, month, driverId }) => {
  const lastDay = new Date(year, month, 0).getDate();
  const pad = (n) => String(n).padStart(2, "0");
  const from = startOfDayTashkent(`${year}-${pad(month)}-01`);
  const to = endOfDayTashkent(`${year}-${pad(month)}-${pad(lastDay)}`);

  const expectedPerDriver = lastDay * TARIFF_CONFIG[TARIFFS.DEPOSIT].dailyPlan;

  const driverFilter = {
    tariff: TARIFFS.DEPOSIT,
    status: DRIVER_STATUS.ACTIVE,
  };
  if (driverId) driverFilter._id = oid(driverId);

  const drivers = await Driver.find(driverFilter)
    .populate("car", "plateNumber model")
    .lean();

  const paidMatch = {
    date: { $gte: from, $lte: to },
    tariffSnapshot: TARIFFS.DEPOSIT,
  };
  if (driverId) paidMatch.driver = oid(driverId);

  const paidRows = await DailyPayment.aggregate([
    { $match: paidMatch },
    { $group: { _id: "$driver", paid: { $sum: "$amount" } } },
  ]);
  const paidByDriver = new Map(paidRows.map((r) => [String(r._id), r.paid]));

  const rows = drivers
    .map((d) => {
      const paid = paidByDriver.get(String(d._id)) || 0;
      const debt = Math.max(0, expectedPerDriver - paid);
      const percent =
        expectedPerDriver > 0
          ? Math.min(100, Math.round((paid / expectedPerDriver) * 100))
          : 0;
      return {
        driverId: String(d._id),
        firstName: d.firstName,
        lastName: d.lastName,
        photoUrl: d.photoUrl || "",
        car: d.car
          ? { _id: String(d.car._id), plateNumber: d.car.plateNumber, model: d.car.model }
          : null,
        expected: expectedPerDriver,
        paid,
        debt,
        percent,
      };
    })
    .sort((a, b) => {
      if (b.debt !== a.debt) return b.debt - a.debt;
      return (a.lastName || "").localeCompare(b.lastName || "");
    });

  const totals = rows.reduce(
    (acc, r) => {
      acc.expected += r.expected;
      acc.paid += r.paid;
      acc.debt += r.debt;
      return acc;
    },
    { expected: 0, paid: 0, debt: 0 },
  );

  return { year, month, from, to, rows, totals };
};
