'use strict';

const { config } = require('../config/env');
const { AppError, ValidationError } = require('../utils/errors');
const Product = require('../models/Product');

const MAX_GEMINI_ATTEMPTS = 2;
const RETRYABLE_GEMINI_STATUSES = new Set([429, 500, 502, 503, 504]);
const GEMINI_TIMEOUT_MS = 12000;

function extractInteractionText(result) {
  if (typeof result.output_text === 'string' && result.output_text.trim()) {
    return result.output_text;
  }

  if (!Array.isArray(result.steps)) return '';
  const textParts = [];
  let collecting = false;

  for (let i = result.steps.length - 1; i >= 0; i -= 1) {
    const step = result.steps[i];
    if (step.type === 'user_input') break;
    if (step.type !== 'model_output' || !Array.isArray(step.content)) {
      if (collecting) break;
      continue;
    }

    for (let j = step.content.length - 1; j >= 0; j -= 1) {
      const item = step.content[j];
      if (item.type === 'text') {
        collecting = true;
        textParts.push(typeof item.text === 'string' ? item.text : '');
      } else if (collecting) {
        break;
      }
    }
  }

  return textParts.reverse().join('');
}

function retryDelay(response, attempt) {
  const retryAfter = Number(response.headers && response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 5000);
  }
  return Math.min(1000 * (attempt + 1), 3000);
}

async function askGemini(prompt, json = false) {
  if (!config.ai.geminiApiKey) {
    throw new AppError('AI features are unavailable until GEMINI_API_KEY is configured.', 503, 'AI_NOT_CONFIGURED');
  }
  const url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  let response;
  for (let attempt = 0; attempt < MAX_GEMINI_ATTEMPTS; attempt += 1) {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.ai.geminiApiKey,
      },
      body: JSON.stringify({
        model: config.ai.geminiModel,
        input: prompt,
        store: false,
        generation_config: { temperature: json ? 0.2 : 0.4 },
        ...(json ? { response_format: { type: 'text', mime_type: 'application/json' } } : {}),
      }),
      signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
    }).catch((error) => {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        throw new AppError(
          'Gemini took too long to respond. Please try again.',
          504,
          'AI_PROVIDER_TIMEOUT'
        );
      }
      throw error;
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const message = error.error && error.error.message;
      if (response.status === 429 && /quota|resource[_ ]exhausted|requests? per (day|hour)/i.test(message || '')) {
        throw new AppError(
          'Gemini API quota is exhausted. Check the quota for this API key or wait for it to reset.',
          429,
          'AI_QUOTA_EXCEEDED'
        );
      }
      if (response.status === 429) {
        throw new AppError(
          'Gemini is receiving too many requests. Please wait a moment and try again.',
          503,
          'AI_PROVIDER_BUSY'
        );
      }
      if (response.status === 503 && /high demand/i.test(message || '')) {
        throw new AppError(
          'Gemini is experiencing high demand right now. Please try again shortly.',
          503,
          'AI_PROVIDER_BUSY'
        );
      }
      if (!RETRYABLE_GEMINI_STATUSES.has(response.status)) {
        throw new AppError(
          message || 'Gemini request failed.',
          502,
          'AI_PROVIDER_ERROR'
        );
      }
    } else {
      break;
    }
    if (attempt < MAX_GEMINI_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
    }
  }

  if (!response.ok) {
    throw new AppError(
      'Gemini is temporarily busy. Please try again in a moment.',
      503,
      'AI_PROVIDER_BUSY'
    );
  }
  const result = await response.json();
  const text = extractInteractionText(result);
  if (!text.trim()) throw new AppError('Gemini returned an empty response.', 502, 'AI_EMPTY_RESPONSE');
  return text;
}

async function generateListing(input) {
  if (!input || typeof input !== 'string' || input.trim().length < 5 || input.length > 2000) {
    throw new ValidationError('Describe the item in 5 to 2,000 characters.');
  }
  const text = await askGemini(
    `Create an honest campus marketplace listing from these facts. Do not invent specifications. Return JSON with title, description, suggestedCategory, and tags (string array). Facts: ${input.trim()}`,
    true
  );
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('Gemini returned listing data in an invalid format.', 502, 'AI_INVALID_RESPONSE');
  }
}

async function recommendPrice(input) {
  if (!input || typeof input !== 'object') throw new ValidationError('Provide item details.');
  const query = String(input.title || input.description || '').trim().slice(0, 300);
  if (!query) throw new ValidationError('Provide a title or description.');
  const similar = await Product.find({
    status: 'available',
    $text: { $search: query },
  }).select('title price condition').limit(10).lean();
  const context = similar.map(({ title, price, condition }) => ({ title, price, condition }));
  const text = await askGemini(
    `Estimate a fair INR price range for this used campus marketplace item. Treat marketplace examples as reference only and do not claim certainty. Return JSON with lowPrice, highPrice, currency="INR", rationale, and comparables. Item: ${JSON.stringify(input)}. Current marketplace examples: ${JSON.stringify(context)}`,
    true
  );
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('Gemini returned price data in an invalid format.', 502, 'AI_INVALID_RESPONSE');
  }
}

