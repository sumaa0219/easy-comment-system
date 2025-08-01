import { useRouter } from "next/router";
import { useState } from "react";
import { useAdminSocket } from "../../hooks/useAdminSocket";
import { commentApi } from "../../lib/api";
import { Instance, DisplaySettings } from "../../types";
import { GetServerSideProps } from "next";

// 環境変数を定義（useSocketフックとcommentAPIで内部的に使用される）
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8000";

console.log("Admin page using API:", API_URL, "Socket:", SOCKET_URL);

// ヘルパー関数：HEXカラーをRGBに変換
const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(
        result[3],
        16
      )}`
    : "0, 0, 0";
};

const COLOR_PRESETS = [
  { name: "グリーンバック", bg: "#00FF00", text: "#000000" },
  { name: "ブルーバック", bg: "#0000FF", text: "#FFFFFF" },
  { name: "ブラック", bg: "#000000", text: "#FFFFFF" },
  { name: "ホワイト", bg: "#FFFFFF", text: "#000000" },
  { name: "ダークグレー", bg: "#2D3748", text: "#FFFFFF" },
  { name: "ライトグレー", bg: "#F7FAFC", text: "#1A202C" },
];

interface AdminPageProps {
  instanceId: string;
  instanceData: Instance;
  settingsData: DisplaySettings;
}

export default function AdminPage({
  instanceId: propInstanceId,
  instanceData,
  settingsData,
}: AdminPageProps) {
  const router = useRouter();
  const { id: routerInstanceId } = router.query as { id: string };
  const instanceId = propInstanceId || routerInstanceId;
  const instance = instanceData;
  const [settings, setSettings] = useState<DisplaySettings | null>(
    settingsData
  );
  const loading = false; // サーバーサイドで取得済み
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "settings" | "comments" | "export" | "stats"
  >("settings");

  const { allComments, connected } = useAdminSocket(instanceId);

  const handleSaveSettings = async () => {
    if (!instanceId || !settings) return;

    setSaving(true);
    try {
      await commentApi.updateSettings(instanceId, settings);
      alert("設定が保存されました");
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("設定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  const handleHideComment = async (commentId: string) => {
    if (!instanceId || !confirm("このコメントを非表示にしますか？")) return;

    try {
      await commentApi.hideComment(instanceId, commentId);
    } catch (error) {
      console.error("Failed to hide comment:", error);
      alert("コメントの非表示に失敗しました");
    }
  };

  const handleShowComment = async (commentId: string) => {
    if (!instanceId || !confirm("このコメントを表示に戻しますか？")) return;

    try {
      await commentApi.showComment(instanceId, commentId);
    } catch (error) {
      console.error("Failed to show comment:", error);
      alert("コメントの表示復帰に失敗しました");
    }
  };

  const handleDeleteInstance = async () => {
    if (!instanceId || !instance) return;

    if (
      !confirm(
        `インスタンス「${instance.name}」を削除しますか？この操作は取り消せません。`
      )
    ) {
      return;
    }

    try {
      await commentApi.deleteInstance(instanceId);
      alert("インスタンスが削除されました");
      router.push("/");
    } catch (error) {
      console.error("Failed to delete instance:", error);
      alert("インスタンスの削除に失敗しました");
    }
  };

  const handleColorPreset = (preset: (typeof COLOR_PRESETS)[0]) => {
    if (settings) {
      setSettings({
        ...settings,
        background_color: preset.bg,
        text_color: preset.text,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!instance || !settings) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            データの読み込みに失敗しました
          </h1>
          <button
            onClick={() => router.push("/")}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {instance.name} - 管理画面
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span
                  className={`flex items-center gap-1 ${
                    connected ? "text-green-600" : "text-red-600"
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      connected ? "bg-green-400" : "bg-red-400"
                    }`}
                  />
                  {connected ? "接続中" : "切断済み"}
                </span>
                <span>ID: {instanceId}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.open(`/display/${instanceId}`, "_blank")}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                表示ページを開く
              </button>
              <button
                onClick={() => router.push("/")}
                className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors"
              >
                ホームに戻る
              </button>
              <button
                onClick={() => handleDeleteInstance()}
                className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
              >
                インスタンスを削除
              </button>
            </div>
          </div>
        </div>

        {/* タブナビゲーション */}
        <div className="bg-white rounded-lg shadow-md mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex">
              {[
                { key: "settings", label: "表示設定" },
                { key: "comments", label: "コメント管理" },
                { key: "export", label: "エクスポート" },
                { key: "stats", label: "統計情報" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* 表示設定タブ */}
            {activeTab === "settings" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* 色設定 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      色設定
                    </h3>

                    {/* プリセット */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        カラープリセット
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => handleColorPreset(preset)}
                            className="flex items-center gap-2 p-2 border rounded-md hover:bg-gray-50 text-left"
                          >
                            <div
                              className="w-6 h-6 rounded border border-gray-300"
                              style={{ backgroundColor: preset.bg }}
                            />
                            <span className="text-sm text-black">
                              {preset.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* カスタム色 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          背景色
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={settings.background_color}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                background_color: e.target.value,
                              })
                            }
                            className="w-12 h-10 rounded border border-gray-300"
                          />
                          <input
                            type="text"
                            value={settings.background_color}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                background_color: e.target.value,
                              })
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          文字色
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={settings.text_color}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                text_color: e.target.value,
                              })
                            }
                            className="w-12 h-10 rounded border border-gray-300"
                          />
                          <input
                            type="text"
                            value={settings.text_color}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                text_color: e.target.value,
                              })
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          コメント背景色
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={
                              settings.comment_background_color || "#FFFFFF"
                            }
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                comment_background_color: e.target.value,
                              })
                            }
                            className="w-12 h-10 rounded border border-gray-300"
                          />
                          <input
                            type="text"
                            value={
                              settings.comment_background_color || "#FFFFFF"
                            }
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                comment_background_color: e.target.value,
                              })
                            }
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* その他の設定 */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      表示設定
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          フォントサイズ: {settings.font_size}px
                        </label>
                        <input
                          type="range"
                          min="12"
                          max="48"
                          value={settings.font_size}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              font_size: parseInt(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          コメントの幅: {settings.comment_width || 400}px
                        </label>
                        <input
                          type="range"
                          min="200"
                          max="800"
                          value={settings.comment_width || 400}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              comment_width: parseInt(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          コメント背景の不透明度:{" "}
                          {settings.background_opacity || 30}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={settings.background_opacity || 30}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              background_opacity: parseInt(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          文字の不透明度: {settings.text_opacity || 100}%
                        </label>
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={settings.text_opacity || 100}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              text_opacity: parseInt(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          最大表示コメント数: {settings.max_comments}
                        </label>
                        <input
                          type="range"
                          min="1"
                          max="100"
                          value={settings.max_comments}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              max_comments: parseInt(e.target.value),
                            })
                          }
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center text-black">
                          <input
                            type="checkbox"
                            checked={settings.auto_scroll}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                auto_scroll: e.target.checked,
                              })
                            }
                            className="mr-2"
                          />
                          自動スクロール
                        </label>
                        <label className="flex items-center text-black">
                          <input
                            type="checkbox"
                            checked={settings.show_timestamp}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                show_timestamp: e.target.checked,
                              })
                            }
                            className="mr-2"
                          />
                          タイムスタンプ表示
                        </label>
                        <label className="flex items-center text-black">
                          <input
                            type="checkbox"
                            checked={settings.moderation_enabled}
                            onChange={(e) =>
                              setSettings({
                                ...settings,
                                moderation_enabled: e.target.checked,
                              })
                            }
                            className="mr-2"
                          />
                          モデレーション機能
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* プレビュー */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    プレビュー
                  </h3>
                  <div
                    className="border rounded-lg p-4 h-32 overflow-y-auto"
                    style={{
                      backgroundColor: settings.background_color,
                      color: settings.text_color,
                      fontSize: `${settings.font_size}px`,
                    }}
                  >
                    <div className="space-y-2">
                      <div
                        className="p-2 rounded border-l-4"
                        style={{
                          backgroundColor: `rgba(${hexToRgb(
                            settings.comment_background_color ||
                              settings.text_color
                          )}, ${(settings.background_opacity || 30) / 100})`,
                          borderLeftColor: settings.text_color,
                          width: `${settings.comment_width || 400}px`,
                          maxWidth: "100%",
                          color: `rgba(${hexToRgb(settings.text_color)}, ${
                            (settings.text_opacity || 100) / 100
                          })`,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="font-bold text-sm"
                            style={{
                              color: `rgba(${hexToRgb(settings.text_color)}, ${
                                (settings.text_opacity || 100) / 100
                              })`,
                            }}
                          >
                            サンプルユーザー
                          </span>
                          {settings.show_timestamp && (
                            <span
                              className="text-xs"
                              style={{
                                color: `rgba(${hexToRgb(
                                  settings.text_color
                                )}, ${
                                  ((settings.text_opacity || 100) * 0.6) / 100
                                })`,
                              }}
                            >
                              1分前
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            color: `rgba(${hexToRgb(settings.text_color)}, ${
                              (settings.text_opacity || 100) / 100
                            })`,
                          }}
                        >
                          これはプレビュー用のサンプルコメントです。
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={handleSaveSettings}
                    disabled={saving}
                    className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                  >
                    {saving ? "保存中..." : "設定を保存"}
                  </button>
                </div>
              </div>
            )}

            {/* コメント管理タブ */}
            {activeTab === "comments" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">
                    コメント一覧 ({allComments.length}件)
                  </h3>
                </div>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {allComments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      まだコメントがありません
                    </div>
                  ) : (
                    allComments
                      .slice()
                      .reverse()
                      .map((comment) => (
                        <div
                          key={comment.id}
                          className={`border rounded-lg p-4 flex items-start justify-between ${
                            comment.hidden ? "bg-gray-100 opacity-60" : ""
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold text-gray-800">
                                {comment.author}
                              </span>
                              {comment.hidden && (
                                <span className="bg-gray-500 text-white text-xs px-2 py-1 rounded">
                                  非表示
                                </span>
                              )}
                              <span className="text-xs text-gray-500">
                                {new Date(comment.timestamp).toLocaleString(
                                  "ja-JP",
                                  {
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </span>
                            </div>
                            <p className="text-gray-700">{comment.content}</p>
                          </div>
                          <div className="ml-4 flex gap-2">
                            {comment.hidden ? (
                              <button
                                onClick={() => handleShowComment(comment.id)}
                                className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600 transition-colors"
                              >
                                表示
                              </button>
                            ) : (
                              <button
                                onClick={() => handleHideComment(comment.id)}
                                className="bg-orange-500 text-white px-3 py-1 rounded text-sm hover:bg-orange-600 transition-colors"
                              >
                                非表示
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* エクスポートタブ */}
            {activeTab === "export" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    データエクスポート
                  </h3>
                  <p className="text-gray-600 mb-6">
                    コメントデータを異なる形式でダウンロードできます。
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* JSON エクスポート */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                      <div className="flex items-center mb-4">
                        <div className="bg-blue-100 p-2 rounded-lg mr-3">
                          📋
                        </div>
                        <div>
                          <h4 className="font-semibold text-blue-900">
                            JSON形式
                          </h4>
                          <p className="text-sm text-blue-700">
                            構造化データとして保存
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        プログラムでの処理に適した形式です。コメントのメタデータも含まれます。
                      </p>
                      <button
                        onClick={() => {
                          const url = commentApi.exportCommentsJson(instanceId);
                          window.open(url, "_blank");
                        }}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                      >
                        JSONでダウンロード
                      </button>
                    </div>

                    {/* CSV エクスポート */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <div className="flex items-center mb-4">
                        <div className="bg-green-100 p-2 rounded-lg mr-3">
                          📊
                        </div>
                        <div>
                          <h4 className="font-semibold text-green-900">
                            CSV形式
                          </h4>
                          <p className="text-sm text-green-700">
                            表計算ソフト対応
                          </p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-4">
                        Excel等の表計算ソフトで開けます。データ分析に便利です。
                      </p>
                      <button
                        onClick={() => {
                          const url = commentApi.exportCommentsCsv(instanceId);
                          window.open(url, "_blank");
                        }}
                        className="w-full bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
                      >
                        CSVでダウンロード
                      </button>
                    </div>
                  </div>

                  {/* エクスポート情報 */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
                    <h5 className="font-semibold text-gray-800 mb-2">
                      エクスポート情報
                    </h5>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• 現在の総コメント数: {allComments.length}件</li>
                      <li>• エクスポートにはすべてのコメントが含まれます</li>
                      <li>
                        • データには投稿者名、内容、タイムスタンプが含まれます
                      </li>
                      <li>• ファイル名には実行日時が含まれます</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* 統計情報タブ */}
            {activeTab === "stats" && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  統計情報
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {allComments.length}
                    </div>
                    <div className="text-sm text-gray-600">総コメント数</div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {
                        allComments.filter(
                          (c) =>
                            new Date(c.timestamp) >
                            new Date(Date.now() - 24 * 60 * 60 * 1000)
                        ).length
                      }
                    </div>
                    <div className="text-sm text-gray-600">
                      過去24時間のコメント
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {connected ? "オンライン" : "オフライン"}
                    </div>
                    <div className="text-sm text-gray-600">接続状態</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { id } = context.params!;
  const { req, res } = context;

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  try {
    // インスタンス情報を取得
    const response = await fetch(`${API_BASE_URL}/instances/${id}/`);
    if (!response.ok) {
      return {
        notFound: true,
      };
    }

    const instance = await response.json();

    // パスワードが設定されている場合、Basic認証をチェック
    if (instance.admin_password) {
      const authorization = req.headers.authorization;

      if (!authorization || !authorization.startsWith("Basic ")) {
        // Basic認証を要求
        res.setHeader("WWW-Authenticate", 'Basic realm="Admin Area"');
        res.statusCode = 401;
        res.end("Authentication required");
        return {
          props: {},
        };
      }

      try {
        const encoded = authorization.split(" ")[1];
        const decoded = Buffer.from(encoded, "base64").toString("utf-8");

        // ユーザー名:パスワードの形式をパース（ユーザー名は空でも可）
        let password: string;
        if (decoded.includes(":")) {
          const parts = decoded.split(":", 2);
          password = parts[1]; // ユーザー名は無視してパスワードのみ使用
        } else {
          password = decoded; // コロンがない場合はパスワードのみとして扱う
        }

        if (password !== instance.admin_password) {
          res.setHeader("WWW-Authenticate", 'Basic realm="Admin Area"');
          res.statusCode = 401;
          res.end("Invalid credentials");
          return {
            props: {},
          };
        }
      } catch (error) {
        console.error("Failed to parse authorization header:", error);
        res.setHeader("WWW-Authenticate", 'Basic realm="Admin Area"');
        res.statusCode = 401;
        res.end("Invalid authorization header");
        return {
          props: {},
        };
      }
    }

    // 認証に成功した場合、設定データも取得
    let settingsData;
    try {
      const settingsResponse = await fetch(`${API_BASE_URL}/settings/${id}/`);
      if (settingsResponse.ok) {
        settingsData = await settingsResponse.json();
      } else {
        // デフォルト設定を使用
        settingsData = {
          background_color: "#00FF00",
          text_color: "#000000",
          font_size: 16,
          max_comments: 50,
          auto_scroll: true,
          show_timestamp: true,
          moderation_enabled: false,
          comment_width: 400,
          background_opacity: 30,
          text_opacity: 100,
          comment_background_color: "#FFFFFF",
        };
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
      settingsData = {
        background_color: "#00FF00",
        text_color: "#000000",
        font_size: 16,
        max_comments: 50,
        auto_scroll: true,
        show_timestamp: true,
        moderation_enabled: false,
        comment_width: 400,
        background_opacity: 30,
        text_opacity: 100,
        comment_background_color: "#FFFFFF",
      };
    }

    return {
      props: {
        instanceId: id,
        instanceData: instance,
        settingsData: settingsData,
      },
    };
  } catch (error) {
    console.error("Failed to check authentication:", error);
    return {
      notFound: true,
    };
  }
};
