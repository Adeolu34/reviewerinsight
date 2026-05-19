/**
 * One-time script to obtain a YouTube OAuth2 refresh token.
 *
 * 1. Go to https://console.cloud.google.com/
 * 2. Create a project → enable "YouTube Data API v3"
 * 3. Create OAuth2 credentials (Desktop app type)
 * 4. Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env
 * 5. Run: node scripts/get-youtube-token.js
 * 6. Open the printed URL in your browser, authorise, paste the code back
 * 7. Copy the printed refresh_token into .env as YOUTUBE_REFRESH_TOKEN
 */
require('dotenv').config();
const { google } = require('googleapis');
const readline = require('readline');

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = process.env;
if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
  console.error('Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env first');
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(
  YOUTUBE_CLIENT_ID,
  YOUTUBE_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob',
);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/youtube.upload'],
});

console.log('\nOpen this URL in your browser and authorise the app:\n');
console.log(authUrl);
console.log('');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.question('Paste the authorisation code here: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2.getToken(code.trim());
    console.log('\nAdd these to your .env:\n');
    console.log(`YOUTUBE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('\nOptional (default = public):');
    console.log('YOUTUBE_PRIVACY=public   # or unlisted / private');
  } catch (err) {
    console.error('Failed to exchange code:', err.message);
  }
});
