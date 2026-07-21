const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-5';

function hasClaudeKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

async function callClaude({ system, messages, maxTokens = 1024 }) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.content.map((block) => block.text || '').join('');
}

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error(`JSON not found in Claude response: ${text}`);
  return JSON.parse(match[0]);
}

// 下地作成: トピック情報から キャプション案 / 画像生成プロンプト / 画像に重ねる正確な文言 を作る
async function createDraft(topic) {
  if (!hasClaudeKey()) {
    return mockDraft(topic);
  }

  const system = [
    'あなたは調剤薬局のInstagram運用担当のアシスタントです。',
    '与えられたトピック情報から、投稿の下地を作成します。',
    '出力は必ず次のJSON形式のみで返してください(前後に説明文を書かない):',
    '{"caption": "投稿キャプション文(絵文字可、150字程度)", ',
    ' "imagePrompt": "画像生成AI向けの英語プロンプト(イラストの雰囲気のみを指定し、文字や数字は一切含めないこと)", ',
    ' "overlayTitle": "画像内に重ねる短い見出し(20字以内)", ',
    ' "overlaySubtitle": "画像内に重ねる補足文言(30字以内、正確な数値はここに含める)"}',
    '薬機法(医薬品医療機器等法)に抵触する効果効能の断定表現(治る/効く/副作用がない等)は絶対に使わないこと。',
  ].join('\n');

  const userText = `トピック情報:\n${JSON.stringify(topic, null, 2)}`;

  const raw = await callClaude({
    system,
    messages: [{ role: 'user', content: userText }],
  });

  return extractJson(raw);
}

function mockDraft(topic) {
  const headline = topic.headline || 'お知らせ';
  const details = topic.details || '';
  return {
    caption: `【${headline}】\n${details}\n詳しくはプロフィールのリンクからご確認ください。#薬局 #三重県 #お薬相談`,
    imagePrompt: `Flat illustration, pastel colors, friendly pharmacy scene, no text, clean minimal style, related to: ${headline}`,
    overlayTitle: headline.slice(0, 20),
    overlaySubtitle: details.slice(0, 30),
    _mock: true,
  };
}

// レビュー: 生成された画像+文章をチェックリストに沿って自動判定する
async function reviewContent({ caption, overlayTitle, overlaySubtitle, imageBase64, checklist }) {
  if (!hasClaudeKey()) {
    return mockReview({ caption, overlayTitle, overlaySubtitle, checklist });
  }

  const system = [
    'あなたは調剤薬局のSNS投稿を審査するレビュアーです。',
    '与えられたチェックリストの各項目について pass/fail を判定し、',
    '必ず次のJSON形式のみで返してください:',
    '{"approved": true/false, "results": [{"item": "項目名", "pass": true/false, "reason": "理由"}], "revisionNote": "false項目がある場合、再生成のための具体的な指示"}',
  ].join('\n');

  const content = [
    {
      type: 'text',
      text: `チェックリスト:\n${checklist.map((c) => `- ${c}`).join('\n')}\n\nキャプション:\n${caption}\n\n画像内見出し: ${overlayTitle}\n画像内補足: ${overlaySubtitle}`,
    },
  ];

  if (imageBase64) {
    content.unshift({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: imageBase64 },
    });
  }

  const raw = await callClaude({
    system,
    messages: [{ role: 'user', content }],
    maxTokens: 1024,
  });

  return extractJson(raw);
}

const NG_WORDS = ['治る', '完治', '効く', '副作用がない', '必ず治', '100%', 'すぐに治'];

function mockReview({ caption, overlayTitle, overlaySubtitle, checklist }) {
  const combinedText = `${caption} ${overlayTitle} ${overlaySubtitle}`;
  const hitWord = NG_WORDS.find((w) => combinedText.includes(w));
  const results = checklist.map((item) => {
    if (item.includes('薬機法')) {
      return {
        item,
        pass: !hitWord,
        reason: hitWord ? `NGワード「${hitWord}」が含まれています` : '断定的な効果効能表現は見つかりませんでした(簡易チェック)',
      };
    }
    return { item, pass: true, reason: '簡易モック判定のためスキップ' };
  });
  const approved = results.every((r) => r.pass);
  return {
    approved,
    results,
    revisionNote: approved ? '' : `キャプション・見出しから「${hitWord}」を削除し、断定的でない表現に言い換えてください`,
    _mock: true,
  };
}

module.exports = { createDraft, reviewContent, hasClaudeKey };
