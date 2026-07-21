const claude = require('./claudeService');
const openai = require('./openaiService');
const { composeOverlay } = require('./composeService');

const MAX_ATTEMPTS = 3;

const CHECKLIST = [
  '薬機法(効果効能の断定表現)に抵触する表現がないか',
  'ブランドトーンに合っているか(丁寧・親しみやすい)',
  '画像内の文字が読みやすいか',
];

// 下地作成 → イラスト生成 → 自動レビュー のループを最大MAX_ATTEMPTS回まで実行し、
// 最終的な下書き(人間の最終確認待ち)を返す。
async function runPipeline(topic) {
  const draft = await claude.createDraft(topic);
  const attempts = [];

  let currentPrompt = draft.imagePrompt;
  let approvedAttempt = null;
  let lastIllustration = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const illustration = await openai.generateIllustration(currentPrompt);
    lastIllustration = illustration;
    const review = await claude.reviewContent({
      caption: draft.caption,
      overlayTitle: draft.overlayTitle,
      overlaySubtitle: draft.overlaySubtitle,
      imageBase64: illustration.base64,
      checklist: CHECKLIST,
    });

    attempts.push({
      attempt,
      prompt: currentPrompt,
      review,
      imageMock: illustration.mock,
    });

    if (review.approved) {
      approvedAttempt = { illustration, review, attempt };
      break;
    }

    if (review.revisionNote) {
      currentPrompt = `${draft.imagePrompt}\n\n(修正指示: ${review.revisionNote})`;
    }
  }

  const finalIllustration = approvedAttempt ? approvedAttempt.illustration : lastIllustration;

  const composedImage = await composeOverlay({
    imageBuffer: finalIllustration.buffer,
    title: draft.overlayTitle,
    subtitle: draft.overlaySubtitle,
  });

  return {
    topic,
    draft,
    checklist: CHECKLIST,
    attempts,
    autoApproved: Boolean(approvedAttempt),
    composedImageBuffer: composedImage,
    caption: draft.caption,
  };
}

module.exports = { runPipeline, MAX_ATTEMPTS, CHECKLIST };
