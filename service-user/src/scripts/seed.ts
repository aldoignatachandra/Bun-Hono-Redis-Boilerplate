import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { closeDatabaseConnection, drizzleDb } from '../db/connection';
import logger from '../helpers/logger';
import { users } from '../modules/user/domain/schema';

async function seed() {
  try {
    logger.info('Starting database seed...');

    const adminEmail = 'admin@example.com';
    const adminPassword = 'admin';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Check if admin already exists
    const existingUser = await drizzleDb.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, adminEmail),
    });

    if (existingUser) {
      logger.info('Admin user already exists. Skipping...');
      await closeDatabaseConnection();
      process.exit(0);
    }

    // Create admin user
    await drizzleDb.insert(users).values({
      id: uuidv4(),
      email: adminEmail,
      password: hashedPassword,
      role: 'ADMIN',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info(`Admin user created successfully!`);
    logger.info(`Email: ${adminEmail}`);
    logger.info(`Password: ${adminPassword}`);

    await closeDatabaseConnection();
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed database:', error);
    await closeDatabaseConnection();
    process.exit(1);
  }
}

seed();
