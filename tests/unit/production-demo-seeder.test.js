'use strict';

const {
  buildListingSpecs,
  buildUserSpecs,
  LISTING_COUNT,
  USER_COUNT,
  validateTarget,
} = require('../../scripts/seed-test-data');

describe('test database data seeder', () => {
  it('requires an explicit confirmation for the local test database', () => {
    expect(validateTarget({
      uri: 'mongodb://mongodb:27017/campus_marketplace',
      nodeEnv: 'development',
      execute: true,
      confirmedDatabase: 'campus_marketplace',
    })).toEqual({ host: 'mongodb', database: 'campus_marketplace' });

    expect(() => validateTarget({
      uri: 'mongodb://mongodb:27017/campus_marketplace',
      nodeEnv: 'development',
      execute: false,
      confirmedDatabase: 'campus_marketplace',
    })).toThrow('--execute');
  });

  it('refuses production environments and remote database hosts', () => {
    expect(() => validateTarget({
      uri: 'mongodb://mongodb:27017/campus_marketplace',
      nodeEnv: 'production',
      execute: true,
      confirmedDatabase: 'campus_marketplace',
    })).toThrow('only when NODE_ENV is development or test');

    expect(() => validateTarget({
      uri: 'mongodb+srv://cluster.example.net/campus_marketplace',
      nodeEnv: 'development',
      execute: true,
      confirmedDatabase: 'campus_marketplace',
    })).toThrow('non-local MongoDB host');
  });

  it('builds 25 clearly synthetic student accounts with reserved test emails', () => {
    const users = buildUserSpecs('bcrypt-hash');

    expect(users).toHaveLength(USER_COUNT);
    expect(new Set(users.map((user) => user.email)).size).toBe(USER_COUNT);
    expect(users.every((user) => user.email.endsWith('@campusmarket.test'))).toBe(true);
    expect(users.every((user) => user.name.includes('(Demo '))).toBe(true);
    expect(users.every((user) => user.isDemo && user.collegeVerified === false)).toBe(true);
  });

  it('builds 150 unique demo listings distributed across the demo users', () => {
    const users = buildUserSpecs('bcrypt-hash').map((_user, index) => ({ _id: `user-${index}` }));
    const categories = [
      'Books & Notes', 'Electronics', 'Lab Equipment', 'Furniture', 'Bags & Stationery',
      'Cycles & Transport', 'Project Components', 'Sports & Fitness', 'Other',
    ].map((name) => ({ _id: `category-${name}`, name, isActive: true }));
    const listings = buildListingSpecs(users, categories);

    expect(listings).toHaveLength(LISTING_COUNT);
    expect(new Set(listings.map((listing) => listing.title)).size).toBe(LISTING_COUNT);
    expect(listings.every((listing) => listing.isDemo && listing.title.startsWith('[DEMO '))).toBe(true);
    expect(listings.every((listing) => listing.tags.includes('demo-test-seed-v1'))).toBe(true);
    expect(new Set(listings.map((listing) => listing.seller)).size).toBe(USER_COUNT);
  });
});