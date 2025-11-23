import { and, eq, inArray, isNull } from 'drizzle-orm';
import { drizzleDb } from '../db/connection';
import { users, type NewUser, type UpdateUser, type User } from '../schema/entities/users';

export class UserRepository {
  private db = drizzleDb;

  async findById(id: string, includeDeleted = false): Promise<User | null> {
    const where = includeDeleted
      ? eq(users.id, id)
      : and(eq(users.id, id), isNull(users.deletedAt));

    const result = await this.db.select().from(users).where(where).limit(1);
    return result[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, email), isNull(users.deletedAt)))
      .limit(1);
    return result[0] || null;
  }

  async findAll(includeDeleted = false): Promise<User[]> {
    const where = includeDeleted ? undefined : isNull(users.deletedAt);
    return this.db.select().from(users).where(where);
  }

  async create(data: NewUser): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) {
      throw new Error(`User with email ${data.email} already exists`);
    }

    const result = await this.db.insert(users).values(data).returning();
    return result[0];
  }

  async update(id: string, data: UpdateUser): Promise<User | null> {
    if (data.email) {
      const existing = await this.findByEmail(data.email);
      if (existing && existing.id && existing.id !== id) {
        throw new Error(`Email ${data.email} is already in use`);
      }
    }

    const result = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(users.id, id), isNull(users.deletedAt)))
      .returning();
    return result[0] || null;
  }

  async softDelete(id: string): Promise<boolean> {
    await this.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, id));
    return true;
  }

  async hardDelete(id: string): Promise<boolean> {
    await this.db.delete(users).where(eq(users.id, id));
    return true;
  }

  async restore(id: string): Promise<boolean> {
    await this.db.update(users).set({ deletedAt: null }).where(eq(users.id, id));
    return true;
  }

  async findByIds(ids: string[]): Promise<User[]> {
    if (ids.length === 0) return [];
    return this.db
      .select()
      .from(users)
      .where(and(inArray(users.id, ids), isNull(users.deletedAt)));
  }

  async findByRole(role: 'ADMIN' | 'USER'): Promise<User[]> {
    return this.db
      .select()
      .from(users)
      .where(and(eq(users.role, role), isNull(users.deletedAt)));
  }
}

export const userRepository = new UserRepository();
