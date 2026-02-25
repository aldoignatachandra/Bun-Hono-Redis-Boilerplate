import { describe, expect, it, spyOn } from 'bun:test';
import { UserRepository } from '../../../../src/modules/user/repositories/UserRepository';
import { UserRepository as DrizzleUserRepository } from '../../../../src/modules/user/repositories/drizzle-repo';

describe('UserRepository', () => {
  const baseUser = {
    id: 'u1',
    email: 'user@example.com',
    username: 'user',
    name: 'User',
    password: 'hash',
    role: 'USER',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null as Date | null,
  };

  it('creates users via drizzle repository', async () => {
    const createSpy = spyOn(DrizzleUserRepository.prototype, 'create').mockResolvedValue({
      ...baseUser,
    } as never);

    const repo = new UserRepository();
    const result = await repo.create({
      email: 'user@example.com',
      username: 'user',
      name: 'User',
      password: 'hash',
    });
    expect(result.id).toBe('u1');
    createSpy.mockRestore();
  });

  it('delegates findByEmail to drizzle repository', async () => {
    const findSpy = spyOn(DrizzleUserRepository.prototype, 'findByEmail').mockResolvedValue({
      ...baseUser,
    } as never);

    const repo = new UserRepository();
    const result = await repo.findByEmail('user@example.com');
    expect(result?.email).toBe('user@example.com');
    findSpy.mockRestore();
  });

  it('returns null for deleted user when includeDeleted is false', async () => {
    const findSpy = spyOn(DrizzleUserRepository.prototype, 'findByEmail').mockResolvedValue({
      ...baseUser,
      deletedAt: new Date(),
    } as never);

    const repo = new UserRepository();
    const result = await repo.findByEmail('user@example.com');
    expect(result).toBeNull();
    findSpy.mockRestore();
  });

  it('returns password when includePassword is true', async () => {
    const findSpy = spyOn(DrizzleUserRepository.prototype, 'findByEmail').mockResolvedValue({
      ...baseUser,
    } as never);

    const repo = new UserRepository();
    const result = await repo.findByEmail('user@example.com', {}, true);
    expect(result?.email).toBe('user@example.com');
    expect((result as { password?: string }).password).toBe('hash');
    findSpy.mockRestore();
  });

  it('returns null for auth lookup when user is deleted', async () => {
    const findSpy = spyOn(DrizzleUserRepository.prototype, 'findByEmail').mockResolvedValue({
      ...baseUser,
      deletedAt: new Date(),
    } as never);

    const repo = new UserRepository();
    const result = await repo.findByEmailForAuth('user@example.com');
    expect(result).toBeNull();
    findSpy.mockRestore();
  });

  it('finds user by id and removes password', async () => {
    const findSpy = spyOn(DrizzleUserRepository.prototype, 'findById').mockResolvedValue({
      ...baseUser,
    } as never);

    const repo = new UserRepository();
    const result = await repo.findById('u1');
    expect(result?.id).toBe('u1');
    expect('password' in (result as unknown as Record<string, unknown>)).toBe(false);
    findSpy.mockRestore();
  });

  it('finds user by username', async () => {
    const findSpy = spyOn(DrizzleUserRepository.prototype, 'findByUsername').mockResolvedValue({
      ...baseUser,
    } as never);

    const repo = new UserRepository();
    const result = await repo.findByUsername('user');
    expect(result?.username).toBe('user');
    findSpy.mockRestore();
  });

  it('updates user via drizzle repository', async () => {
    const updateSpy = spyOn(DrizzleUserRepository.prototype, 'update').mockResolvedValue({
      ...baseUser,
      name: 'Updated',
    } as never);

    const repo = new UserRepository();
    const result = await repo.update('u1', { name: 'Updated' } as never);
    expect(result?.name).toBe('Updated');
    updateSpy.mockRestore();
  });

  it('returns null when update does not find user', async () => {
    const updateSpy = spyOn(DrizzleUserRepository.prototype, 'update').mockResolvedValue(
      null as never
    );

    const repo = new UserRepository();
    const result = await repo.update('missing', { name: 'Updated' } as never);
    expect(result).toBeNull();
    updateSpy.mockRestore();
  });

  it('delegates soft delete when force is false', async () => {
    const softDeleteSpy = spyOn(DrizzleUserRepository.prototype, 'softDelete').mockResolvedValue(
      true as never
    );
    const hardDeleteSpy = spyOn(DrizzleUserRepository.prototype, 'hardDelete').mockResolvedValue(
      true as never
    );

    const repo = new UserRepository();
    const result = await repo.delete('u1');
    expect(result).toBe(true);
    expect(softDeleteSpy).toHaveBeenCalled();
    expect(hardDeleteSpy).not.toHaveBeenCalled();
    softDeleteSpy.mockRestore();
    hardDeleteSpy.mockRestore();
  });

  it('delegates hard delete when force is true', async () => {
    const softDeleteSpy = spyOn(DrizzleUserRepository.prototype, 'softDelete').mockResolvedValue(
      true as never
    );
    const hardDeleteSpy = spyOn(DrizzleUserRepository.prototype, 'hardDelete').mockResolvedValue(
      true as never
    );

    const repo = new UserRepository();
    const result = await repo.delete('u1', true);
    expect(result).toBe(true);
    expect(hardDeleteSpy).toHaveBeenCalled();
    expect(softDeleteSpy).not.toHaveBeenCalled();
    softDeleteSpy.mockRestore();
    hardDeleteSpy.mockRestore();
  });

  it('restores user via drizzle repository', async () => {
    const restoreSpy = spyOn(DrizzleUserRepository.prototype, 'restore').mockResolvedValue(
      true as never
    );

    const repo = new UserRepository();
    const result = await repo.restore('u1');
    expect(result).toBe(true);
    restoreSpy.mockRestore();
  });

  it('finds all users with mapping', async () => {
    const findSpy = spyOn(DrizzleUserRepository.prototype, 'findAll').mockResolvedValue({
      data: [{ ...baseUser }, { ...baseUser, id: 'u2', email: 'u2@example.com' }],
      total: 2,
    } as never);

    const repo = new UserRepository();
    const result = await repo.findAll({ limit: 10, offset: 0 });
    expect(result.total).toBe(2);
    expect((result.data[0] as unknown as { password?: string }).password).toBeUndefined();
    expect(result.data[1].email).toBe('u2@example.com');
    findSpy.mockRestore();
  });

  it('finds user by id including deleted', async () => {
    const findSpy = spyOn(DrizzleUserRepository.prototype, 'findById').mockResolvedValue({
      ...baseUser,
      deletedAt: new Date(),
    } as never);

    const repo = new UserRepository();
    const result = await repo.findByIdWithDeleted('u1');
    expect(result?.id).toBe('u1');
    findSpy.mockRestore();
  });
});
