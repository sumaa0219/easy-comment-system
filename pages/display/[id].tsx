import { useRouter } from "next/router";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSocket } from "../../hooks/useSocket";
import { commentApi } from "../../lib/api";
import { DisplaySettings, Comment } from "../../types";

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
  const [localTextOpacity, setLocalTextOpacity] = useState(100);
  const [visibleComments, setVisibleComments] = useState<Comment[]>([]);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const lagTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const {
    comments,
    connected,
    settings: socketSettings,
  } = useSocket(instanceId);

  // socketから受信した設定を優先的に使用
  const currentSettings = socketSettings || settings;

  // コメントの遅延表示を管理
  useEffect(() => {
    if (!currentSettings?.lag_seconds || currentSettings.lag_seconds === 0) {
      // 遅延なしの場合は即座に表示
      setVisibleComments(comments);
      return;
    }

    const lagMs = currentSettings.lag_seconds * 1000;
    const lagTimers = lagTimerRef.current;

    // 新しいコメントをチェック
    comments.forEach((comment) => {
      // 既に表示済みまたはタイマー設定済みの場合はスキップ
      if (
        visibleComments.find((c) => c.id === comment.id) ||
        lagTimers.has(comment.id)
      ) {
        return;
      }

      const commentTime = new Date(comment.timestamp).getTime();
      const now = Date.now();
      const timeElapsed = now - commentTime;

      if (timeElapsed >= lagMs) {
        // 遅延時間が過ぎているので即座に表示
        setVisibleComments((prev) => [...prev, comment]);
      } else {
        // 残り時間後に表示
        const remainingTime = lagMs - timeElapsed;
        const timerId = setTimeout(() => {
          setVisibleComments((prev) => [...prev, comment]);
          lagTimers.delete(comment.id);
        }, remainingTime);

        lagTimers.set(comment.id, timerId);
      }
    });

    // クリーンアップ: 表示済みコメントに対応するタイマーを削除
    return () => {
      lagTimers.forEach((timerId) => clearTimeout(timerId));
      lagTimers.clear();
    };
  }, [comments, currentSettings?.lag_seconds, visibleComments]);

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
    if (currentSettings) {
      setLocalWidth(currentSettings.comment_width || 100);
      setLocalOpacity(currentSettings.background_opacity || 30);
      setLocalTextOpacity(currentSettings.text_opacity || 100);
    }
  }, [currentSettings]);

  useEffect(() => {
    if (currentSettings?.auto_scroll && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [visibleComments, currentSettings?.auto_scroll]);

  if (loading) {
    return (
      <div
        className="w-full h-screen flex items-center justify-center"
        style={{
          backgroundColor: currentSettings?.background_color || "#00FF00",
          color: currentSettings?.text_color || "#000000",
        }}
      >
        <div className="text-2xl">読み込み中...</div>
      </div>
    );
  }

  if (!currentSettings) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-red-500 text-white">
        <div className="text-2xl">設定を読み込めませんでした</div>
      </div>
    );
  }

  // displayページでのみ最大コメント数で制限（visibleCommentsを使用）
  const displayComments = visibleComments.slice(-currentSettings.max_comments);

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{
        backgroundColor: currentSettings.background_color,
        color: currentSettings.text_color,
        fontSize: `${currentSettings.font_size}px`,
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
                コメント背景の不透明度: {localOpacity}%
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
            <div>
              <label className="block text-sm font-medium mb-2">
                文字の不透明度: {localTextOpacity}%
              </label>
              <input
                type="range"
                min="10"
                max="100"
                value={localTextOpacity}
                onChange={(e) => setLocalTextOpacity(Number(e.target.value))}
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
            width: `${currentSettings.comment_width || 400}px`,
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
                    currentSettings.comment_background_color ||
                      currentSettings.text_color
                  )}, ${localOpacity / 100})`,
                  borderLeftColor: currentSettings.text_color,
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="font-bold text-sm"
                        style={{
                          color: `rgba(${hexToRgb(
                            currentSettings.text_color
                          )}, ${(localTextOpacity * 0.9) / 100})`,
                        }}
                      >
                        {comment.author}
                      </span>
                      {currentSettings.show_timestamp && (
                        <span
                          className="text-xs"
                          style={{
                            color: `rgba(${hexToRgb(
                              currentSettings.text_color
                            )}, ${(localTextOpacity * 0.6) / 100})`,
                          }}
                        >
                          {new Date(comment.timestamp).toLocaleString("ja-JP", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                    <div
                      className="leading-relaxed"
                      style={{
                        color: `rgba(${hexToRgb(currentSettings.text_color)}, ${
                          localTextOpacity / 100
                        })`,
                      }}
                    >
                      {comment.content}
                    </div>
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
          {instanceId} | {displayComments.length}/{currentSettings.max_comments}{" "}
          comments | lag: {currentSettings.lag_seconds}s
        </div>
      )}
    </div>
  );
}
