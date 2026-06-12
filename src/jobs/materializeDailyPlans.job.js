import logger from "../config/logger.js";
import { startOfDayTashkent, addDays } from "../utils/timezone.js";
import * as workPeriodsService from "../modules/workPeriods/services/workPeriods.service.js";
import * as dailyPlansService from "../modules/payments/services/dailyPlans.service.js";
import { settleDriver } from "../modules/finance/services/settlement.service.js";

export const JOB_NAME = "daily.materialize-daily-plans";

// Har kuni bugun faol ish davri bor haydovchilar uchun kunlik planlarni
// materializatsiya qiladi (so'nggi 7 kun - server uzilib qolsa bo'shliqni to'ldiradi).
// Bu kunlik plan HAQIQAT MANBASI bo'lib, ko'rilmasa ham qarz hisoblanib boradi.
export default function defineMaterializeDailyPlans(agenda) {
  agenda.define(JOB_NAME, async () => {
    const from = startOfDayTashkent(addDays(new Date(), -7));
    // Bugun ishlamasa ham, so'nggi 7 kunda faol bo'lgan haydovchilarni qamraymiz
    // (yaqinda to'xtagan haydovchining oxirgi kunlari ham materializatsiya bo'lsin).
    const driverIds = await workPeriodsService.driverIdsActiveSince(from);
    let count = 0;
    for (const driverId of driverIds) {
      try {
        await dailyPlansService.ensureUpToToday(driverId, from);
        // Yangi kunlar uchun depozit/keshbek bilan avtomatik qoplash (§10).
        await settleDriver(driverId);
        count += 1;
      } catch (err) {
        logger.error({ err, driverId }, "Kunlik plan materializatsiyasi xato");
      }
    }
    logger.info({ drivers: count }, "Kunlik planlar materializatsiya qilindi");
  });
}
