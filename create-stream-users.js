require('dotenv').config();

const axios = require('axios');
const jwt = require('jsonwebtoken');

const apiKey = String(process.env.STREAM_API_KEY || '').trim();
const apiSecret = String(process.env.STREAM_API_SECRET || '').trim();
const baseUrl = String(process.env.STREAM_BASE_URL || 'https://chat.stream-io-api.com').trim().replace(/\/+$/, '');

if (!apiKey || !apiSecret) {
  throw new Error('Missing STREAM_API_KEY or STREAM_API_SECRET in .env');
}

const usersPayload = {
  users: {
    luna_agent: { id: 'luna_agent', name: 'Luna', role: 'user' },
    bolt_agent: { id: 'bolt_agent', name: 'Bolt', role: 'user' },
    sage_agent: { id: 'sage_agent', name: 'Sage', role: 'user' },
  },
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertUsersWithRetry(maxAttempts = 3) {
  const serverToken = jwt.sign({ server: true }, apiSecret);
  const url = `${baseUrl}/users?api_key=${encodeURIComponent(apiKey)}`;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await axios.post(url, usersPayload, {
        timeout: 20000,
        headers: {
          Authorization: serverToken,
          'Stream-Auth-Type': 'jwt',
          'Content-Type': 'application/json',
        },
      });
      return;
    } catch (err) {
      const isLast = attempt === maxAttempts;
      const status = err.response?.status;
      const msg = err.response?.data || err.message;

      // eslint-disable-next-line no-console
      console.error(`Attempt ${attempt}/${maxAttempts} failed`, status || '', msg);

      if (isLast) {
        throw err;
      }
      await sleep(1500 * attempt);
    }
  }
}

async function main() {
  await upsertUsersWithRetry(3);
  // eslint-disable-next-line no-console
  console.log('Stream users created: luna_agent, bolt_agent, sage_agent');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Create users failed. Check network access to chat.stream-io-api.com and STREAM credentials.');
  // eslint-disable-next-line no-console
  console.error(err.message || err);
  process.exit(1);
});
