# SNS自動投稿プロトタイプ

薬局の情報発信を想定した、Instagram投稿の下書き自動生成〜人間の最終確認〜投稿までの一気通貫プロトタイプです。

## 処理の流れ

1. **下地作成 (Claude)** — トピック情報からキャプション案・画像生成プロンプト・画像に重ねる見出し/数値を作成
2. **イラスト生成 (OpenAI)** — 画像生成プロンプトからイラストのみを生成(文字・数字は含めない)
3. **自動レビュー (Claude)** — 薬機法表現・ブランドトーン・可読性のチェックリストに沿って画像+文章を審査。NGなら修正指示を付けて2に戻る(最大3回)
4. **テキスト合成** — 正確な見出し・数値をイラストの上にプログラムで合成(AIに文字を描かせない)
5. **人間の最終確認** — レビュー画面で画像・キャプション・チェック結果を確認
6. **投稿** — 「投稿する」ボタンでInstagram Graph API経由で公開

## APIキーなしでも動作します

`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `IG_ACCESS_TOKEN` はいずれも未設定であれば自動的にモックモードで動作し、全体の流れを確認できます。トップページに各サービスが「実API」か「モック」かのバッジが表示されます。

## セットアップ

```bash
npm install
cp .env.example .env
npm start
```

ブラウザで `http://localhost:3000` を開き、トピック(見出し・詳細・カテゴリ)を入力すると、生成〜レビューが実行されて確認画面に遷移します。

## 実際のAPIに繋ぐには

`.env` に以下を設定してください。

| 変数 | 用途 | 取得方法 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 下地作成・自動レビュー | [console.anthropic.com](https://console.anthropic.com/) |
| `OPENAI_API_KEY` | イラスト生成 | [platform.openai.com](https://platform.openai.com/) |
| `IG_ACCESS_TOKEN` / `IG_BUSINESS_ACCOUNT_ID` | Instagram投稿 | Meta for Developers でアプリ登録し、Instagram Businessアカウント・Facebookページと連携して取得 |
| `PUBLIC_BASE_URL` | 投稿画像の公開URL | Instagram Graph APIは画像を公開URLからしか取得できないため、ローカル実行中は `ngrok` 等でトンネルしたURLを設定する |

## 注意事項(実運用前に必ず確認)

- **薬機法チェックは補助であり、法的な保証ではありません。** 自動レビューを通過しても、投稿前に人間が内容(特に効果効能に関する表現)を必ず確認してください。
- 画像生成・レビューはAPI呼び出しのたびに課金が発生します。再生成ループは最大3回に制限していますが、利用状況に応じて `services/pipeline.js` の `MAX_ATTEMPTS` を調整してください。
- 現在のストレージはインメモリです。サーバーを再起動すると生成済みの下書きは失われます。本番運用する場合はDB等への保存に置き換えてください。
- Instagram Graph APIの`image_url`は外部から到達可能なURLである必要があります。ローカル(`localhost`)のままでは実際の投稿はできません。

## ディレクトリ構成

```
sns-auto-post/
├── server.js               # Express本体・API
├── services/
│   ├── claudeService.js    # 下地作成・自動レビュー(Anthropic API)
│   ├── openaiService.js    # イラスト生成(OpenAI Images API)
│   ├── composeService.js   # テキスト合成(sharp)
│   ├── instagramService.js # 投稿(Instagram Graph API)
│   └── pipeline.js         # 上記を繋ぐ生成〜レビューループ
└── public/
    ├── index.html           # トピック入力画面
    └── review.html          # 最終確認・投稿画面
```
