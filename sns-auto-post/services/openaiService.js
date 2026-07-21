const sharp = require('sharp');

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const MODEL = 'gpt-image-1';
const SIZE = '1024x1024';

function hasOpenAiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

// イラスト生成: プロンプトから画像(PNG Buffer, base64)を作る
async function generateIllustration(prompt) {
  if (!hasOpenAiKey()) {
    return mockIllustration(prompt);
  }

  const res = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      prompt,
      size: SIZE,
      n: 1,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI Images API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const b64 = data.data[0].b64_json;
  return { buffer: Buffer.from(b64, 'base64'), base64: b64, mock: false };
}

// APIキーが無い場合のプレースホルダー: プロンプトの内容が分かる簡易グラデーション画像を生成
async function mockIllustration(prompt) {
  const palette = ['#7dd3c0', '#f7b955', '#f28b82', '#8ab4f8'];
  const color = palette[Math.abs(hashString(prompt)) % palette.length];

  const svg = `
    <svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0.9"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" fill="url(#g)"/>
      <text x="50%" y="46%" font-size="34" text-anchor="middle" fill="#333333" font-family="sans-serif">AI生成イラスト(プレビュー)</text>
      <text x="50%" y="54%" font-size="22" text-anchor="middle" fill="#555555" font-family="sans-serif">OPENAI_API_KEY 未設定のためモック画像です</text>
    </svg>`;

  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return { buffer, base64: buffer.toString('base64'), mock: true };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

module.exports = { generateIllustration, hasOpenAiKey };
