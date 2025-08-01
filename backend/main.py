from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import socketio
import asyncio
import json
import uuid
from datetime import datetime
import logging
import os
import aiofiles
from pathlib import Path
import base64
import pytz

# ログ設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 日本時間のタイムゾーン
JST = pytz.timezone('Asia/Tokyo')

# データ保存ディレクトリ
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)

# Socket.IO サーバー設定
sio = socketio.AsyncServer(
    cors_allowed_origins="*",
    async_mode='asgi',
    logger=True,
    engineio_logger=True
)

# FastAPI アプリケーション
app = FastAPI(title="TSG Comment API", version="1.0.0")

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://easy-comment.clite.jp"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Socket.IO アプリケーション
socket_app = socketio.ASGIApp(sio, app)

# データストレージ（JSONファイルベース永続化）
class DataStore:
    def __init__(self):
        self.instances: Dict[str, Dict] = {}
        self.comments: Dict[str, List[Dict]] = {}
        self.settings: Dict[str, Dict] = {}
        self.load_data()
        
    def load_data(self):
        """データを読み込み"""
        try:
            # インスタンスデータを読み込み
            instances_file = DATA_DIR / "instances.json"
            if instances_file.exists():
                with open(instances_file, 'r', encoding='utf-8') as f:
                    self.instances = json.load(f)
            
            # コメントデータを読み込み
            comments_file = DATA_DIR / "comments.json"
            if comments_file.exists():
                with open(comments_file, 'r', encoding='utf-8') as f:
                    self.comments = json.load(f)
            
            # 設定データを読み込み
            settings_file = DATA_DIR / "settings.json"
            if settings_file.exists():
                with open(settings_file, 'r', encoding='utf-8') as f:
                    self.settings = json.load(f)
                    
            logger.info(f"データを読み込みました: インスタンス{len(self.instances)}個, コメント{sum(len(comments) for comments in self.comments.values())}個")
        except Exception as e:
            logger.error(f"データ読み込みエラー: {e}")
    
    def save_data(self):
        """データを保存"""
        try:
            # インスタンスデータを保存
            with open(DATA_DIR / "instances.json", 'w', encoding='utf-8') as f:
                json.dump(self.instances, f, ensure_ascii=False, indent=2)
            
            # コメントデータを保存
            with open(DATA_DIR / "comments.json", 'w', encoding='utf-8') as f:
                json.dump(self.comments, f, ensure_ascii=False, indent=2)
            
            # 設定データを保存
            with open(DATA_DIR / "settings.json", 'w', encoding='utf-8') as f:
                json.dump(self.settings, f, ensure_ascii=False, indent=2)
                
            logger.info("データを保存しました")
        except Exception as e:
            logger.error(f"データ保存エラー: {e}")
        
    def create_instance(self, instance_id: str, name: str, webhook_url: Optional[str] = None, admin_password: Optional[str] = None):
        self.instances[instance_id] = {
            "id": instance_id,
            "name": name,
            "webhook_url": webhook_url,
            "admin_password": admin_password,
            "created_at": datetime.now(JST).isoformat(),
            "active": True
        }
        self.comments[instance_id] = []
        self.settings[instance_id] = {
            "background_color": "#00FF00",
            "text_color": "#000000",
            "font_size": 16,
            "max_comments": 50,
            "auto_scroll": True,
            "show_timestamp": True,
            "moderation_enabled": False,
            "comment_width": 400,
            "comment_height": 120,
            "background_opacity": 30,
            "text_opacity": 100,
            "comment_background_color": "#FFFFFF",
            "lag_seconds": 0
        }
        self.save_data()

data_store = DataStore()

