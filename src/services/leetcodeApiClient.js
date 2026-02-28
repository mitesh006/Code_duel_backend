// src/services/leetcodeApiClient.js
const axios = require('axios');
const Bottleneck = require('bottleneck');

const limiter = new Bottleneck({
  maxConcurrent: 3, // Max 2-3 concurrent requests
  minTime: 500      // At least 500ms between requests (tune as needed)
});

const BASE_URL = 'https://leetcode.com/graphql/';

async function leetcodeApiRequest(query, variables = {}, retries = 5, backoff = 1000) {
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const response = await limiter.schedule(() =>
        axios.post(BASE_URL, { query, variables }, {
          headers: {
            'Content-Type': 'application/json',
            // Add auth cookies/headers if needed
          }
        })
      );
      return response.data;
    } catch (error) {
      const status = error.response?.status;
      if (status === 429) {
        // Rate limit hit: exponential backoff
        if (attempt === retries) throw new Error('LeetCode API rate limit exceeded after retries');
        const retryAfter = error.response.headers['retry-after'];
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : backoff * Math.pow(2, attempt);
        await new Promise(res => setTimeout(res, delay));
        attempt++;
      } else {
        // Other errors: throw immediately
        throw error;
      }
    }
  }
}

module.exports = { leetcodeApiRequest };