import agenda from "../config/agenda.js";
import logger from "../config/logger.js";
import defineCleanupExpiredTokens, {
  JOB_NAME as CLEANUP_JOB,
} from "./cleanupExpiredTokens.job.js";
import defineMaterializeDailyPlans, {
  JOB_NAME as MATERIALIZE_JOB,
} from "./materializeDailyPlans.job.js";

export const startJobs = async () => {
  defineCleanupExpiredTokens(agenda);
  defineMaterializeDailyPlans(agenda);

  await agenda.start();

  await agenda.every("0 3 * * *", CLEANUP_JOB);
  // Har kuni — bugun faol haydovchilar uchun kunlik planlarni materializatsiya qilish.
  await agenda.every("0 1 * * *", MATERIALIZE_JOB);

  logger.info("Agenda ishga tushirildi");
};

export const stopJobs = async () => {
  await agenda.stop();
  logger.info("Agenda to'xtatildi");
};
