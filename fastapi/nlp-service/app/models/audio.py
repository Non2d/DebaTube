import os
import subprocess
from pathlib import Path
from typing import Optional
import uuid
import shutil

def extract_audio_from_youtube(youtube_url: str, output_dir: str = "storage") -> str:
    """
    YouTubeのURLから音声ファイルを抽出して保存する（mp3とwav両方）
    
    Args:
        youtube_url: YouTubeのURL
        output_dir: 保存先ディレクトリ
    
    Returns:
        str: 保存されたwavファイルのパス
    
    Raises:
        Exception: 音声抽出に失敗した場合
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # ユニークなファイル名を生成
    file_id = str(uuid.uuid4())
    
    # mp3とwav両方を作成
    formats = ["mp3", "wav"]
    created_files = []
    
    for audio_format in formats:
        output_template = os.path.join(output_dir, f"{file_id}.%(ext)s")
        
        command = [
            "yt-dlp",
            "-x",
            "--audio-format", audio_format,
            "--cookies", "storage/cookies.txt",
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
            
            expected_file_path = os.path.join(output_dir, f"{file_id}.{audio_format}")
            
            if os.path.exists(expected_file_path):
                created_files.append(expected_file_path)
            else:
                print(f"Warning: Expected file not found: {expected_file_path}")
                
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to create {audio_format} file: {e.stderr}")
    
    # wavファイルのパスを返す（メイン処理用）
    wav_file = os.path.join(output_dir, f"{file_id}.wav")
    if os.path.exists(wav_file):
        return wav_file
    elif created_files:
        # wavが失敗した場合は作成できたファイルを返す
        return created_files[0]
    else:
        raise Exception(f"Failed to create any audio files for {youtube_url}")

def extract_audio_from_playlist(playlist_url: str, output_dir: str = "storage") -> list[str]:
    """
    YouTubeプレイリストのURLから音声ファイルを抽出して保存する（mp3とwav両方）
    
    Args:
        playlist_url: YouTubeプレイリストのURL
        output_dir: 保存先ディレクトリ
    
    Returns:
        list[str]: 保存されたwavファイルのパスのリスト
    
    Raises:
        Exception: 音声抽出に失敗した場合
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # プレイリスト用のサブディレクトリを作成
    playlist_id = str(uuid.uuid4())
    playlist_dir = os.path.join(output_dir, f"playlist_{playlist_id}")
    os.makedirs(playlist_dir, exist_ok=True)
    
    # mp3とwav両方を作成
    formats = ["mp3", "wav"]
    wav_files = []
    
    for audio_format in formats:
        output_template = os.path.join(playlist_dir, f"%(title)s.{audio_format}")
        
        command = [
            "yt-dlp",
            "-x",
            "--audio-format", audio_format,
            "--cookies", "storage/cookies.txt",
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
            
            # wavファイルのリストを収集（メイン処理用）
            if audio_format == "wav":
                for file in os.listdir(playlist_dir):
                    if file.endswith(".wav"):
                        wav_files.append(os.path.join(playlist_dir, file))
            
        except subprocess.CalledProcessError as e:
            print(f"Warning: Failed to create {audio_format} files from playlist: {e.stderr}")
    
    if not wav_files:
        raise Exception(f"Failed to create any wav files from playlist: {playlist_url}")
    
    return wav_files

def save_uploaded_audio(file_content: bytes, original_filename: str, output_dir: str = "storage") -> str:
    """
    アップロードされた音声ファイルを保存する
    
    Args:
        file_content: ファイルの内容（バイト）
        original_filename: 元のファイル名
        output_dir: 保存先ディレクトリ
    
    Returns:
        str: 保存されたファイルのパス
    
    Raises:
        Exception: ファイル保存に失敗した場合
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 元のファイルの拡張子を取得
    file_extension = Path(original_filename).suffix
    if not file_extension:
        file_extension = ".wav"  # デフォルト拡張子
    
    # ユニークなファイル名を生成
    file_id = str(uuid.uuid4())
    file_path = os.path.join(output_dir, f"{file_id}{file_extension}")
    
    try:
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        return file_path
    except Exception as e:
        raise Exception(f"Failed to save uploaded audio file: {str(e)}")