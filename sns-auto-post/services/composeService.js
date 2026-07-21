const sharp = require('sharp');

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// AI生成イラスト(数字・固有名詞を含まない)の上に、正確な見出し・数値をプログラムで合成する。
// AI画像生成は日本語の文字/数字の描画精度が低いため、正確性が必要な情報はここで重ねる。
async function composeOverlay({ imageBuffer, title, subtitle }) {
  const width = 1024;
  const bannerHeight = 220;

  const svg = `
    <svg width="${width}" height="${bannerHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${bannerHeight}" fill="#ffffff" fill-opacity="0.88"/>
      <text x="40" y="90" font-size="48" font-weight="bold" fill="#1f2937" font-family="sans-serif">${escapeXml(title)}</text>
      <text x="40" y="150" font-size="30" fill="#374151" font-family="sans-serif">${escapeXml(subtitle)}</text>
    </svg>`;

  const overlayBuffer = await sharp(Buffer.from(svg)).png().toBuffer();

  const composed = await sharp(imageBuffer)
    .resize(width, width)
    .composite([{ input: overlayBuffer, top: width - bannerHeight, left: 0 }])
    .png()
    .toBuffer();

  return composed;
}

module.exports = { composeOverlay };
