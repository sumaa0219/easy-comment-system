# TSG コメントシステム

YouTube風のコメント機能を持つWebアプリケーションです。OBS Studio での配信に最適化された表示機能と、リアルタイムコメント投稿機能を提供します。

## 機能

### フロントエンド（Next.js）
- **インスタンス管理**: 複数のコメントインスタンスを作成・管理
- **表示ページ（OBS用）**: 配信ソフトに最適化されたコメント表示
  - グリーンバック等の背景色選択
  - フォントサイズ・色の調整
  - 自動スクロール機能
  - リアルタイム更新
- **コメント投稿ページ**: 視聴者用のコメント投稿インターフェース
- **管理・設定ページ**: 表示設定の調整とコメント管理

### バックエンド（FastAPI）
- **RESTful API**: インスタンス・コメント・設定の管理
- **リアルタイム通信**: Socket.IO によるリアルタイムコメント配信
- **Webhook対応**: 外部システムとの連携
- **マルチインスタンス**: 複数の配信で同時利用可能

## 技術スタック

### フロントエンド
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Socket.IO Client
- Axios

### バックエンド
- FastAPI
- Python Socket.IO
- Pydantic
- Uvicorn

## セットアップ

### 1. リポジトリのクローン
```bash
git clone <repository-url>
cd tsg-comment-app
```

### 2. フロントエンドのセットアップ
```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.local.example .env.local
# .env.local を編集してAPI URLを設定
```

### 3. バックエンドのセットアップ
```bash
cd backend

# Python仮想環境の作成
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係のインストール
pip install -r requirements.txt
```

## 起動方法

### バックエンドの起動
```bash
cd backend
source venv/bin/activate  # Windows: venv\Scripts\activate
python main.py
```
または
```bash
cd backend
./start.sh
```

### フロントエンドの起動
```bash
npm run dev
```

## 使用方法

### 1. インスタンスの作成
1. `http://localhost:3000` にアクセス
2. 「新しいインスタンスを作成」をクリック
3. インスタンス名を入力して作成

### 2. 配信での使用
1. 管理画面で表示設定を調整
2. 表示ページをOBS Studioのブラウザソースに設定
3. コメント投稿ページのURLを視聴者に共有

### 3. OBS Studioでの設定
1. ソース → ブラウザ を追加
2. URL: `http://localhost:3000/display/[インスタンスID]`
3. 幅: 800px、高さ: 600px（お好みで調整）
4. CSS でさらなるスタイル調整が可能

## API エンドポイント

### インスタンス
- `POST /instances/` - インスタンス作成
- `GET /instances/` - インスタンス一覧取得
- `GET /instances/{id}/` - インスタンス詳細取得

### コメント
- `POST /comments/` - コメント投稿
- `GET /comments/{instance_id}/` - コメント一覧取得
- `DELETE /comments/{instance_id}/{comment_id}/` - コメント削除

### 設定
- `GET /settings/{instance_id}/` - 設定取得
- `PUT /settings/{instance_id}/` - 設定更新

### Webhook
- `POST /webhook/{instance_id}/` - Webhook受信

## Socket.IO イベント

### クライアント → サーバー
- `join_instance` - インスタンスに参加

### サーバー → クライアント
- `new_comment` - 新しいコメント
- `initial_comments` - 初期コメント一覧
- `settings_updated` - 設定更新
- `comment_deleted` - コメント削除
- `webhook_received` - Webhook受信

## カスタマイズ

### 表示スタイルの変更
管理画面から以下の設定を調整できます：
- 背景色（グリーンバック、ブルーバック等）
- 文字色
- フォントサイズ
- 最大表示コメント数
- 自動スクロール
- タイムスタンプ表示

### Webhook連携
外部システムとの連携が可能です：
```javascript
// Webhook送信例
await fetch(`http://localhost:8000/webhook/${instanceId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ type: 'external_event', data: {} })
});
```

## トラブルシューティング

### 接続できない場合
1. バックエンドが起動していることを確認
2. ポート8000が使用されていないことを確認
3. ファイアウォール設定を確認

### コメントが表示されない場合
1. Socket.IO接続状態を確認
2. ブラウザの開発者ツールでエラーを確認
3. インスタンスIDが正しいことを確認

## ライセンス

MIT License

## 貢献

プルリクエストやイシューの報告をお待ちしています。
