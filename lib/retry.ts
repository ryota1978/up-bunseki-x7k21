export type RetryResult = { ok: true } | { ok: false; message: string };

const WAITS = [500, 1500, 3000];

function messageFor(e: unknown): string {
  if (e instanceof Error) {
    if (/failed to fetch|network/i.test(e.message)) {
      return "サーバーに接続できませんでした。通信環境をご確認のうえ、時間をおいて再度お試しください。";
    }
    return `保存に失敗しました（${e.message}）。時間をおいて再度お試しください。`;
  }
  return "保存に失敗しました。時間をおいて再度お試しください。";
}

/**
 * 保存系の処理を、失敗したら自動で複数回リトライする。
 * 依頼書 1-4「保存の成功/失敗を必ず分かるようにする・自動リトライする」に対応。
 */
export async function withRetry(fn: () => Promise<void>): Promise<RetryResult> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= WAITS.length; attempt++) {
    try {
      await fn();
      return { ok: true };
    } catch (e) {
      lastError = e;
      if (attempt < WAITS.length) {
        await new Promise((r) => setTimeout(r, WAITS[attempt]));
      }
    }
  }
  return { ok: false, message: messageFor(lastError) };
}
