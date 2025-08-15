import { 
  users, 
  auditForms, 
  auditReports, 
  ataReviews, 
  deletedAudits,
  skippedSamples,
  auditSamples,
  type User, 
  type InsertUser,
  type AuditForm,
  type InsertAuditForm,
  type AuditReport,
  type InsertAuditReport,
  type AtaReview,
  type InsertAtaReview,
  type DeletedAudit,
  type InsertDeletedAudit,
  type AuditSample,
  type InsertAuditSample,
  type SkippedSample,
  type InsertSkippedSample
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

// DB imports - uncommented to enable database functionality
import { db } from "./db";
import { eq } from "drizzle-orm";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  // Session storage
  sessionStore: session.Store;
  
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Additional user methods
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, userData: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // LocalStorage access for UI compatibility
  getLocalStorage(): any;
  
  // Form methods
  getForm(id: number): Promise<AuditForm | undefined>;
  getAllForms(): Promise<AuditForm[]>;
  createForm(form: InsertAuditForm): Promise<AuditForm>;
  updateForm(id: number, form: Partial<AuditForm>): Promise<AuditForm | undefined>;
  deleteForm(id: number): Promise<boolean>;
  
  // Audit report methods
  getReport(id: number): Promise<AuditReport | undefined>;
  getAllReports(): Promise<AuditReport[]>;
  getReportsByAuditor(auditorId: number): Promise<AuditReport[]>;
  createReport(report: InsertAuditReport): Promise<AuditReport>;
  updateReport(id: number, report: Partial<AuditReport>): Promise<AuditReport | undefined>;
  deleteReport(id: number, deletedBy: number): Promise<boolean>;
  
  // ATA review methods
  getAtaReview(id: number): Promise<AtaReview | undefined>;
  getAtaReviewByReportId(reportId: number): Promise<AtaReview | undefined>;
  getAllAtaReviews(): Promise<AtaReview[]>;
  createAtaReview(review: InsertAtaReview): Promise<AtaReview>;
  updateAtaReview(id: number, review: Partial<AtaReview>): Promise<AtaReview | undefined>;
  deleteAtaReview(id: number): Promise<boolean>;
  
  // Audit samples methods
  getAuditSample(id: number): Promise<AuditSample | undefined>;
  getAllAuditSamples(): Promise<AuditSample[]>;
  getAuditSamplesByStatus(status: string): Promise<AuditSample[]>;
  getAuditSamplesByAuditor(auditorId: number): Promise<AuditSample[]>;
  createAuditSample(sample: InsertAuditSample): Promise<AuditSample>;
  createBulkAuditSamples(samples: InsertAuditSample[]): Promise<AuditSample[]>;
  updateAuditSample(id: number, sample: Partial<AuditSample>): Promise<AuditSample | undefined>;
  deleteAuditSample(id: number): Promise<boolean>;
  assignAuditSampleToAuditor(sampleId: number, auditorId: number): Promise<AuditSample | undefined>;
  bulkAssignSamplesToAuditors(sampleIds: number[], auditorIds: number[]): Promise<{assigned: number, errors: any[]}>;
  
  // Skipped samples methods
  getSkippedSample(id: number): Promise<SkippedSample | undefined>;
  getAllSkippedSamples(): Promise<SkippedSample[]>;
  getSkippedSamplesByAuditor(auditorId: number): Promise<SkippedSample[]>;
  createSkippedSample(sample: InsertSkippedSample): Promise<SkippedSample>;
  updateSkippedSample(id: number, sample: Partial<SkippedSample>): Promise<SkippedSample | undefined>;
  deleteSkippedSample(id: number): Promise<boolean>;
}

// Enhanced localStorage implementation for server
// This implementation persists to disk to survive server restarts
import fs from 'fs';
import path from 'path';

class BrowserLocalStorageEmulator {
  private store: { [key: string]: string } = {};
  private readonly storageFile: string = path.join(process.cwd(), 'localStorage.json');
  
  constructor() {
    this.loadFromDisk();
  }
  