# Basic認証チェック関数
def check_admin_auth(instance_id: str, request: Request) -> bool:
    """管理画面のBasic認証をチェック"""
    if instance_id not in data_store.instances:
        return False
    
    instance = data_store.instances[instance_id]
    admin_password = instance.get("admin_password")
    
    # パスワードが設定されていない場合は認証不要
    if not admin_password:
        return True
    
    # Authorizationヘッダーを確認
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Basic "):
        return False
    
    try:
        # Base64デコード
        encoded_credentials = authorization.split(" ")[1]
        decoded_credentials = base64.b64decode(encoded_credentials).decode("utf-8")
        
        # ユーザー名:パスワードの形式をパース（ユーザー名は空でも可）
        if ":" in decoded_credentials:
            username, password = decoded_credentials.split(":", 1)
        else:
            # コロンがない場合はパスワードのみとして扱う
            password = decoded_credentials
        
        # パスワード確認（ユーザー名は無視）
        return password == admin_password
    except (ValueError, UnicodeDecodeError):
        return False

# Pydantic モデル
class CommentCreate(BaseModel):
    instance_id: str
    author: str
    content: str
    
class CommentResponse(BaseModel):
    id: str
    instance_id: str
    author: str
    content: str
    timestamp: str
    approved: bool = True
    hidden: bool = False

class InstanceCreate(BaseModel):
    name: str
    webhook_url: Optional[str] = None
    admin_password: Optional[str] = None

class InstanceResponse(BaseModel):
    id: str
    name: str
    webhook_url: Optional[str]
    admin_password: Optional[str]
    created_at: str
    active: bool

class DisplaySettings(BaseModel):
    background_color: str = "#00FF00"
    text_color: str = "#000000"
    font_size: int = 16
    max_comments: int = 50
    auto_scroll: bool = True
    show_timestamp: bool = True
    moderation_enabled: bool = False
    comment_width: int = 400  # ピクセル単位
    comment_height: int = 120  # ピクセル単位
    background_opacity: int = 30  # パーセンテージ
    text_opacity: int = 100  # パーセンテージ
    comment_background_color: str = "#FFFFFF"  # コメント背景色
    lag_seconds: int = 0  # コメント表示遅延秒数

# Socket.IO イベント
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_instance(sid, data):
    instance_id = data.get('instance_id')
    if instance_id in data_store.instances:
        try:
            await sio.enter_room(sid, instance_id)
            logger.info(f"Client {sid} joined instance {instance_id}")
            
            # 既存のコメントを送信（非表示でないもののみ）
            all_comments = data_store.comments.get(instance_id, [])
            visible_comments = [c for c in all_comments if not c.get('hidden', False)]
            logger.info(f"Sending {len(visible_comments)} initial comments to client {sid}")
            await sio.emit('initial_comments', {'comments': visible_comments}, room=sid)
            
            # 設定も送信
            settings = data_store.settings.get(instance_id, DisplaySettings().dict())
            await sio.emit('settings_updated', settings, room=sid)
            
        except Exception as e:
            logger.error(f"Error joining room: {e}")
            await sio.emit('error', {'message': 'Failed to join instance'}, room=sid)
    else:
        logger.warning(f"Instance {instance_id} not found for client {sid}")
        await sio.emit('error', {'message': 'Instance not found'}, room=sid)

@sio.event
async def join_admin_instance(sid, data):
    """管理者用のインスタンス参加（全コメントを送信）"""
    instance_id = data.get('instance_id')
    if instance_id in data_store.instances:
        try:
            await sio.enter_room(sid, f"admin_{instance_id}")
            logger.info(f"Admin client {sid} joined instance {instance_id}")
            
            # 管理者には全コメント（非表示も含む）を送信
            all_comments = data_store.comments.get(instance_id, [])
            logger.info(f"Sending {len(all_comments)} admin comments to client {sid}")
            await sio.emit('initial_admin_comments', {'comments': all_comments}, room=sid)
            
            # 設定も送信
            settings = data_store.settings.get(instance_id, DisplaySettings().dict())
            await sio.emit('settings_updated', settings, room=sid)
            
        except Exception as e:
            logger.error(f"Error joining admin room: {e}")
            await sio.emit('error', {'message': 'Failed to join admin instance'}, room=sid)
    else:
        logger.warning(f"Instance {instance_id} not found for admin client {sid}")
        await sio.emit('error', {'message': 'Instance not found'}, room=sid)

# API エンドポイント
@app.get("/")
async def root():
    return {"message": "TSG Comment API"}

