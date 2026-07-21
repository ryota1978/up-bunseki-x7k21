const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

function hasInstagramCredentials() {
  return Boolean(process.env.IG_ACCESS_TOKEN && process.env.IG_BUSINESS_ACCOUNT_ID);
}

// Instagram Graph API は画像を「公開URL」からのみ取得できるため、
// imageUrl には外部からアクセス可能なURL(例: ngrok等のトンネルURL + /images/xxx.png)を渡す必要がある。
async function publishImagePost({ imageUrl, caption }) {
  if (!hasInstagramCredentials()) {
    return mockPublish({ imageUrl, caption });
  }

  const token = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_BUSINESS_ACCOUNT_ID;

  // 1. メディアコンテナ作成
  const createRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      image_url: imageUrl,
      caption,
      access_token: token,
    }),
  });
  const createData = await createRes.json();
  if (!createRes.ok) {
    throw new Error(`Instagram media作成エラー: ${JSON.stringify(createData)}`);
  }

  // 2. 公開
  const publishRes = await fetch(`${GRAPH_API_BASE}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      creation_id: createData.id,
      access_token: token,
    }),
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`Instagram publishエラー: ${JSON.stringify(publishData)}`);
  }

  return { posted: true, mediaId: publishData.id, mock: false };
}

async function mockPublish({ imageUrl, caption }) {
  return {
    posted: true,
    mediaId: `mock-${Date.now()}`,
    mock: true,
    note: 'IG_ACCESS_TOKEN / IG_BUSINESS_ACCOUNT_ID 未設定のため実際には投稿していません(モック)',
    imageUrl,
    caption,
  };
}

module.exports = { publishImagePost, hasInstagramCredentials };
