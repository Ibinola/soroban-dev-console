/**
 * Standard cron expression constants for scheduling.
 * INFRA-822: Predictable refresh scheduling for read models.
 */
export const CronExpression = {
  EVERY_MINUTE: "* * * * *",
  EVERY_5_MINUTES: "*/5 * * * *",
  EVERY_15_MINUTES: "*/15 * * * *",
  EVERY_30_MINUTES: "*/30 * * * *",
  EVERY_HOUR: "0 * * * *",
  EVERY_2_HOURS: "0 */2 * * *",
  EVERY_6_HOURS: "0 */6 * * *",
  EVERY_12_HOURS: "0 */12 * * *",
  EVERY_DAY_AT_MIDNIGHT: "0 0 * * *",
  EVERY_WEEK: "0 0 * * 0",
} as const;