@app.post("/instances/", response_model=InstanceResponse)
async def create_instance(instance: InstanceCreate):
    instance_id = str(uuid.uuid4())
    data_store.create_instance(instance_id, instance.name, instance.webhook_url, instance.admin_password)
    return data_store.instances[instance_id]

@app.get("/instances/", response_model=List[InstanceResponse])
async def get_instances():
    return list(data_store.instances.values())

@app.get("/instances/{instance_id}/", response_model=InstanceResponse)
async def get_instance(instance_id: str):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    return data_store.instances[instance_id]

@app.get("/admin/instance/{instance_id}/", response_model=InstanceResponse)
async def get_admin_instance(instance_id: str, request: Request):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Basic認証チェック
    if not check_admin_auth(instance_id, request):
        raise HTTPException(
            status_code=401, 
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"}
        )
    
    return data_store.instances[instance_id]

@app.get("/admin/auth/{instance_id}/")
async def check_admin_auth_endpoint(instance_id: str, request: Request):
    """管理者認証チェック用エンドポイント"""
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # パスワードが設定されていない場合は認証不要
    admin_password = data_store.instances[instance_id].get('admin_password')
    if not admin_password:
        return {"auth_required": False, "authenticated": True}
    
    # Basic認証チェック
    if not check_admin_auth(instance_id, request):
        raise HTTPException(
            status_code=401, 
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"}
        )
    
    return {"auth_required": True, "authenticated": True}

@app.delete("/instances/{instance_id}/")
async def delete_instance(instance_id: str):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # インスタンスデータを削除
    del data_store.instances[instance_id]
    
    # 関連するコメントを削除
    if instance_id in data_store.comments:
        del data_store.comments[instance_id]
    
    # 関連する設定を削除
    if instance_id in data_store.settings:
        del data_store.settings[instance_id]
    
    # データを永続化
    data_store.save_data()
    
    # Socket.IOルームからすべてのクライアントを削除
    await sio.emit('instance_deleted', {}, room=instance_id)
    
    return {"message": "Instance deleted successfully"}

@app.post("/comments/", response_model=CommentResponse)
async def create_comment(comment: CommentCreate):
    if comment.instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
        
    comment_id = str(uuid.uuid4())
    comment_data = {
        "id": comment_id,
        "instance_id": comment.instance_id,
        "author": comment.author,
        "content": comment.content,
        "timestamp": datetime.now(JST).isoformat(),
        "approved": True,
        "hidden": False
    }
    
    # コメントを保存（制限なし）
    data_store.comments[comment.instance_id].append(comment_data)
    
    # データを永続化
    data_store.save_data()
    
    # Socket.IO で新しいコメントを配信（一般ユーザー用と管理者用の両方）
    await sio.emit('new_comment', comment_data, room=comment.instance_id)
    await sio.emit('new_comment', comment_data, room=f"admin_{comment.instance_id}")
    
    # Webhook通知（設定されている場合）
    instance = data_store.instances[comment.instance_id]
    if instance.get('webhook_url'):
        # ここでWebhook通知を実装
        logger.info(f"Webhook notification would be sent to {instance['webhook_url']}")
    
    return comment_data

@app.get("/comments/{instance_id}/", response_model=List[CommentResponse])
async def get_comments(instance_id: str):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # 非表示でないコメントのみを返す
    all_comments = data_store.comments.get(instance_id, [])
    visible_comments = [c for c in all_comments if not c.get('hidden', False)]
    return visible_comments

@app.get("/admin/comments/{instance_id}/", response_model=List[CommentResponse])
async def get_admin_comments(instance_id: str, request: Request):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Basic認証チェック
    if not check_admin_auth(instance_id, request):
        raise HTTPException(
            status_code=401, 
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"}
        )
    
    # 管理者は全コメント（非表示も含む）を取得
    return data_store.comments.get(instance_id, [])

@app.put("/settings/{instance_id}/", response_model=DisplaySettings)
async def update_settings(instance_id: str, settings: DisplaySettings):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    data_store.settings[instance_id] = settings.dict()
    
    # データを永続化
    data_store.save_data()
    
    # Socket.IO で設定更新を配信
    await sio.emit('settings_updated', settings.dict(), room=instance_id)
    
    return settings