  private loadFromDisk(): void {
    try {
      // Check if storage file exists
      if (fs.existsSync(this.storageFile)) {
        const fileContent = fs.readFileSync(this.storageFile, 'utf8');
        this.store = JSON.parse(fileContent);
        console.log(`Loaded localStorage from ${this.storageFile}`);
      } else {
        console.log(`No localStorage file found at ${this.storageFile}, starting with empty store`);
        this.store = {};
      }
    } catch (error) {
      console.error(`Error loading localStorage from disk:`, error);
      this.store = {};
    }
  }
  
  private saveToDisk(): void {
    try {
      fs.writeFileSync(this.storageFile, JSON.stringify(this.store, null, 2), 'utf8');
    } catch (error) {
      console.error(`Error saving localStorage to disk:`, error);
    }
  }
  
  getItem(key: string): string | null {
    return this.store[key] || null;
  }
  
  setItem(key: string, value: string): void {
    this.store[key] = value;
    this.saveToDisk();
  }
  
  removeItem(key: string): void {
    delete this.store[key];
    this.saveToDisk();
  }
  
  clear(): void {
    this.store = {};
    this.saveToDisk();
  }
}

// Create an in-memory storage implementation
export class MemoryStorage implements IStorage {
  // Session store for authentication
  readonly sessionStore = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });
  
  // LocalStorage emulator for UI compatibility
  private localStorageEmulator = new BrowserLocalStorageEmulator();
  
  private users: User[] = [];
  private userIdCounter = 1;
  
  private forms: AuditForm[] = [];
  private formIdCounter = 1;
  
  private reports: AuditReport[] = [];
  private reportIdCounter = 1;
  
  private ataReviews: AtaReview[] = [];
  private ataReviewIdCounter = 1;
  
  private deletedAudits: DeletedAudit[] = [];
  private deletedAuditIdCounter = 1;
  
  private auditSamples: AuditSample[] = [];
  private auditSampleIdCounter = 1;
  
  private skippedSamples: SkippedSample[] = [];
  private skippedSampleIdCounter = 1;
  
  // Get access to the localStorage emulator
  getLocalStorage(): any {
    return this.localStorageEmulator;
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(user => user.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      // First, try to create in database if available
      const { db } = await import("./db");
      
      const [createdUser] = await db
        .insert(users)
        .values({
          username: insertUser.username,
          password: insertUser.password,
          email: (insertUser as any).email || null,
          rights: insertUser.rights,
          isInactive: insertUser.isInactive || false
        })
        .returning();
      
      if (createdUser) {
        // Add to in-memory storage to match database
        const existingIndex = this.users.findIndex(u => u.id === createdUser.id);
        if (existingIndex === -1) {
          this.users.push(createdUser);
        }
        
        console.log(`Created user ${createdUser.username} in database with ID ${createdUser.id}`);
        return createdUser;
      }
    } catch (error) {
      console.error('Database create failed, using memory storage:', error);
    }
    
    // Fallback to memory storage
    const user: User = {
      id: this.userIdCounter++,
      username: insertUser.username,
      password: insertUser.password,
      email: (insertUser as any).email || null,
      rights: insertUser.rights,
      isInactive: insertUser.isInactive || false
    };
    this.users.push(user);
    console.log(`Created user ${user.username} in memory storage with ID ${user.id}`);
    return user;
  }
  
  async getAllUsers(): Promise<User[]> {
    return [...this.users].sort((a, b) => a.id - b.id);
  }
  
  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    try {
      // First, try to update in database if available
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      
      const [updatedUser] = await db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      
      if (updatedUser) {
        // Update in-memory storage to match database
        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
          this.users[index] = updatedUser;
        } else {
          // Add to memory if not found
          this.users.push(updatedUser);
        }
        
        // Also update localStorage for UI compatibility
        try {
          const qaUsers = JSON.parse(this.localStorageEmulator.getItem('qa-users') || '[]');
          const localIndex = qaUsers.findIndex((u: any) => u.id === id);
          
          if (localIndex !== -1) {
            // Update existing user in localStorage 
            qaUsers[localIndex] = {
              ...qaUsers[localIndex],
              ...userData,
              rights: updatedUser.rights // Ensure rights are properly updated
            };
          } else {
            // Add new user to localStorage
            qaUsers.push({
              id: updatedUser.id,
              username: updatedUser.username,
              password: updatedUser.password,
              email: updatedUser.email,
              rights: updatedUser.rights,
              isInactive: updatedUser.isInactive
            });
          }
          
          this.localStorageEmulator.setItem('qa-users', JSON.stringify(qaUsers));
          console.log(`Updated user ${updatedUser.username} permissions in localStorage:`, updatedUser.rights);
        } catch (localStorageError) {
          console.error('Error updating localStorage:', localStorageError);
        }
        
        return updatedUser;
      }
    } catch (dbError) {
      console.warn('Database update failed, using memory storage:', dbError);
    }
    
    // Fallback to memory-only update
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) return undefined;
    
    const user = this.users[index];
    const updatedUser = { ...user, ...userData };
    this.users[index] = updatedUser;
    
    // Also update localStorage for consistency
    try {
      const qaUsers = JSON.parse(this.localStorageEmulator.getItem('qa-users') || '[]');
      const localIndex = qaUsers.findIndex((u: any) => u.id === id);
      
      if (localIndex !== -1) {
        qaUsers[localIndex] = {
          ...qaUsers[localIndex],
          ...userData,
          rights: updatedUser.rights
        };
      } else {
        qaUsers.push({
          id: updatedUser.id,
          username: updatedUser.username,
          password: updatedUser.password,
          email: updatedUser.email,
          rights: updatedUser.rights,
          isInactive: updatedUser.isInactive
        });
      }
      
      this.localStorageEmulator.setItem('qa-users', JSON.stringify(qaUsers));
      console.log(`Updated user ${updatedUser.username} permissions in memory and localStorage:`, updatedUser.rights);
    } catch (localStorageError) {
      console.error('Error updating localStorage in fallback:', localStorageError);
    }
    
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      // First, try to delete from database if available
      const { db } = await import("./db");
      const { eq } = await import("drizzle-orm");
      
      const [deletedUser] = await db
        .delete(users)
        .where(eq(users.id, id))
        .returning();
      
      if (deletedUser) {
        // Remove from in-memory storage to match database
        const index = this.users.findIndex(u => u.id === id);
        if (index !== -1) {
          this.users.splice(index, 1);
        }
        
        // Also remove from localStorage for UI compatibility
        try {
          const qaUsers = JSON.parse(this.localStorageEmulator.getItem('qa-users') || '[]');
          const localIndex = qaUsers.findIndex((u: any) => u.id === id);
          
          if (localIndex !== -1) {
            qaUsers.splice(localIndex, 1);
            this.localStorageEmulator.setItem('qa-users', JSON.stringify(qaUsers));
          }
        } catch (localStorageError) {
          console.error('Error updating localStorage after deletion:', localStorageError);
        }
        
        console.log(`Deleted user ${deletedUser.username} from database with ID ${deletedUser.id}`);
        return true;
      }
    } catch (error) {
      console.error('Database delete failed, using memory storage:', error);
    }
    
    // Fallback to memory storage deletion
    const index = this.users.findIndex(u => u.id === id);
    if (index === -1) return false;
    
    const user = this.users[index];
    this.users.splice(index, 1);
    
    // Also remove from localStorage for consistency
    try {
      const qaUsers = JSON.parse(this.localStorageEmulator.getItem('qa-users') || '[]');
      const localIndex = qaUsers.findIndex((u: any) => u.id === id);
      
      if (localIndex !== -1) {
        qaUsers.splice(localIndex, 1);
        this.localStorageEmulator.setItem('qa-users', JSON.stringify(qaUsers));
      }
    } catch (localStorageError) {
      console.error('Error updating localStorage in fallback deletion:', localStorageError);
    }
    
    console.log(`Deleted user ${user.username} from memory storage with ID ${user.id}`);
    return true;
  }
  
  // Form methods
  async getForm(id: number): Promise<AuditForm | undefined> {
    return this.forms.find(form => form.id === id);
  }
  
  async getAllForms(): Promise<AuditForm[]> {
    return [...this.forms].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }
  
  async createForm(form: InsertAuditForm): Promise<AuditForm> {
    const newForm: AuditForm = {
      id: this.formIdCounter++,
      name: form.name,
      sections: form.sections,
      createdAt: new Date(),
      createdBy: form.createdBy || null
    };
    this.forms.push(newForm);
    return newForm;
  }
  
  async updateForm(id: number, formData: Partial<AuditForm>): Promise<AuditForm | undefined> {
    const index = this.forms.findIndex(f => f.id === id);
    if (index === -1) return undefined;
    
    const form = this.forms[index];
    const updatedForm = { ...form, ...formData };
    this.forms[index] = updatedForm;
    return updatedForm;
  }
  
  async deleteForm(id: number): Promise<boolean> {
    const index = this.forms.findIndex(f => f.id === id);
    if (index === -1) return false;
    
    this.forms.splice(index, 1);
    return true;
  }
  
  // Audit report methods
  async getReport(id: number): Promise<AuditReport | undefined> {
    return this.reports.find(report => report.id === id);
  }
  
  async getAllReports(): Promise<AuditReport[]> {
    return [...this.reports].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
  
  async getReportsByAuditor(auditorId: number): Promise<AuditReport[]> {
    return this.reports
      .filter(report => report.auditor === auditorId)
      .sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }
  
  async createReport(report: InsertAuditReport): Promise<AuditReport> {
    const newReport: AuditReport = {
      id: this.reportIdCounter++,
      auditId: report.auditId,
      formName: report.formName,
      agent: report.agent,
      agentId: report.agentId,
      auditor: report.auditor || null,
      auditorName: report.auditorName,
      sectionAnswers: report.sectionAnswers,
      score: report.score,
      maxScore: report.maxScore,
      hasFatal: report.hasFatal || false,
      timestamp: new Date(),
      status: report.status || "completed",
      edited: false,
      editedBy: null,
      editedAt: null,
      deleted: false,
      deletedBy: null,
      deletedAt: null
    };
    this.reports.push(newReport);
    return newReport;
  }
  
  async updateReport(id: number, reportData: Partial<AuditReport>): Promise<AuditReport | undefined> {
    const index = this.reports.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    
    const report = this.reports[index];
    const updatedReport = { ...report, ...reportData, edited: true };
    this.reports[index] = updatedReport;
    return updatedReport;
  }
  
  async deleteReport(id: number, deletedBy: number): Promise<boolean> {
    const index = this.reports.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    const report = this.reports[index];
    
    // Get the name of the user who deleted the report
    const userInfo = this.users.find(u => u.id === deletedBy);
    const deletedByName = userInfo ? userInfo.username : "Administrator";
    
    // Create a deleted audit entry
    const deletedAudit: DeletedAudit = {
      id: this.deletedAuditIdCounter++,
      originalId: report.id.toString(),
      auditId: report.auditId,
      formName: report.formName,
      agent: report.agent,
      agentId: report.agentId,
      auditor: report.auditor,
      auditorName: report.auditorName || "",
      sectionAnswers: report.sectionAnswers,
      score: report.score,
      maxScore: report.maxScore,
      hasFatal: report.hasFatal,
      timestamp: report.timestamp,
      deletedBy: deletedBy,
      deletedByName: deletedByName,
      deletedAt: new Date(),
      // Add any edit history if available
      editHistory: report.edited ? [
        {
          timestamp: new Date().getTime(),
          editor: deletedByName,
          action: "Deleted report"
        }
      ] : []
    };
    
    this.deletedAudits.push(deletedAudit);
    
    // Delete the original report
    this.reports.splice(index, 1);
    return true;
  }
  
  // ATA review methods
  async getAtaReview(id: number): Promise<AtaReview | undefined> {
    return this.ataReviews.find(review => review.id === id);
  }
  
  async getAtaReviewByReportId(reportId: number): Promise<AtaReview | undefined> {
    return this.ataReviews.find(review => review.auditReportId === reportId);
  }
  
  async getAllAtaReviews(): Promise<AtaReview[]> {
    return [...this.ataReviews].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
  
  async createAtaReview(review: InsertAtaReview): Promise<AtaReview> {
    const newReview: AtaReview = {
      id: this.ataReviewIdCounter++,
      auditReportId: review.auditReportId || null,
      reviewerId: review.reviewerId || null,
      reviewerName: review.reviewerName,
      feedback: review.feedback,
      rating: review.rating,
      timestamp: new Date()
    };
    this.ataReviews.push(newReview);
    return newReview;
  }
  
  async updateAtaReview(id: number, reviewData: Partial<AtaReview>): Promise<AtaReview | undefined> {
    const index = this.ataReviews.findIndex(r => r.id === id);
    if (index === -1) return undefined;
    
    const review = this.ataReviews[index];
    const updatedReview = { ...review, ...reviewData };
    this.ataReviews[index] = updatedReview;
    return updatedReview;
  }
  
  async deleteAtaReview(id: number): Promise<boolean> {
    const index = this.ataReviews.findIndex(r => r.id === id);
    if (index === -1) return false;
    
    this.ataReviews.splice(index, 1);
    return true;
  }
  
  // Audit samples methods
  async getAuditSample(id: number): Promise<AuditSample | undefined> {
    return this.auditSamples.find(sample => sample.id === id);
  }
  
  async getAllAuditSamples(): Promise<AuditSample[]> {
    return [...this.auditSamples].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }
  
  async getAuditSamplesByStatus(status: "available" | "assigned" | "inProgress" | "completed"): Promise<AuditSample[]> {
    return this.auditSamples
      .filter(sample => sample.status === status)
      .sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
  }
  
  async getAuditSamplesByAuditor(auditorId: number): Promise<AuditSample[]> {
    return this.auditSamples
      .filter(sample => sample.assignedTo === auditorId)
      .sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
  }
  
  async createAuditSample(sample: InsertAuditSample): Promise<AuditSample> {
    const now = new Date();
    const newSample: AuditSample = {
      id: this.auditSampleIdCounter++,
      sampleId: sample.sampleId,
      customerName: sample.customerName,
      ticketId: sample.ticketId,
      formType: sample.formType,
      date: sample.date || now,
      priority: (sample.priority as "high" | "medium" | "low") || "medium",
      status: (sample.status as "available" | "assigned" | "inProgress" | "completed") || "available",
      assignedTo: sample.assignedTo || null,
      assignedAt: sample.assignedTo ? now : null,
      metadata: sample.metadata || null,
      uploadedBy: sample.uploadedBy || null,
      uploadedAt: now,
      batchId: sample.batchId || `batch-${now.getTime()}`
    };
    this.auditSamples.push(newSample);
    return newSample;
  }
  
  async createBulkAuditSamples(samples: InsertAuditSample[]): Promise<AuditSample[]> {
    const createdSamples: AuditSample[] = [];
    const now = new Date();
    const batchId = `batch-${now.getTime()}`;
    
    for (const sample of samples) {
      const newSample: AuditSample = {
        id: this.auditSampleIdCounter++,
        sampleId: sample.sampleId,
        customerName: sample.customerName,
        ticketId: sample.ticketId,
        formType: sample.formType,
        date: sample.date || now,
        priority: (sample.priority as "high" | "medium" | "low") || "medium",
        status: (sample.status as "available" | "assigned" | "inProgress" | "completed") || "available",
        assignedTo: sample.assignedTo || null,
        assignedAt: sample.assignedTo ? now : null,
        metadata: sample.metadata || null,
        uploadedBy: sample.uploadedBy || null,
        uploadedAt: now,
        batchId: sample.batchId || batchId
      };
      this.auditSamples.push(newSample);
      createdSamples.push(newSample);
    }
    
    return createdSamples;
  }
  
  async updateAuditSample(id: number, sampleData: Partial<AuditSample>): Promise<AuditSample | undefined> {
    const index = this.auditSamples.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    
    const sample = this.auditSamples[index];
    
    // If we're changing assignment, update the assignedAt timestamp
    const updateAssignedAt = sampleData.assignedTo !== undefined && 
                            sampleData.assignedTo !== sample.assignedTo;
    
    const updatedSample = { 
      ...sample, 
      ...sampleData,
      assignedAt: updateAssignedAt ? new Date() : sample.assignedAt
    };
    
    this.auditSamples[index] = updatedSample;
    return updatedSample;
  }
  
  async deleteAuditSample(id: number): Promise<boolean> {
    const index = this.auditSamples.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    this.auditSamples.splice(index, 1);
    return true;
  }
  
  async assignAuditSampleToAuditor(sampleId: number, auditorId: number): Promise<AuditSample | undefined> {
    const sample = await this.getAuditSample(sampleId);
    if (!sample) return undefined;
    
    // Check if the auditor exists
    const auditor = await this.getUser(auditorId);
    if (!auditor) return undefined;
    
    // Only available samples can be assigned
    if (sample.status !== "available") return undefined;
    
    // Update the sample
    return this.updateAuditSample(sampleId, {
      assignedTo: auditorId,
      status: "assigned"
    });
  }
  
  /**
   * Implementation of fair and truly random assignment of samples to auditors
   * Uses an enhanced Fisher-Yates shuffle algorithm with multiple randomization steps:
   * 1. Shuffles both sample and auditor arrays for true randomness
   * 2. Uses a random starting point for the round-robin assignment
   * 3. Applies different distribution patterns based on the timestamp to avoid predictability
   * 
   * This ensures that each auditor gets an equal share of samples (or as close as possible)
   * while making the assignment unpredictable and truly random each time.
   */
  async bulkAssignSamplesToAuditors(sampleIds: number[], auditorIds: number[]): Promise<{assigned: number, errors: any[]}> {
    const errors: any[] = [];
    let assignedCount = 0;
    
    // Validate inputs
    if (!sampleIds.length) {
      return { assigned: 0, errors: [{ message: "No samples provided for assignment" }] };
    }
    
    if (!auditorIds.length) {
      return { assigned: 0, errors: [{ message: "No auditors provided for assignment" }] };
    }
    
    // Get the samples
    const samples = await Promise.all(
      sampleIds.map(id => this.getAuditSample(id))
    );
    
    // Filter out any that didn't exist or aren't available
    const availableSamples = samples
      .filter((sample): sample is AuditSample => 
        !!sample && sample.status === "available"
      );
    
    if (!availableSamples.length) {
      return { assigned: 0, errors: [{ message: "No available samples found" }] };
    }
    
    // Verify all auditors exist and have audit rights
    const auditors = await Promise.all(
      auditorIds.map(id => this.getUser(id))
    );
    
    // Filter out any that didn't exist or don't have audit rights
    const validAuditors = auditors
      .filter((auditor): auditor is User => 
        !!auditor && 
        Array.isArray(auditor.rights) && 
        auditor.rights.includes('audit') &&
        !auditor.isInactive
      );
    
    if (!validAuditors.length) {
      return { assigned: 0, errors: [{ message: "No valid auditors found with audit rights" }] };
    }
    
    // Implement a more robust Fisher-Yates shuffle algorithm for true randomness
    const shuffleSamples = (array: AuditSample[]): AuditSample[] => {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]]; // Swap elements
      }
      return result;
    };
    
    const shuffleAuditors = (array: User[]): User[] => {
      const result = [...array];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]]; // Swap elements
      }
      return result;
    };
    
    // Shuffle both arrays using the more robust algorithm
    const shuffledSamples = shuffleSamples(availableSamples);
    const shuffledAuditors = shuffleAuditors(validAuditors);
    
    // Choose a distribution pattern based on timestamp to enhance randomness
    const timestamp = new Date().getTime();
    const distributionMode = timestamp % 3; // 0, 1, or 2 - different distribution modes
    
    // Randomly assign starting points to further enhance randomness
    const randomStartingPoint = Math.floor(Math.random() * shuffledAuditors.length);
    
    // Perform truly random assignment with different patterns
    const assignments: { sample: AuditSample, auditor: User }[] = [];
    
    // Different distribution patterns based on timestamp
    switch (distributionMode) {
      case 0:
        // Standard round-robin with random starting point
        for (let i = 0; i < shuffledSamples.length; i++) {
          const auditorIndex = (randomStartingPoint + i) % shuffledAuditors.length;
          assignments.push({
            sample: shuffledSamples[i],
            auditor: shuffledAuditors[auditorIndex]
          });
        }
        break;
        
      case 1:
        // Grouped assignment (assign blocks of consecutive samples to each auditor)
        // This ensures each auditor gets a mix of samples from different parts of the list
        const blockSize = Math.max(1, Math.ceil(shuffledSamples.length / (shuffledAuditors.length * 2)));
        for (let i = 0; i < shuffledSamples.length; i++) {
          const blockNumber = Math.floor(i / blockSize);
          const auditorIndex = (randomStartingPoint + blockNumber) % shuffledAuditors.length;
          assignments.push({
            sample: shuffledSamples[i],
            auditor: shuffledAuditors[auditorIndex]
          });
        }
        break;
        
      case 2:
        // Reverse round-robin (to avoid any possible pattern recognition)
        for (let i = 0; i < shuffledSamples.length; i++) {
          const reverseIndex = shuffledSamples.length - 1 - i;
          const auditorIndex = (randomStartingPoint + i) % shuffledAuditors.length;
          assignments.push({
            sample: shuffledSamples[reverseIndex],
            auditor: shuffledAuditors[auditorIndex]
          });
        }
        break;
    }
    
    // Perform the assignments
    for (const assignment of assignments) {
      try {
        await this.updateAuditSample(assignment.sample.id, {
          assignedTo: assignment.auditor.id,
          status: "assigned",
          assignedAt: new Date()
        });
        assignedCount++;
      } catch (err) {
        errors.push({
          sampleId: assignment.sample.id,
          auditorId: assignment.auditor.id,
          error: err
        });
      }
    }
    
    return {
      assigned: assignedCount,
      errors
    };
  }
  
  // Skipped samples methods
  async getSkippedSample(id: number): Promise<SkippedSample | undefined> {
    return this.skippedSamples.find(sample => sample.id === id);
  }
  
  async getAllSkippedSamples(): Promise<SkippedSample[]> {
    return [...this.skippedSamples].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }
  
  async getSkippedSamplesByAuditor(auditorId: number): Promise<SkippedSample[]> {
    return this.skippedSamples
      .filter(sample => sample.auditor === auditorId)
      .sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
  }
  
  async createSkippedSample(sample: InsertSkippedSample): Promise<SkippedSample> {
    const newSample: SkippedSample = {
      id: this.skippedSampleIdCounter++,
      auditId: sample.auditId,
      formName: sample.formName,
      agent: sample.agent,
      agentId: sample.agentId,
      auditor: sample.auditor || null,
      auditorName: sample.auditorName,
      reason: sample.reason,
      timestamp: new Date(),
      status: sample.status || "skipped",
    };
    this.skippedSamples.push(newSample);
    return newSample;
  }
  
  async updateSkippedSample(id: number, sampleData: Partial<SkippedSample>): Promise<SkippedSample | undefined> {
    const index = this.skippedSamples.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    
    const sample = this.skippedSamples[index];
    const updatedSample = { ...sample, ...sampleData };
    this.skippedSamples[index] = updatedSample;
    return updatedSample;
  }
  
  async deleteSkippedSample(id: number): Promise<boolean> {
    const index = this.skippedSamples.findIndex(s => s.id === id);
    if (index === -1) return false;
    
    this.skippedSamples.splice(index, 1);
    return true;
  }
}

// Use in-memory storage for local preview
export const storage = new MemoryStorage();
