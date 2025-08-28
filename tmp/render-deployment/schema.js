const { pgTable, serial, text, jsonb, timestamp, boolean } = require('drizzle-orm/pg-core');

const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  email: text('email'),
  rights: jsonb('rights').notNull(),
  isInactive: boolean('is_inactive').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

const auditForms = pgTable('audit_forms', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  sections: jsonb('sections').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  createdBy: serial('created_by').references(() => users.id)
});

const auditReports = pgTable('audit_reports', {
  id: serial('id').primaryKey(),
  auditId: text('audit_id').notNull().unique(),
  formName: text('form_name').notNull(),
  sectionAnswers: jsonb('section_answers').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedBy: serial('completed_by').references(() => users.id),
  status: text('status').default('completed'),
  totalScore: text('total_score'),
  maxScore: text('max_score'),
  percentage: text('percentage')
});

module.exports = {
  users,
  auditForms,
  auditReports
};