@app.get("/settings/{instance_id}/", response_model=DisplaySettings)
async def get_settings(instance_id: str):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    return data_store.settings.get(instance_id, DisplaySettings().dict())

@app.get("/admin/settings/{instance_id}/", response_model=DisplaySettings)
async def get_admin_settings(instance_id: str, request: Request):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Basic認証チェック
    if not check_admin_auth(instance_id, request):
        raise HTTPException(
            status_code=401, 
            detail="Unauthorized",
            headers={"WWW-Authenticate": "Basic"}
        )
    
    return data_store.settings.get(instance_id, DisplaySettings().dict())

@app.put("/comments/{instance_id}/{comment_id}/hide")
async def hide_comment(instance_id: str, comment_id: str):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    comments = data_store.comments.get(instance_id, [])
    comment_found = False
    
    for comment in comments:
        if comment['id'] == comment_id:
            comment['hidden'] = True
            comment_found = True
            break
    
    if not comment_found:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # データを永続化
    data_store.save_data()
    
    # Socket.IO で非表示を配信（一般ユーザー用と管理者用の両方）
    await sio.emit('comment_hidden', {'comment_id': comment_id}, room=instance_id)
    await sio.emit('comment_hidden', {'comment_id': comment_id}, room=f"admin_{instance_id}")
    
    return {"message": "Comment hidden"}

@app.put("/comments/{instance_id}/{comment_id}/show")
async def show_comment(instance_id: str, comment_id: str):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    comments = data_store.comments.get(instance_id, [])
    comment_found = False
    comment_data = None
    
    for comment in comments:
        if comment['id'] == comment_id:
            comment['hidden'] = False
            comment_found = True
            comment_data = comment
            break
    
    if not comment_found:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    # データを永続化
    data_store.save_data()
    
    # Socket.IO で表示復帰を配信（一般ユーザー用と管理者用の両方）
    await sio.emit('comment_shown', {
        'comment_id': comment_id, 
        'comment': comment_data
    }, room=instance_id)
    await sio.emit('comment_shown', {
        'comment_id': comment_id, 
        'comment': comment_data
    }, room=f"admin_{instance_id}")
    
    return {"message": "Comment shown"}

@app.post("/webhook/{instance_id}/")
async def webhook_endpoint(instance_id: str, data: Dict[str, Any]):
    """外部システムからのWebhook受信エンドポイント"""
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    # Webhookデータの処理
    logger.info(f"Webhook received for instance {instance_id}: {data}")
    
    # Socket.IO でWebhookデータを配信
    await sio.emit('webhook_received', data, room=instance_id)
    
    return {"status": "received"}

# エクスポート機能
@app.get("/export/{instance_id}/json")
async def export_comments_json(instance_id: str):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    comments = data_store.comments.get(instance_id, [])
    instance_data = {
        "instance_id": instance_id,
        "instance_name": data_store.instances[instance_id]["name"],
        "export_date": datetime.now(JST).isoformat(),
        "comments": comments
    }
    
    return JSONResponse(
        content=instance_data,
        headers={
            "Content-Disposition": f"attachment; filename=comments_{instance_id}.json"
        }
    )

@app.get("/export/{instance_id}/csv")
async def export_comments_csv(instance_id: str):
    if instance_id not in data_store.instances:
        raise HTTPException(status_code=404, detail="Instance not found")
    
    comments = data_store.comments.get(instance_id, [])
    
    # CSV形式のデータを作成
    csv_data = "ID,Author,Content,Timestamp\n"
    for comment in comments:
        # CSVエスケープ処理
        author = comment['author'].replace('"', '""')
        content = comment['content'].replace('"', '""')
        csv_data += f'"{comment["id"]}","{author}","{content}","{comment["timestamp"]}"\n'
    
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=comments_{instance_id}.csv"
        }
    )

if __name__ == "__main__":
    import uvicorn
    # Socket.IOアプリケーションとして起動
    uvicorn.run("main:socket_app", host="0.0.0.0", port=8880, reload=True)
