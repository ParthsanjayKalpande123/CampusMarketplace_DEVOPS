'use strict';

jest.mock('../../src/config/env', () => ({
  config: {
    ai: { geminiApiKey: 'unit-test-key', geminiModel: 'gemini-3.8-flash' },
  },
}));

jest.mock('../../src/models/Product', () => ({
  find: jest.fn(),
}));

const Product = require('../../src/models/Product');
const ai = require('../../src/services/ai.service');
const originalFetch = global.fetch;

function geminiResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ output_text: text }),
  };
}

function geminiRestResponse(text) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      steps: [{
        type: 'model_output',
        content: [{ type: 'text', text }],
      }],
    }),
  };
}

function geminiError(status, message, retryAfter) {
  return {
    ok: false,
    status,
    headers: { get: (name) => (name === 'retry-after' ? retryAfter : null) },
    json: async () => ({ error: { message } }),
  };
}

describe('Gemini marketplace features', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    Product.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue([]),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('generates a listing from the supplied item facts', async () => {
    const listing = {
      title: 'Used engineering textbook',
      description: 'Good-condition engineering textbook.',
      suggestedCategory: 'Books & Notes',
      tags: ['engineering'],
    };
    global.fetch.mockResolvedValue(geminiResponse(JSON.stringify(listing)));

    await expect(ai.generateListing('Engineering textbook in good condition')).resolves.toEqual(listing);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(request.headers['x-goog-api-key']).toBe('unit-test-key');
    expect(request.body).toContain('"model":"gemini-3.8-flash"');
    expect(request.body).toContain('"response_format":{"type":"text","mime_type":"application/json"}');
    expect(request.body).toContain('"store":false');
  });

  it('retries temporary Gemini overloads and succeeds when the service recovers', async () => {
    const listing = {
      title: 'Used engineering textbook',
      description: 'Good-condition engineering textbook.',
      suggestedCategory: 'Books & Notes',
      tags: ['engineering'],
    };
    global.fetch
      .mockResolvedValueOnce(geminiError(503, 'Service is busy', '0.01'))
      .mockResolvedValueOnce(geminiResponse(JSON.stringify(listing)));

    await expect(ai.generateListing('Engineering textbook in good condition')).resolves.toEqual(listing);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns a clear busy error after retrying transient provider failures', async () => {
    global.fetch.mockResolvedValue(geminiError(503, 'Service is busy', '0.01'));

    await expect(ai.generateListing('Engineering textbook in good condition')).rejects.toMatchObject({
      code: 'AI_PROVIDER_BUSY',
      statusCode: 503,
      message: 'Gemini is temporarily busy. Please try again in a moment.',
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns a clear quota error without retrying an exhausted daily quota', async () => {
    global.fetch.mockResolvedValue(geminiError(
      429,
      'Rate limit exceeded for model (limit: 20 requests per day on Free Tier).'
    ));

    await expect(ai.generateListing('Engineering textbook in good condition')).rejects.toMatchObject({
      code: 'AI_QUOTA_EXCEEDED',
      statusCode: 429,
      message: 'Gemini API quota is exhausted. Check the quota for this API key or wait for it to reset.',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('does not retry a temporary Gemini rate limit', async () => {
    global.fetch.mockResolvedValue(geminiError(429, 'Too many requests per minute.'));

    await expect(ai.generateListing('Engineering textbook in good condition')).rejects.toMatchObject({
      code: 'AI_PROVIDER_BUSY',
      statusCode: 503,
      message: 'Gemini is receiving too many requests. Please wait a moment and try again.',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns high-demand responses immediately instead of retrying', async () => {
    global.fetch.mockResolvedValue(geminiError(
      503,
      'The model is currently experiencing high demand. Please try again later.'
    ));

    await expect(ai.generateListing('Engineering textbook in good condition')).rejects.toMatchObject({
      code: 'AI_PROVIDER_BUSY',
      statusCode: 503,
      message: 'Gemini is experiencing high demand right now. Please try again shortly.',
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports Gemini request timeouts clearly', async () => {
    const timeout = new Error('Request timed out');
    timeout.name = 'TimeoutError';
    global.fetch.mockRejectedValue(timeout);

    await expect(ai.generateListing('Engineering textbook in good condition')).rejects.toMatchObject({
      code: 'AI_PROVIDER_TIMEOUT',
      statusCode: 504,
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('recommends a price using marketplace comparables', async () => {
    const recommendation = {
      lowPrice: 15000,
      highPrice: 19000,
      currency: 'INR',
      rationale: 'Based on the provided details.',
      comparables: [],
    };
    global.fetch.mockResolvedValue(geminiResponse(JSON.stringify(recommendation)));

    await expect(ai.recommendPrice({ title: 'Used laptop', condition: 'good' })).resolves.toEqual(recommendation);
    expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({ status: 'available', $text: expect.any(Object) }));
  });

  it('answers marketplace questions and includes live listing results when available', async () => {
    global.fetch.mockResolvedValue(geminiResponse(JSON.stringify({
      answer: 'Meet on campus and confirm the item before paying.',
      searchTerm: '',
      maxPrice: null,
    })));

    await expect(ai.answerMarketplaceQuestion('How do I buy safely?')).resolves.toEqual({
      answer: 'Meet on campus and confirm the item before paying.',
      listings: [],
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('extracts assistant text from the raw Interactions API response steps', async () => {
    global.fetch.mockResolvedValue(geminiRestResponse(JSON.stringify({
      answer: 'Meet on campus and confirm the item before paying.',
      searchTerm: '',
      maxPrice: null,
    })));

    await expect(ai.answerMarketplaceQuestion('How do I buy safely?')).resolves.toEqual({
      answer: 'Meet on campus and confirm the item before paying.',
      listings: [],
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns live listings for search questions without a second Gemini request', async () => {
    const listings = [{
      _id: 'listing-1',
      title: 'Used laptop',
      price: 25000,
      condition: 'good',
      category: { name: 'Electronics' },
    }];
    Product.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      populate: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(listings),
    });
    global.fetch.mockResolvedValue(geminiResponse(JSON.stringify({
      answer: '',
      searchTerm: 'laptop',
      maxPrice: 30000,
    })));

    await expect(ai.answerMarketplaceQuestion('Find laptops under 30000')).resolves.toEqual({
      answer: 'Here are the campus listings matching "laptop".',
      listings,
    });
    expect(Product.find).toHaveBeenCalledWith({
      status: 'available',
      $text: { $search: 'laptop' },
      price: { $lte: 30000 },
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns quality feedback for a draft listing', async () => {
    const assessment = {
      score: 86,
      strengths: ['Clear title'],
      improvements: ['Add location'],
      riskFlags: [],
      needsAdminReview: false,
    };
    global.fetch.mockResolvedValue(geminiResponse(JSON.stringify(assessment)));

    await expect(ai.checkListing({ title: 'Used calculator' })).resolves.toEqual(assessment);
  });

  it('returns a cautious listing credibility assessment and advisory risk flags', async () => {
    global.fetch.mockResolvedValue(geminiResponse(JSON.stringify({
      score: 45,
      verdict: 'needs-review',
      evidence: ['Item price is unusually low for the described condition.'],
      riskFlags: ['Requests payment outside the platform'],
      needsAdminReview: true,
    })));

    await expect(ai.detectScam({ title: 'Urgent sale' })).resolves.toEqual({
      score: 45,
      verdict: 'needs-review',
      verdictLabel: 'Needs a closer look',
      evidence: ['Item price is unusually low for the described condition.'],
      riskFlags: ['Requests payment outside the platform'],
      needsAdminReview: true,
      note: 'AI evaluates listing details only. It cannot verify the item or seller; inspect the item and use safe campus pickup.',
    });
  });

  it('rejects malformed credibility data instead of returning a misleading score', async () => {
    global.fetch.mockResolvedValue(geminiResponse(JSON.stringify({
      score: 'unknown',
      verdict: 'genuine',
      evidence: [],
      riskFlags: [],
      needsAdminReview: false,
    })));

    await expect(ai.detectScam({ title: 'Used textbook' })).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
      statusCode: 502,
    });
  });
});
