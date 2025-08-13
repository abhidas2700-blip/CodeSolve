import { db } from "../server/db";
import { users, auditForms, auditReports } from "@shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("Starting database seeding...");
  
  try {
    // Check if admin user already exists
    const existingAdmin = await db.select().from(users).where(eq(users.username, 'admin'));
    
    if (existingAdmin.length === 0) {
      // Create default admin user
      await db.insert(users).values({
        username: 'admin',
        password: 'admin123', // In production, this should be hashed
        rights: ['admin', 'manager', 'team_leader', 'auditor'],
        isInactive: false
      });
      console.log("Created default admin user");
    } else {
      console.log("Admin user already exists, skipping creation");
    }
    
    // Check if default user already exists
    const existingUser = await db.select().from(users).where(eq(users.username, 'Abhishek'));
    
    if (existingUser.length === 0) {
      // Create a default auditor user  
      await db.insert(users).values({
        username: 'Abhishek',
        password: '1234', // In production, this should be hashed
        rights: ['auditor'],
        isInactive: false
      });
      console.log("Created default Abhishek user");
    } else {
      console.log("Abhishek user already exists, skipping creation");
    }
    
    console.log("Database seeding completed successfully!");
    
  } catch (error) {
    console.error("Error during database seeding:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log("Seeding finished");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

export { seed };