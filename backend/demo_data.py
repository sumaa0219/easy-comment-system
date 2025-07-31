"""
デモデータを作成するスクリプト
"""

import asyncio
import aiohttp
import json
from datetime import datetime
import time

API_BASE_URL = "http://localhost:8000"

async def create_demo_instance():
    """デモ用インスタンスを作成"""
    async with aiohttp.ClientSession() as session:
        data = {
            "name": "デモ配信",
            "webhook_url": "https://example.com/webhook"
        }
        
        async with session.post(f"{API_BASE_URL}/instances/", json=data) as response:
            if response.status == 200:
                instance = await response.json()
                print(f"インスタンスを作成しました: {instance['id']}")
                return instance['id']
            else:
                print(f"インスタンス作成に失敗: {response.status}")
                return None

async def send_demo_comments(instance_id: str):
    """デモ用コメントを送信"""
    demo_comments = [
        {"author": "視聴者A", "content": "こんにちは！配信お疲れ様です"},
        {"author": "初見さん", "content": "初見です！よろしくお願いします"},
        {"author": "ファン", "content": "今日も楽しい配信をありがとうございます"},
        {"author": "通りすがり", "content": "面白そうですね"},
        {"author": "常連", "content": "いつも見てます！"},
        {"author": "質問者", "content": "これはどうやって作ったんですか？"},
        {"author": "感謝", "content": "ありがとうございます！"},
        {"author": "応援", "content": "頑張ってください！"},
        {"author": "興味深い", "content": "すごい機能ですね"},
        {"author": "配信者", "content": "皆さんコメントありがとうございます！"},
    ]
    
    async with aiohttp.ClientSession() as session:
        for i, comment_data in enumerate(demo_comments):
            comment_data["instance_id"] = instance_id
            
            async with session.post(f"{API_BASE_URL}/comments/", json=comment_data) as response:
                if response.status == 200:
                    comment = await response.json()
                    print(f"コメントを送信: {comment['author']} - {comment['content']}")
                else:
                    print(f"コメント送信に失敗: {response.status}")
            
            # 少し間隔を空けて送信
            await asyncio.sleep(2)

async def main():
    print("デモデータを作成中...")
    
    # インスタンス作成
    instance_id = await create_demo_instance()
    if not instance_id:
        return
    
    print(f"\n以下のURLでテストできます:")
    print(f"表示ページ: http://localhost:3000/display/{instance_id}")
    print(f"コメント投稿: http://localhost:3000/comment/{instance_id}")
    print(f"管理ページ: http://localhost:3000/admin/{instance_id}")
    
    print(f"\nデモコメントを送信中...")
    await send_demo_comments(instance_id)
    
    print("\nデモデータの作成が完了しました！")

if __name__ == "__main__":
    asyncio.run(main())
