from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime

from models.external_video import ExternalVideo
from utils.youtube_transcript import fetch_youtube_transcript


async def create_or_update_external_video(
    db: AsyncSession,
    video_id: str,
    title: str = None,
    description: str = None,
    published_at: str = None,
    channel_id: str = None,
    channel_title: str = None,
    thumbnail_url: str = None,
    tags: list = None,
    category_id: str = None,
    force_refetch_transcript: bool = False
) -> ExternalVideo:
    """
    ExternalVideoを作成または更新
    既存の場合、transcriptがなければ取得する
    """
    # 既存チェック
    result = await db.execute(
        select(ExternalVideo).where(ExternalVideo.video_id == video_id)
    )
    existing = result.scalar_one_or_none()
    
    # published_atの変換
    published_at_dt = None
    if published_at:
        try:
            published_at_dt = datetime.fromisoformat(published_at.replace('Z', '+00:00'))
        except:
            pass
    
    if existing:
        # 既存の場合、transcriptがなければ取得
        if not existing.yt_transcript or force_refetch_transcript:
            print(f"[CRUD] Fetching transcript for existing video: {video_id}")
            yt_transcript = fetch_youtube_transcript(video_id)
            existing.yt_transcript = yt_transcript
        
        # その他のフィールドも更新（Noneでなければ）
        if title is not None:
            existing.title = title
        if description is not None:
            existing.description = description
        if published_at_dt is not None:
            existing.published_at = published_at_dt
        if channel_id is not None:
            existing.channel_id = channel_id
        if channel_title is not None:
            existing.channel_title = channel_title
        if thumbnail_url is not None:
            existing.thumbnail_url = thumbnail_url
        if tags is not None:
            existing.tags = tags
        if category_id is not None:
            existing.category_id = category_id
        
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        # 新規作成
        print(f"[CRUD] Creating new ExternalVideo: {video_id}")
        print(f"[CRUD] About to call fetch_youtube_transcript for: {video_id}")
        yt_transcript = fetch_youtube_transcript(video_id)
        print(f"[CRUD] fetch_youtube_transcript returned: {yt_transcript[:100] if yt_transcript else 'None'}...")
        
        external_video = ExternalVideo(
            video_id=video_id,
            title=title,
            description=description,
            published_at=published_at_dt,
            channel_id=channel_id,
            channel_title=channel_title,
            thumbnail_url=thumbnail_url,
            tags=tags,
            category_id=category_id,
            yt_transcript=yt_transcript
        )
        
        db.add(external_video)
        print(f"[CRUD] About to commit...")
        try:
            await db.commit()
            print(f"[CRUD] Commit successful, about to refresh...")
        except Exception as e:
            print(f"[CRUD ERROR] Commit failed: {type(e).__name__}: {str(e)}")
            import traceback
            traceback.print_exc()
            raise
        await db.refresh(external_video)
        print(f"[CRUD] Refresh successful, returning...")
        return external_video
