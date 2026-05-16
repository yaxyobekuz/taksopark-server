import agenda from "../config/agenda.js";
import logger from "../config/logger.js";
import defineCleanupExpiredTokens, {
  JOB_NAME as CLEANUP_JOB,
} from "./cleanupExpiredTokens.job.js";

export const startJobs = async () => {
  defineCleanupExpiredTokens(agenda);

  await agenda.start();

  await agenda.every("0 3 * * *", CLEANUP_JOB);

  logger.info("Agenda ishga tushirildi");
};

export const stopJobs = async () => {
  await agenda.stop();
  logger.info("Agenda to'xtatildi");
};
