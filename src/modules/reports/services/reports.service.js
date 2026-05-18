import mongoose from "mongoose";
import DailyPayment from "../../../models/dailyPayment.model.js";
import Fine from "../../../models/fine.model.js";
import Damage from "../../../models/damage.model.js";
import MonthlyCycle, { CYCLE_STATUS } from "../../../models/monthlyCycle.model.js";
import Driver from "../../../models/driver.model.js";
import Car from "../../../models/car.model.js";
import { TARIFF_CONFIG } from "../../../constants/tariffs.js";
import { startOfDayTashkent, endOfDayTashkent, daysBetween } from "../../../utils/timezone.js";

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
    .map((d) => ({
      carId: String(d.car._id),
      plateNumber: d.car.plateNumber,
      model: d.car.model,
      driverName: `${d.firstName} ${d.lastName}`.trim(),
      expected: TARIFF_CONFIG[d.tariff]?.dailyPlan || 0,
      amount: paidByCar.get(String(d.car._id)) || 0,
    }))
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

  const [revenue, fines, damages, cyclesAll] = await Promise.all([
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
    MonthlyCycle.find({
      status: CYCLE_STATUS.SETTLED,
      startDate: { $lte: to },
      endDate: { $gte: from },
      ...(carId ? { car: oid(carId) } : {}),
    }).lean(),
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

  for (const c of cyclesAll) {
    const cycleStart = new Date(c.startDate);
    const cycleEnd = new Date(c.endDate);
    const cycleDays = daysBetween(cycleStart, cycleEnd) + 1;
    const overlapStart = cycleStart > from ? cycleStart : from;
    const overlapEnd = cycleEnd < to ? cycleEnd : to;
    const overlapDays = Math.max(0, daysBetween(overlapStart, overlapEnd) + 1);
    if (overlapDays === 0) continue;
    const proratedSalary = Math.round((c.finalPayout * overlapDays) / cycleDays);
    const k = String(c.car);
    const cur = byCar.get(k) || { carId: k, revenue: 0, fines: 0, damages: 0, salary: 0 };
    cur.salary = (cur.salary || 0) + proratedSalary;
    byCar.set(k, cur);
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
    .sort((a, b) => a.plateNumber.localeCompare(b.plateNumber));

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
