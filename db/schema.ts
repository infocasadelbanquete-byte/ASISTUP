import { pgTable, text } from 'drizzle-orm/pg-core';

export const savedReports = pgTable('saved_reports', {
  id: text().primaryKey(),
  name: text().notNull(),
  date: text().notNull(),
  content: text().notNull(),
  type: text().notNull(),
  month: text(),
  year: text(),
});
