import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useSocket } from "../../hooks/useSocket";
import { commentApi } from "../../lib/api";
import { Instance, CommentCreate } from "../../types";
import { formatDistanceToNow } from "date-fns";
import { ja } from "date-fns/locale";

export default function CommentPage() {
  const router = useRouter();
  const { id: instanceId } = router.query as { id: string };
  const [instance, setInstance] = useState<Instance | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    author: "",
    content: "",
  });

  const { comments, connected } = useSocket(instanceId);

  useEffect(() => {
    if (instanceId) {
      loadInstance();
    }
  }, [instanceId]);

  const loadInstance = async () => {
    if (instanceId) {
      try {
        const data = await commentApi.getInstance(instanceId);
        setInstance(data);
      } catch (error) {
        console.error("Failed to load instance:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instanceId || !formData.author.trim() || !formData.content.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const commentData: CommentCreate = {
        instance_id: instanceId,
        author: formData.author.trim(),
        content: formData.content.trim(),
      };

      await commentApi.createComment(commentData);
      setFormData({ ...formData, content: "" }); // 名前は保持、コメントはクリア
    } catch (error) {
      console.error("Failed to submit comment:", error);
      alert("コメントの投稿に失敗しました");
    } finally {
      setSubmitting(false);
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

  if (!instance) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            インスタンスが見つかりません
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {instance.name}
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
                <span>コメント数: {comments.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* コメント投稿フォーム */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              コメントを投稿
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  お名前
                </label>
                <input
                  type="text"
                  required
                  value={formData.author}
                  onChange={(e) =>
                    setFormData({ ...formData, author: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                  placeholder="匿名"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  コメント
                </label>
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none text-gray-900"
                  placeholder="コメントを入力してください..."
                  maxLength={500}
                />
                <div className="text-right text-xs text-gray-500 mt-1">
                  {formData.content.length}/500
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting || !connected}
                className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? "投稿中..." : "コメントを投稿"}
              </button>
            </form>
          </div>

          {/* 最近のコメント */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              最近のコメント
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  まだコメントがありません
                </div>
              ) : (
                comments
                  .slice(-10)
                  .reverse()
                  .map((comment) => (
                    <div
                      key={comment.id}
                      className="border-l-4 border-blue-400 pl-4 py-2"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-sm text-gray-800">
                          {comment.author}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(comment.timestamp), {
                            addSuffix: true,
                            locale: ja,
                          })}
                        </span>
                      </div>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {comment.content}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
