import { useRouter } from "next/router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "../../hooks/useSocket";
import { commentApi } from "../../lib/api";
import { DisplaySettings } from "../../types";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

// 環境変数を定義（useSocketフックとcommentApiで内部的に使用される）
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8000";

console.log("Display page using API:", API_URL, "Socket:", SOCKET_URL);

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

export default function DisplayPage() {
  const router = useRouter();
  const { id: instanceId } = router.query as { id: string };
  const [settings, setSettings] = useState<DisplaySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [localWidth, setLocalWidth] = useState(100);
  const [localOpacity, setLocalOpacity] = useState(30);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  const { comments, connected } = useSocket(instanceId);

  const loadSettings = useCallback(async () => {
    if (instanceId) {
      try {
        const data = await commentApi.getSettings(instanceId);
        setSettings(data);
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    }
  }, [instanceId]);

  // コメント履歴の初期ロードを確実にする
  const loadCommentsHistory = useCallback(async () => {
    if (instanceId && comments.length === 0) {
      try {
        const response = await fetch(`${API_URL}/comments/${instanceId}/`);
        if (response.ok) {
          const commentsData = await response.json();
          console.log(
            "Loaded comments history:",
            commentsData.length,
            "comments"
          );
        }
      } catch (error) {
        console.error("Failed to load comments history:", error);
      }
    }
  }, [instanceId, comments.length]);

  useEffect(() => {
    if (instanceId) {
      loadSettings();
      // Socket接続後少し待ってから履歴をロード
      const timer = setTimeout(() => {
        loadCommentsHistory();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [instanceId, loadSettings, loadCommentsHistory]);

  useEffect(() => {
    if (settings) {
      setLocalWidth(settings.comment_width || 100);
      setLocalOpacity(settings.background_opacity || 30);
    }
  }, [settings]);

  useEffect(() => {
    if (settings?.auto_scroll && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [comments, settings?.auto_scroll]);

  if (loading) {
    return (
      <div
        className="w-full h-screen flex items-center justify-center"
        style={{
          backgroundColor: settings?.background_color || "#00FF00",
          color: settings?.text_color || "#000000",
        }}
      >
        <div className="text-2xl">読み込み中...</div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-red-500 text-white">
        <div className="text-2xl">設定を読み込めませんでした</div>
      </div>
    );
  }

  const displayComments = comments.slice(-settings.max_comments);

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{
        backgroundColor: settings.background_color,
        color: settings.text_color,
        fontSize: `${settings.font_size}px`,
      }}
      onDoubleClick={() => setShowControls(!showControls)}
    >
      {/* コントロールパネル */}
      {showControls && (
        <div className="absolute top-4 left-4 z-20 bg-black/80 rounded-lg p-4 text-white min-w-80">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                コメント幅: {localWidth}%
              </label>
              <input
                type="range"
                min="30"
                max="100"
                value={localWidth}
                onChange={(e) => setLocalWidth(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                背景の不透明度: {localOpacity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={localOpacity}
                onChange={(e) => setLocalOpacity(Number(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="text-xs opacity-60">ダブルクリックで閉じる</div>
          </div>
        </div>
      )}

      {/* 接続状態インジケータ */}
      <div className="absolute top-4 right-4 z-10">
        <div
          className={`w-3 h-3 rounded-full ${
            connected ? "bg-green-400" : "bg-red-400"
          }`}
        />
      </div>

      {/* コメント表示エリア */}
      <div className="w-full h-full overflow-y-auto p-4 flex flex-col items-center">
        <div
          className="space-y-2"
          style={{
            width: `${settings.comment_width || 400}px`,
            maxWidth: "100%",
          }}
        >
          {displayComments.length === 0 ? (
            <div className="text-center mt-20 opacity-50">
              <div className="text-2xl mb-2">コメントを待っています...</div>
              <div className="text-sm">
                視聴者からのコメントがここに表示されます
              </div>
            </div>
          ) : (
            displayComments.map((comment) => (
              <div
                key={comment.id}
                className="p-3 rounded-lg shadow-sm border-l-4 backdrop-blur-sm"
                style={{
                  backgroundColor: `rgba(${hexToRgb(
                    settings.comment_background_color || settings.text_color
                  )}, ${localOpacity / 100})`,
                  borderLeftColor: settings.text_color,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm opacity-90">
                        {comment.author}
                      </span>
                      {settings.show_timestamp && (
                        <span className="text-xs opacity-60">
                          {formatDistanceToNow(new Date(comment.timestamp), {
                            addSuffix: true,
                            locale: ja,
                          })}
                        </span>
                      )}
                    </div>
                    <div className="leading-relaxed">{comment.content}</div>
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={commentsEndRef} />
        </div>
      </div>

      {/* 設定情報（デバッグ用、本番では非表示にする） */}
      {process.env.NODE_ENV === "development" && (
        <div className="absolute bottom-2 left-2 text-xs opacity-30">
          {instanceId} | {displayComments.length}/{settings.max_comments}{" "}
          comments
        </div>
      )}
    </div>
  );
}
