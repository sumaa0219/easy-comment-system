import { useState, useEffect } from "react";
import Link from "next/link";
import { commentApi } from "../lib/api";
import { Instance, InstanceCreate } from "../types";

// 環境変数を定義（commentAPIで内部的に使用される）
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

console.log("Home page using API:", API_URL);

export default function HomePage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formData, setFormData] = useState<InstanceCreate>({
    name: "",
    webhook_url: "",
    admin_password: "",
  });

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const data = await commentApi.getInstances();
      setInstances(data);
    } catch (error) {
      console.error("Failed to load instances:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInstance = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await commentApi.createInstance(formData);
      setFormData({ name: "", webhook_url: "", admin_password: "" });
      setShowCreateForm(false);
      await loadInstances();
    } catch (error) {
      console.error("Failed to create instance:", error);
      alert("インスタンスの作成に失敗しました");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInstance = async (
    instanceId: string,
    instanceName: string
  ) => {
    if (
      !confirm(
        `インスタンス "${instanceName}" を削除しますか？この操作は取り消せません。`
      )
    ) {
      return;
    }

    setDeleting(instanceId);
    try {
      await commentApi.deleteInstance(instanceId);
      await loadInstances();
      alert("インスタンスが削除されました");
    } catch (error) {
      console.error("Failed to delete instance:", error);
      alert("インスタンスの削除に失敗しました");
    } finally {
      setDeleting(null);
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            TSG コメントシステム
          </h1>
          <p className="text-gray-600">
            YouTube風のコメント機能を管理するシステムです
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-800">
              インスタンス一覧
            </h2>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              新しいインスタンスを作成
            </button>
          </div>

          {showCreateForm && (
            <div className="bg-gray-50 p-4 rounded-md mb-6">
              <form onSubmit={handleCreateInstance}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      インスタンス名
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="例: 配信用コメント"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Webhook URL（オプション）
                    </label>
                    <input
                      type="url"
                      value={formData.webhook_url}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          webhook_url: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="https://example.com/webhook"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      管理画面パスワード（オプション）
                    </label>
                    <input
                      type="password"
                      value={formData.admin_password}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          admin_password: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                      placeholder="管理画面のパスワードを設定"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      設定すると管理画面にBasic認証がかかります
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {creating ? "作成中..." : "作成"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="bg-gray-400 text-white px-4 py-2 rounded-md hover:bg-gray-500 transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          )}

          {instances.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">
                まだインスタンスが作成されていません
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
              >
                最初のインスタンスを作成
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instances.map((instance) => (
                <div
                  key={instance.id}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <h3 className="font-semibold text-gray-800 mb-2">
                    {instance.name}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    作成日:{" "}
                    {new Date(instance.created_at).toLocaleString("ja-JP")}
                  </p>
                  <div className="space-y-2">
                    <Link
                      href={`/display/${instance.id}`}
                      className="block w-full bg-green-600 text-white text-center py-2 rounded-md hover:bg-green-700 transition-colors text-sm"
                    >
                      表示ページ（OBS用）
                    </Link>
                    <Link
                      href={`/comment/${instance.id}`}
                      className="block w-full bg-blue-600 text-white text-center py-2 rounded-md hover:bg-blue-700 transition-colors text-sm"
                    >
                      コメント投稿ページ
                    </Link>
                    <Link
                      href={`/admin/${instance.id}`}
                      className="block w-full bg-purple-600 text-white text-center py-2 rounded-md hover:bg-purple-700 transition-colors text-sm"
                    >
                      管理・設定ページ
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
