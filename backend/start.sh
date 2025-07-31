#!/bin/bash

# Python仮想環境の作成とアクティベート
python3 -m venv venv
source venv/bin/activate

# 依存関係のインストール
pip install -r requirements.txt

# サーバーの起動
python main.py