async function answerMarketplaceQuestion(question, userId = null) {
  if (typeof question !== 'string' || question.trim().length < 2 || question.length > 1000) {
    throw new ValidationError('Ask a question between 2 and 1,000 characters.');
  }
  const intentText = await askGemini(
    `Answer the user's question about using a campus marketplace, or identify the listings they want to find. Return JSON only with answer (string), searchTerm (short string or empty), and maxPrice (number or null). For how-to or safety questions, provide a concise helpful answer and set searchTerm to empty. For listing searches, set searchTerm to concise item keywords, set maxPrice only when the user gives a price limit, leave answer empty, and do not invent or describe listings. Never claim live listings were found. Question: ${question.trim()}`,
    true
  );
  let intent;
  try {
    intent = JSON.parse(intentText);
  } catch {
    throw new AppError('Gemini returned search data in an invalid format.', 502, 'AI_INVALID_RESPONSE');
  }
  if (intent.searchTerm) {
    const terms = String(intent.searchTerm).trim().split(/\s+/).slice(0, 6);
    const escaped = terms.join(' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = { status: 'available', $text: { $search: escaped } };
    if (intent.maxPrice !== null && intent.maxPrice !== undefined && Number.isFinite(Number(intent.maxPrice))) {
      filter.price = { $lte: Number(intent.maxPrice) };
    }
    if (userId) {
      const hidden = await require('./campus-feature.service').getHiddenUserIds(userId);
      if (hidden.length) filter.seller = { $nin: hidden };
    }
    const listings = await Product.find(filter).select('title price condition category').populate('category', 'name')
      .sort({ price: 1 }).limit(8).lean();
    const answer = listings.length
      ? `Here are the campus listings matching "${intent.searchTerm}".`
      : `I couldn't find any available listings matching "${intent.searchTerm}". Try different keywords or a higher price limit.`;
    return { answer, listings };
  }
  if (typeof intent.answer !== 'string' || !intent.answer.trim()) {
    throw new AppError('Gemini returned search data in an invalid format.', 502, 'AI_INVALID_RESPONSE');
  }
  return { answer: intent.answer.trim(), listings: [] };
}

async function checkListing(input) {
  if (!input || typeof input !== 'object') throw new ValidationError('Provide listing fields to check.');
  const prompt = `Review this campus marketplace listing for completeness and potential risk. Do not decide guilt; flag only signs needing human review. Return JSON: {score: 0-100, strengths: string[], improvements: string[], riskFlags: string[], needsAdminReview: boolean}. Listing: ${JSON.stringify(input)}`;
  const text = await askGemini(prompt, true);
  try {
    const result = JSON.parse(text);
    result.score = Math.max(0, Math.min(100, Number(result.score) || 0));
    return result;
  } catch {
    throw new AppError('Gemini returned review data in an invalid format.', 502, 'AI_INVALID_RESPONSE');
  }
}

async function detectScam(input) {
  if (!input || typeof input !== 'object') throw new ValidationError('Provide listing content to inspect.');
  const text = await askGemini(
    `Assess how credible this campus marketplace listing appears based on the information provided. You cannot verify the physical item, seller identity, photos, or ownership. Do not state or imply that the item is proven genuine or fake. Treat missing details as uncertainty, not evidence of fraud; college verification and ratings are context, not proof. Flag concrete warning signs such as unrealistic pricing, contradictory details, pressure tactics, or requests for off-platform payment. Return JSON only with: score (integer 0-100, where higher means the listing details appear more internally plausible), verdict (exactly "plausible", "needs-review", or "suspicious"), evidence (string array of concise observed details), riskFlags (string array of concrete warning signs), and needsAdminReview (boolean). Listing: ${JSON.stringify(input)}`,
    true
  );
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new AppError('Gemini returned credibility data in an invalid format.', 502, 'AI_INVALID_RESPONSE');
  }
  const score = Number(result.score);
  const verdictLabels = {
    plausible: 'Looks plausible',
    'needs-review': 'Needs a closer look',
    suspicious: 'Suspicious signals',
  };
  const arraysAreValid = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');
  if (!Number.isFinite(score) || score < 0 || score > 100 ||
      !Object.hasOwn(verdictLabels, result.verdict) ||
      !arraysAreValid(result.evidence) || !arraysAreValid(result.riskFlags) ||
      typeof result.needsAdminReview !== 'boolean') {
    throw new AppError('Gemini returned credibility data in an invalid format.', 502, 'AI_INVALID_RESPONSE');
  }
  return {
    score: Math.round(score),
    verdict: result.verdict,
    verdictLabel: verdictLabels[result.verdict],
    evidence: result.evidence.slice(0, 5),
    riskFlags: result.riskFlags.slice(0, 5),
    needsAdminReview: result.needsAdminReview,
    note: 'AI evaluates listing details only. It cannot verify the item or seller; inspect the item and use safe campus pickup.',
  };
}

module.exports = { generateListing, recommendPrice, answerMarketplaceQuestion, checkListing, detectScam };
