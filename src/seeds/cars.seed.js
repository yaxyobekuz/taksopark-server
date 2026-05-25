import "dotenv/config";
import { connectDB, disconnectDB } from "../config/db.js";
import Car from "../models/car.model.js";
import logger from "../config/logger.js";

// 30 ta O'zbekiston mashinasi - real region kodlari va modellar
const CARS = [
  { plateNumber: "01A123BC", model: "Cobalt", notes: "Oq, 2022" },
  { plateNumber: "01B456CD", model: "Spark", notes: "Qora, 2021" },
  { plateNumber: "01C789DE", model: "Nexia 3", notes: "Kumush, 2020" },
  { plateNumber: "01D234EF", model: "Lacetti", notes: "Oq, 2019" },
  { plateNumber: "01E567FG", model: "Gentra", notes: "Kulrang, 2021" },
  { plateNumber: "10A890GH", model: "Malibu 2", notes: "Qora, 2022" },
  { plateNumber: "10B345HI", model: "Onix", notes: "Oq, 2023" },
  { plateNumber: "10C678IJ", model: "Tracker 2", notes: "Ko'k, 2022" },
  { plateNumber: "20A901JK", model: "Damas", notes: "Oq, 2020" },
  { plateNumber: "20B234KL", model: "Cobalt", notes: "Kumush, 2021" },
  { plateNumber: "25A567LM", model: "Spark", notes: "Qizil, 2019" },
  { plateNumber: "25B890MN", model: "Nexia 3", notes: "Oq, 2020" },
  { plateNumber: "30A123NO", model: "Gentra", notes: "Qora, 2022" },
  { plateNumber: "30B456OP", model: "Lacetti", notes: "Kumush, 2018" },
  { plateNumber: "40A789PQ", model: "Cobalt", notes: "Oq, 2023" },
  { plateNumber: "40B012QR", model: "Malibu", notes: "Qora, 2020" },
  { plateNumber: "50A345RS", model: "Spark", notes: "Ko'k, 2021" },
  { plateNumber: "50B678ST", model: "Damas", notes: "Oq, 2019" },
  { plateNumber: "60A901TU", model: "Nexia 3", notes: "Kulrang, 2021" },
  { plateNumber: "60B234UV", model: "Gentra", notes: "Oq, 2022" },
  { plateNumber: "70A567VW", model: "Cobalt", notes: "Qora, 2020" },
  { plateNumber: "70B890WX", model: "Onix", notes: "Oq, 2023" },
  { plateNumber: "75A123XY", model: "Lacetti", notes: "Kumush, 2019" },
  { plateNumber: "75B456YZ", model: "Tracker 2", notes: "Qizil, 2022" },
  { plateNumber: "80A789AB", model: "Spark", notes: "Oq, 2021" },
  { plateNumber: "80B012BC", model: "Cobalt", notes: "Ko'k, 2022" },
  { plateNumber: "85A345CD", model: "Gentra", notes: "Qora, 2020" },
  { plateNumber: "90A678DE", model: "Damas", notes: "Oq, 2018" },
  { plateNumber: "90B901EF", model: "Malibu 2", notes: "Kumush, 2023" },
  { plateNumber: "95A234FG", model: "Nexia 3", notes: "Oq, 2021" },
];

const seed = async () => {
  await connectDB();

  const result = await Car.insertMany(CARS, { ordered: false });
  logger.info(`Mashinalar qo'shildi: ${result.length}`);

  await disconnectDB();
};

seed().catch((err) => {
  logger.error({ err }, "Cars seed xato");
  process.exit(1);
});
