'use strict';

/**
 * tests/unit/auth.service.test.js
 *
 * Unit tests for auth.service.js.
 *
 * Mocking strategy:
 *  - config/env   : mocked with a known JWT secret so token signing and
 *                   verification use the same value.
 *  - utils/logger : mocked to suppress all log output during tests.
 *  - models/User  : mocked so no real database connection is needed.
 *  - bcrypt       : mocked so tests do not wait for actual hashing.
 */

// ----------------------------------------------------------------
// jest.mock() calls are hoisted by Jest before any other code.
// Factory functions run in isolation — do not reference outer scope.
// ----------------------------------------------------------------

const UNIT_TEST_JWT_SECRET = 'unit-test-jwt-secret-long-enough-to-be-valid';

jest.mock('../../src/config/env', () => ({
  config: {
    jwt: {
      secret: 'unit-test-jwt-secret-long-enough-to-be-valid',
      expiresIn: '1h',
    },
    db: { uri: 'mongodb://localhost:27017/campus_marketplace_test' },
    env: 'test',
    isProduction: false,
    isDevelopment: false,
    isTest: true,
    log: { level: 'error' },
    app: { name: 'Campus Marketplace' },
    cookie: { secure: false, sameSite: 'lax', maxAge: 604800000 },
    cors: { origin: 'http://localhost:3000' },
    port: 3000,
  },
  validateEnv: jest.fn(),
}));

jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  sanitize: jest.fn((obj) => obj),
}));

jest.mock('../../src/models/User');
jest.mock('bcrypt');

// ----------------------------------------------------------------
// Requires — after mocks
// ----------------------------------------------------------------

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const authService = require('../../src/services/auth.service');
const User = require('../../src/models/User');
const { ConflictError, AuthenticationError } = require('../../src/utils/errors');

// ------------------------------------------------------------------
// register()
// ------------------------------------------------------------------

describe('authService.register()', () => {
  const validData = {
    name: 'Test Student',
    email: 'student@test.com',
    password: 'Password123',
    college: 'Test College',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should hash the password with bcrypt cost factor 12', async () => {
    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed-password');

    const mockUser = {
      _id: 'user-id-1',
      name: validData.name,
      email: validData.email,
      role: 'student',
      toSafeObject: jest.fn().mockReturnValue({ _id: 'user-id-1', name: validData.name }),
    };
    User.create.mockResolvedValue(mockUser);

    await authService.register(validData);

    expect(bcrypt.hash).toHaveBeenCalledWith(validData.password, 12);
  });

  it('should create a user with role student regardless of input', async () => {
    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed-password');

    const mockUser = { toSafeObject: jest.fn().mockReturnValue({}) };
    User.create.mockResolvedValue(mockUser);

    await authService.register(validData);

    expect(User.create).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'student' })
    );
  });

  it('should store passwordHash and never store plaintext password', async () => {
    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('$2b$12$hashed');

    const mockUser = { toSafeObject: jest.fn().mockReturnValue({}) };
    User.create.mockResolvedValue(mockUser);

    await authService.register(validData);

    const createArg = User.create.mock.calls[0][0];
    // plaintext password must NOT be stored
    expect(createArg.password).toBeUndefined();
    // hash must be stored under passwordHash
    expect(createArg.passwordHash).toBe('$2b$12$hashed');
  });

  it('should throw ConflictError with DUPLICATE_EMAIL code if email already exists', async () => {
    User.findOne.mockResolvedValue({ email: validData.email });

    await expect(authService.register(validData)).rejects.toThrow(ConflictError);
    await expect(authService.register(validData)).rejects.toMatchObject({
      code: 'DUPLICATE_EMAIL',
      statusCode: 409,
    });
  });

  it('should return a safe user object without passwordHash', async () => {
    User.findOne.mockResolvedValue(null);
    bcrypt.hash.mockResolvedValue('hashed-password');

    const safeUser = { _id: 'user-id-1', name: validData.name, role: 'student' };
    const mockUser = { toSafeObject: jest.fn().mockReturnValue(safeUser) };
    User.create.mockResolvedValue(mockUser);

    const result = await authService.register(validData);

    expect(result).toEqual(safeUser);
    expect(result.passwordHash).toBeUndefined();
  });
});

// ------------------------------------------------------------------
// login()
// ------------------------------------------------------------------

describe('authService.login()', () => {
  const email = 'student@test.com';
  const password = 'Password123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw AuthenticationError with INVALID_CREDENTIALS if user is not found', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await expect(authService.login(email, password)).rejects.toThrow(AuthenticationError);
    await expect(authService.login(email, password)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });

  it('should throw AuthenticationError with INVALID_CREDENTIALS if password does not match', async () => {
    const mockUser = { _id: 'id', passwordHash: 'hash', role: 'student' };
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(authService.login(email, password)).rejects.toThrow(AuthenticationError);
    await expect(authService.login(email, password)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('should return a signed JWT and safe user object on success', async () => {
    const safeUser = { _id: 'id', name: 'Test', role: 'student' };
    const mockUser = {
      _id: 'id',
      role: 'student',
      passwordHash: 'hash',
      toSafeObject: jest.fn().mockReturnValue(safeUser),
    };
    User.findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });
    bcrypt.compare.mockResolvedValue(true);

    const result = await authService.login(email, password);

    expect(result).toHaveProperty('token');
    expect(result).toHaveProperty('user');
    expect(result.user.passwordHash).toBeUndefined();
    expect(result.user).toEqual(safeUser);

    // Verify the token is a valid JWT signed with the mocked secret
    const decoded = jwt.verify(result.token, UNIT_TEST_JWT_SECRET);
    expect(decoded.userId).toBe('id');
    expect(decoded.role).toBe('student');
  });

  it('should fetch user with +passwordHash for comparison', async () => {
    const selectMock = jest.fn().mockResolvedValue(null);
    User.findOne.mockReturnValue({ select: selectMock });

    await authService.login(email, password).catch(() => {});

    expect(selectMock).toHaveBeenCalledWith('+passwordHash');
  });

  it('should use identical error messages for missing user and wrong password (prevent enumeration)', async () => {
    // Case 1: user not found
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    let errMissingUser;
    try { await authService.login(email, password); } catch (e) { errMissingUser = e; }

    // Case 2: wrong password
    const mockUser = { _id: 'id', passwordHash: 'hash', role: 'student' };
    User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });
    bcrypt.compare.mockResolvedValue(false);
    let errWrongPassword;
    try { await authService.login(email, 'wrongpassword'); } catch (e) { errWrongPassword = e; }

    expect(errMissingUser.message).toBe(errWrongPassword.message);
  });
});
