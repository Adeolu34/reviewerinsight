#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const freesound = require('../src/services/freesound');

function mask(s) {
  if (!s) return '(not set)';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

async function main() {
  const token = freesound.getApiToken();
  const clientId = process.env.FREESOUND_CLIENT_ID?.trim();

  console.log('Freesound credential check');
  console.log(`  FREESOUND_API_KEY / CLIENT_SECRET: ${mask(token)}`);
  console.log(`  FREESOUND_CLIENT_ID (OAuth only): ${mask(clientId)}`);

  if (!token) {
    console.log('\nFAIL — Add FREESOUND_API_KEY=your_client_secret_api_key');
    console.log('  From https://freesound.org/apiv2/apply → column "Client secret/Api key"');
    console.log('  Do NOT put Client ID in FREESOUND_API_KEY.');
    process.exit(1);
  }

  if (clientId && token === clientId) {
    console.log('\nWARN — Token looks like Client ID. Use "Client secret/Api key" instead.');
  }

  const json = await freesound.searchCc0Sounds('rain leaves', 3);
  const n = (json.results || []).length;
  const url = freesound.pickPreviewUrl(json.results || []);
  console.log(`\nOK — ${n} CC0 results, preview: ${url ? 'yes' : 'no'}`);
  process.exit(url ? 0 : 1);
}

main().catch((err) => {
  console.error('\nFAIL —', err.message);
  process.exit(1);
});
