import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Base user schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  rights: json("rights").notNull().default(['audit']),
  isInactive: boolean("is_inactive").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  rights: true,
  isInactive: true,
});

// Audit forms schema
export const auditForms = pgTable("audit_forms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sections: json("sections").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertAuditFormSchema = createInsertSchema(auditForms).pick({
  name: true,
  sections: true,
  createdBy: true,
});

// Audit reports schema
export const auditReports = pgTable("audit_reports", {
  id: serial("id").primaryKey(),
  auditId: text("audit_id").notNull(),
  formName: text("form_name").notNull(),
  agent: text("agent").notNull(),
  agentId: text("agent_id").notNull(),
  auditor: integer("auditor").references(() => users.id),
  auditorName: text("auditor_name").notNull(),
  sectionAnswers: json("section_answers").notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  hasFatal: boolean("has_fatal").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: text("status").notNull().default("completed"),
  edited: boolean("edited").notNull().default(false),
  editedBy: integer("edited_by").references(() => users.id),
  editedAt: timestamp("edited_at"),
  deleted: boolean("deleted").notNull().default(false),
  deletedBy: integer("deleted_by").references(() => users.id),
  deletedAt: timestamp("deleted_at"),
});

export const insertAuditReportSchema = createInsertSchema(auditReports).omit({
  id: true,
  timestamp: true,
  deleted: true,
  deletedBy: true,
  deletedAt: true
}).extend({
  sectionAnswers: z.record(z.any()).optional().default({}),
  auditor: z.number().optional()
});

// ATA (Master Auditor) review schema
export const ataReviews = pgTable("ata_reviews", {
  id: serial("id").primaryKey(),
  auditReportId: integer("audit_report_id").references(() => auditReports.id),
  reviewerId: integer("reviewer_id").references(() => users.id),
  reviewerName: text("reviewer_name").notNull(),
  feedback: text("feedback").notNull(),
  rating: integer("rating").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertAtaReviewSchema = createInsertSchema(ataReviews).omit({
  id: true,
  timestamp: true
}).extend({
  auditReportId: z.number().optional(), // Make optional since we might pass reportId instead
  reportId: z.number().optional(), // Allow reportId as alternative
  auditId: z.string().optional(), // Allow auditId as identifier
  reviewerId: z.number().optional(),
  actionTaken: z.string().optional(), // Common field name from frontend
  comments: z.string().optional(), // Common field name from frontend
  feedback: z.string().optional(),
  rating: z.number().optional().default(5)
});

// Deleted audits table to track removed reports
export const deletedAudits = pgTable("deleted_audits", {
  id: serial("id").primaryKey(),
  originalId: text("original_id").notNull(),  // Store as text to avoid type casting issues
  auditId: text("audit_id").notNull(),
  formName: text("form_name").notNull(),
  agent: text("agent").notNull(),
  agentId: text("agent_id"),
  auditor: integer("auditor").references(() => users.id),
  auditorName: text("auditor_name"),
  sectionAnswers: json("section_answers").notNull(),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  hasFatal: boolean("has_fatal").notNull().default(false),
  timestamp: timestamp("timestamp").notNull(),
  deletedBy: integer("deleted_by").references(() => users.id).notNull(),
  deletedByName: text("deleted_by_name").notNull(),
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
  editHistory: json("edit_history"),
});

export const insertDeletedAuditSchema = createInsertSchema(deletedAudits).omit({
  id: true,
  deletedAt: true
}).extend({
  originalId: z.string().optional(),
  sectionAnswers: z.record(z.any()).optional().default({}),
  auditor: z.number().optional(),
  timestamp: z.string().or(z.date()).optional(),
  deletedBy: z.number().optional(),
  editHistory: z.record(z.any()).optional(),
  reason: z.string().optional() // Common field from frontend
});

// Audit samples schema for tracking samples to be audited
export const auditSamples = pgTable("audit_samples", {
  id: serial("id").primaryKey(),
  sampleId: text("sample_id").notNull(),
  customerName: text("customer_name").notNull(),
  ticketId: text("ticket_id").notNull(),
  formType: text("form_type").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  priority: text("priority").$type<"high" | "medium" | "low">().default("medium"),
  // Define specific values for status to help with type checking
  status: text("status").$type<"available" | "assigned" | "inProgress" | "completed">().notNull().default("available"),
  assignedTo: integer("assigned_to").references(() => users.id),
  assignedAt: timestamp("assigned_at"),
  metadata: json("metadata"),  // For additional data like channel, duration, category, etc.
  uploadedBy: integer("uploaded_by").references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  batchId: text("batch_id"),  // To group samples uploaded together
});

export const insertAuditSampleSchema = createInsertSchema(auditSamples).pick({
  sampleId: true,
  customerName: true,
  ticketId: true, 
  formType: true,
  priority: true,
  status: true,
  assignedTo: true,
  metadata: true,
  uploadedBy: true,
  batchId: true,
}).extend({
  date: z.union([z.number(), z.string(), z.date()]).optional(),
  assignedAt: z.union([z.number(), z.string(), z.date()]).optional(),
});

// Skipped samples schema
export const skippedSamples = pgTable("skipped_samples", {
  id: serial("id").primaryKey(),
  auditId: text("audit_id").notNull(),
  formName: text("form_name").notNull(),
  agent: text("agent").notNull(),
  agentId: text("agent_id").notNull(),
  auditor: integer("auditor").references(() => users.id),
  auditorName: text("auditor_name").notNull(),
  reason: text("reason").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  status: text("status").notNull().default("skipped"),
});

export const insertSkippedSampleSchema = createInsertSchema(skippedSamples).pick({
  auditId: true,
  formName: true,
  agent: true,
  agentId: true,
  auditor: true,
  auditorName: true,
  reason: true,
  status: true,
}).extend({
  timestamp: z.union([z.number(), z.string(), z.date()]).optional(),
});

// Type definitions
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type AuditForm = typeof auditForms.$inferSelect;
export type InsertAuditForm = z.infer<typeof insertAuditFormSchema>;

export type AuditReport = typeof auditReports.$inferSelect;
export type InsertAuditReport = z.infer<typeof insertAuditReportSchema>;

export type AtaReview = typeof ataReviews.$inferSelect;
export type InsertAtaReview = z.infer<typeof insertAtaReviewSchema>;

export type DeletedAudit = typeof deletedAudits.$inferSelect;
export type InsertDeletedAudit = z.infer<typeof insertDeletedAuditSchema>;

export type AuditSample = typeof auditSamples.$inferSelect;
export type InsertAuditSample = z.infer<typeof insertAuditSampleSchema>;

export type SkippedSample = typeof skippedSamples.$inferSelect;
export type InsertSkippedSample = z.infer<typeof insertSkippedSampleSchema>;
