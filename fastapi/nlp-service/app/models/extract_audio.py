import os
import subprocess
from pathlib import Path
from typing import Optional
import uuid

def extract_audio_from_youtube(youtube_url: str, output_dir: str = "/storage") -> str:
    """
    YouTubeのURLから音声ファイルを抽出して保存する
    
    Args:
        youtube_url: YouTubeのURL
        output_dir: 保存先ディレクトリ
    
    Returns:
        str: 保存されたファイルのパス
    
    Raises:
        Exception: 音声抽出に失敗した場合
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # ユニークなファイル名を生成
    file_id = str(uuid.uuid4())
    output_template = os.path.join(output_dir, f"{file_id}.%(ext)s")
    
    command = [
        "yt-dlp",
        "-x",
        "--audio-format", "wav",
        "-o", output_template,
        youtube_url
    ]
    
    try:
        result = subprocess.run(
            command, 
            check=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            text=True
        )
        
        # 実際に作成されたファイルパスを取得
        expected_file_path = os.path.join(output_dir, f"{file_id}.wav")
        
        if os.path.exists(expected_file_path):
            return expected_file_path
        else:
            raise Exception(f"Expected file not found: {expected_file_path}")
            
    except subprocess.CalledProcessError as e:
        raise Exception(f"Failed to extract audio: {e.stderr}")

def extract_audio_from_playlist(playlist_url: str, output_dir: str = "/storage") -> list[str]:
    """
    YouTubeプレイリストのURLから音声ファイルを抽出して保存する
    
    Args:
        playlist_url: YouTubeプレイリストのURL
        output_dir: 保存先ディレクトリ
    
    Returns:
        list[str]: 保存されたファイルのパスのリスト
    
    Raises:
        Exception: 音声抽出に失敗した場合
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # プレイリスト用のサブディレクトリを作成
    playlist_id = str(uuid.uuid4())
    playlist_dir = os.path.join(output_dir, f"playlist_{playlist_id}")
    os.makedirs(playlist_dir, exist_ok=True)
    
    output_template = os.path.join(playlist_dir, "%(title)s.%(ext)s")
    
    command = [
        "yt-dlp",
        "-x",
        "--audio-format", "wav",
        "-o", output_template,
        playlist_url
    ]
    
    try:
        result = subprocess.run(
            command, 
            check=True, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            text=True
        )
        
        # 作成されたファイルのリストを取得
        file_paths = []
        for file in os.listdir(playlist_dir):
            if file.endswith(".wav"):
                file_paths.append(os.path.join(playlist_dir, file))
        
        return file_paths
        
    except subprocess.CalledProcessError as e:
        raise Exception(f"Failed to extract audio from playlist: {e.stderr}")