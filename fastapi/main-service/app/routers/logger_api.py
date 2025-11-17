from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from pathlib import Path
import json
from datetime import datetime
import pytz
from log_config import logger

router = APIRouter()

# Event logs directory
LOGS_DIR = Path("/app/event-logs")
LOGS_DIR.mkdir(parents=True, exist_ok=True)


# Define log event models
class TabSwitchEvent(BaseModel):
    """ユーザーがタブを切り替えたイベント"""
    tab: str  # 'home', 'baseline', 'ctrl'
    match_name: str


class PlaybackEvent(BaseModel):
    """音声再生ボタンまたはシークバー操作イベント"""
    event_type: str  # 'play', 'pause', 'seek'
    speech_index: int
    time: float  # シークされた秒数、または現在の再生位置


class GraphNodeClickEvent(BaseModel):
    """グラフのノードをクリックしたイベント"""
    node_id: int


class UserLog(BaseModel):
    """汎用ユーザーログレコード"""
    event_type: str  # 'tab_switch', 'playback', 'graph_node_click'
    timestamp: str  # ISO形式のタイムスタンプ（日本時間）
    data: dict  # イベント固有のデータ


def get_japan_time():
    """現在時刻を日本時間のISO形式で取得"""
    jst = pytz.timezone('Asia/Tokyo')
    return datetime.now(jst).isoformat()


@router.post("/logs/event")
async def log_event(log: UserLog):
    """
    ユーザーのイベントをログとして記録

    Args:
        log: UserLog モデル（event_type, timestamp, data を含む）

    Returns:
        Success message
    """
    try:
        # タイムスタンプが指定されていない場合は現在時刻を使用
        if not log.timestamp:
            log.timestamp = get_japan_time()

        # ログレコードを辞書に変換
        log_record = {
            "event_type": log.event_type,
            "timestamp": log.timestamp,
            "data": log.data
        }

        # イベントログファイルに追記（日付ごとのファイル）
        # ファイル名: event-logs_{YYYY-MM-DD}.jsonl（JSON Lines形式）
        date_str = log.timestamp.split('T')[0]  # YYYY-MM-DD
        log_file = LOGS_DIR / f"event-logs_{date_str}.jsonl"

        with open(log_file, "a", encoding="utf-8") as f:
            json.dump(log_record, f, ensure_ascii=False)
            f.write("\n")

        logger.info(f"User event logged: {log.event_type} at {log.timestamp}")

        return {
            "success": True,
            "message": "Event logged successfully",
            "timestamp": log.timestamp,
            "event_type": log.event_type
        }

    except Exception as e:
        logger.error(f"Failed to log event: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to log event: {str(e)}")


@router.post("/logs/tab-switch")
async def log_tab_switch(log: UserLog):
    """
    タブ切り替えイベントをログに記録

    Args:
        log: UserLog（汎用形式、data内に tab と match_name を含む）

    Returns:
        Success message
    """
    try:
        # タイムスタンプが指定されていない場合は現在時刻を使用
        if not log.timestamp:
            log.timestamp = get_japan_time()

        log_record = {
            "event_type": log.event_type,
            "timestamp": log.timestamp,
            "data": log.data
        }

        date_str = log.timestamp.split('T')[0]
        log_file = LOGS_DIR / f"event-logs_{date_str}.jsonl"

        with open(log_file, "a", encoding="utf-8") as f:
            json.dump(log_record, f, ensure_ascii=False)
            f.write("\n")

        logger.info(f"Tab switched to '{log.data.get('tab')}' (match: {log.data.get('match_name')})")

        return {
            "success": True,
            "message": "Tab switch logged",
            "timestamp": log.timestamp
        }

    except Exception as e:
        logger.error(f"Failed to log tab switch: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to log tab switch: {str(e)}")


@router.post("/logs/playback")
async def log_playback_event(log: UserLog):
    """
    音声再生・シークバー操作イベントをログに記録

    Args:
        log: UserLog（data内に action, speech_index, time_seconds を含む）

    Returns:
        Success message
    """
    try:
        # タイムスタンプが指定されていない場合は現在時刻を使用
        if not log.timestamp:
            log.timestamp = get_japan_time()

        log_record = {
            "event_type": log.event_type,
            "timestamp": log.timestamp,
            "data": log.data
        }

        date_str = log.timestamp.split('T')[0]
        log_file = LOGS_DIR / f"event-logs_{date_str}.jsonl"

        with open(log_file, "a", encoding="utf-8") as f:
            json.dump(log_record, f, ensure_ascii=False)
            f.write("\n")

        logger.info(f"Playback event: {log.data.get('action')} on speech {log.data.get('speech_index')} at {log.data.get('time_seconds')}s")

        return {
            "success": True,
            "message": "Playback event logged",
            "timestamp": log.timestamp
        }

    except Exception as e:
        logger.error(f"Failed to log playback event: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to log playback event: {str(e)}")


@router.post("/logs/graph-node-click")
async def log_graph_node_click(log: UserLog):
    """
    グラフのノードクリックイベントをログに記録

    Args:
        log: UserLog（data内に node_id を含む）

    Returns:
        Success message
    """
    try:
        # タイムスタンプが指定されていない場合は現在時刻を使用
        if not log.timestamp:
            log.timestamp = get_japan_time()

        log_record = {
            "event_type": log.event_type,
            "timestamp": log.timestamp,
            "data": log.data
        }

        date_str = log.timestamp.split('T')[0]
        log_file = LOGS_DIR / f"event-logs_{date_str}.jsonl"

        with open(log_file, "a", encoding="utf-8") as f:
            json.dump(log_record, f, ensure_ascii=False)
            f.write("\n")

        logger.info(f"Graph node clicked: {log.data.get('node_id')}")

        return {
            "success": True,
            "message": "Graph node click logged",
            "timestamp": log.timestamp
        }

    except Exception as e:
        logger.error(f"Failed to log graph node click: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to log graph node click: {str(e)}")


@router.get("/logs/list")
async def list_logs():
    """
    保存されているイベントログファイルの一覧を取得

    Returns:
        List of event log file names
    """
    try:
        log_files = sorted([f.name for f in LOGS_DIR.glob("event-logs_*.jsonl")], reverse=True)
        return {
            "success": True,
            "logs": log_files,
            "count": len(log_files)
        }

    except Exception as e:
        logger.error(f"Failed to list logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list logs: {str(e)}")


@router.get("/logs/view/{date}")
async def view_logs(date: str):
    """
    指定された日付のイベントログを取得（JSONL形式）

    Args:
        date: Date in YYYY-MM-DD format

    Returns:
        List of event log records
    """
    try:
        log_file = LOGS_DIR / f"event-logs_{date}.jsonl"

        if not log_file.exists():
            raise HTTPException(status_code=404, detail=f"Event log file not found for date: {date}")

        logs = []
        with open(log_file, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    try:
                        logs.append(json.loads(line))
                    except json.JSONDecodeError as e:
                        logger.warning(f"Failed to parse log line: {e}")

        return {
            "success": True,
            "date": date,
            "logs": logs,
            "count": len(logs)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to view logs: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to view logs: {str(e)}")
