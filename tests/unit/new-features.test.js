'use strict';

jest.mock('../../src/config/env', () => ({
  config: {
    ai: { geminiApiKey: '', geminiModel: 'gemini-3.8-flash' },
  },
}));

jest.mock('../../src/models/Product', () => ({
  find: jest.fn(),
}));

const aiService = require('../../src/services/ai.service');
const Product = require('../../src/models/Product');
const { AppError, ValidationError } = require('../../src/utils/errors');

describe('new marketplace feature validation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires an AI API key instead of silently returning a placeholder', async () => {
    await expect(aiService.generateListing('Used textbook, good condition')).rejects.toMatchObject({
      code: 'AI_NOT_CONFIGURED',
      statusCode: 503,
    });
  });

  it('validates AI listing descriptions before calling Gemini', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    await expect(aiService.generateListing('no')).rejects.toBeInstanceOf(ValidationError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('does not return fabricated marketplace prices without Gemini', async () => {
    Product.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
    await expect(aiService.recommendPrice({ title: 'Used laptop' })).rejects.toBeInstanceOf(AppError);
  });
});
