import { db } from "../db";
import { users, auditForms, auditReports, ataReviews, deletedAudits, skippedSamples, auditSamples, rebuttals } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import bcrypt from "bcrypt";

export class DatabaseService {
  // User management
  async createUser(userData: { username: string; password: string; rights?: string[]; isInactive?: boolean }) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const [user] = await db.insert(users).values({
      username: userData.username,
      password: hashedPassword,
      rights: userData.rights || ['audit'],
      isInactive: userData.isInactive || false
    }).returning();
    return user;
  }

  async getUserByUsername(username: string) {
    const user = await db.query.users.findFirst({
      where: eq(users.username, username)
    });
    return user;
  }

  async getUserById(id: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, id)
    });
    return user;
  }

  async getAllUsers() {
    return await db.query.users.findMany({
      where: eq(users.isInactive, false),
      orderBy: desc(users.id)
    });
  }

  async updateUser(id: number, updates: Partial<typeof users.$inferInsert>) {
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    const [updatedUser] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async validatePassword(plainPassword: string, hashedPassword: string) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Audit Forms management
  async createAuditForm(formData: { name: string; sections: any; createdBy?: number }) {
    const [form] = await db.insert(auditForms).values({
      name: formData.name,
      sections: formData.sections,
      createdBy: formData.createdBy
    }).returning();
    return form;
  }

  async getAllAuditForms() {
    return await db.query.auditForms.findMany({
      orderBy: desc(auditForms.createdAt)
    });
  }

  async getAuditFormById(id: number) {
    return await db.query.auditForms.findFirst({
      where: eq(auditForms.id, id)
    });
  }

  async updateAuditForm(id: number, updates: Partial<typeof auditForms.$inferInsert>) {
    const [updatedForm] = await db.update(auditForms)
      .set(updates)
      .where(eq(auditForms.id, id))
      .returning();
    return updatedForm;
  }

  async deleteAuditForm(id: number) {
    await db.delete(auditForms).where(eq(auditForms.id, id));
  }

  // Audit Reports management
  async createAuditReport(reportData: any) {
    const [report] = await db.insert(auditReports).values(reportData).returning();
    return report;
  }

  async getAllAuditReports() {
    return await db.query.auditReports.findMany({
      where: eq(auditReports.deleted, false),
      orderBy: desc(auditReports.timestamp)
    });
  }

  async getAuditReportById(id: number) {
    return await db.query.auditReports.findFirst({
      where: and(eq(auditReports.id, id), eq(auditReports.deleted, false))
    });
  }

  async getAuditReportByAuditId(auditId: string) {
    return await db.query.auditReports.findFirst({
      where: and(eq(auditReports.auditId, auditId), eq(auditReports.deleted, false))
    });
  }

  async updateAuditReport(id: number, updates: any) {
    const [updatedReport] = await db.update(auditReports)
      .set(updates)
      .where(eq(auditReports.id, id))
      .returning();
    return updatedReport;
  }

  async softDeleteAuditReport(id: number, deletedBy: number) {
    const [deletedReport] = await db.update(auditReports)
      .set({
        deleted: true,
        deletedBy,
        deletedAt: sql`now()`
      })
      .where(eq(auditReports.id, id))
      .returning();
    return deletedReport;
  }

  // Audit Samples management
  async createAuditSample(sampleData: any) {
    const [sample] = await db.insert(auditSamples).values(sampleData).returning();
    return sample;
  }

  async getAllAuditSamples() {
    return await db.query.auditSamples.findMany({
      orderBy: desc(auditSamples.id)
    });
  }

  async getAuditSampleBySampleId(sampleId: string) {
    return await db.query.auditSamples.findFirst({
      where: eq(auditSamples.sampleId, sampleId)
    });
  }

  async updateAuditSample(id: number, updates: any) {
    const [updatedSample] = await db.update(auditSamples)
      .set(updates)
      .where(eq(auditSamples.id, id))
      .returning();
    return updatedSample;
  }

  // ATA Reviews management
  async createATAReview(reviewData: any) {
    const [review] = await db.insert(ataReviews).values(reviewData).returning();
    return review;
  }

  async getATAReviewByReportId(reportId: number) {
    return await db.query.ataReviews.findFirst({
      where: eq(ataReviews.auditReportId, reportId)
    });
  }

  async updateATAReview(id: number, updates: any) {
    const [updatedReview] = await db.update(ataReviews)
      .set(updates)
      .where(eq(ataReviews.id, id))
      .returning();
    return updatedReview;
  }

  // Deleted Audits management
  async createDeletedAudit(deletedAuditData: any) {
    const [deletedAudit] = await db.insert(deletedAudits).values(deletedAuditData).returning();
    return deletedAudit;
  }

  async getAllDeletedAudits() {
    return await db.query.deletedAudits.findMany({
      orderBy: desc(deletedAudits.deletedAt)
    });
  }

  // Skipped Samples management
  async createSkippedSample(skippedData: any) {
    const [skipped] = await db.insert(skippedSamples).values(skippedData).returning();
    return skipped;
  }

  async getAllSkippedSamples() {
    return await db.query.skippedSamples.findMany({
      orderBy: desc(skippedSamples.id)
    });
  }

  // Statistics and aggregations
  async getAuditStatistics() {
    const totalReports = await db.select({ count: sql`count(*)` })
      .from(auditReports)
      .where(eq(auditReports.deleted, false));

    const averageScore = await db.select({ avg: sql`avg(score)` })
      .from(auditReports)
      .where(eq(auditReports.deleted, false));

    const fatalCount = await db.select({ count: sql`count(*)` })
      .from(auditReports)
      .where(and(eq(auditReports.deleted, false), eq(auditReports.hasFatal, true)));

    return {
      totalReports: totalReports[0]?.count || 0,
      averageScore: averageScore[0]?.avg || 0,
      fatalCount: fatalCount[0]?.count || 0
    };
  }

  // Rebuttal management
  async createRebuttal(rebuttalData: any) {
    const [rebuttal] = await db.insert(rebuttals).values(rebuttalData).returning();
    return rebuttal;
  }

  async getRebuttalsByPartnerId(partnerId: number) {
    return await db.query.rebuttals.findMany({
      where: eq(rebuttals.partnerId, partnerId),
      orderBy: desc(rebuttals.createdAt)
    });
  }

  async getRebuttalsByAuditReportId(auditReportId: number) {
    return await db.query.rebuttals.findMany({
      where: eq(rebuttals.auditReportId, auditReportId),
      orderBy: desc(rebuttals.createdAt)
    });
  }

  async getAllRebuttals() {
    return await db.query.rebuttals.findMany({
      orderBy: desc(rebuttals.createdAt)
    });
  }

  async updateRebuttalStatus(id: number, updates: any) {
    const [updatedRebuttal] = await db.update(rebuttals)
      .set(updates)
      .where(eq(rebuttals.id, id))
      .returning();
    return updatedRebuttal;
  }

  async getAuditReportsByPartnerId(partnerId: number) {
    return await db.query.auditReports.findMany({
      where: and(
        eq(auditReports.partnerId, partnerId),
        eq(auditReports.deleted, false)
      ),
      orderBy: desc(auditReports.timestamp)
    });
  }

  async getPartnersOnly() {
    return await db.query.users.findMany({
      where: and(
        eq(users.isInactive, false),
        sql`JSON_CONTAINS(rights, '"partner"')`
      ),
      orderBy: desc(users.id)
    });
  }

  // Database health check
  async healthCheck() {
    try {
      await db.execute(sql`SELECT 1`);
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: String(error), timestamp: new Date().toISOString() };
    }
  }
}

export const databaseService = new DatabaseService();