from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from db import get_db
from cruds import external_video as external_video_crud

router = APIRouter()


class ExternalVideoCreate(BaseModel):
    """ExternalVideo作成リクエスト"""
    video_id: str
    title: Optional[str] = None
    description: Optional[str] = None
    published_at: Optional[str] = None
    channel_id: Optional[str] = None
    channel_title: Optional[str] = None
    thumbnail_url: Optional[str] = None
    tags: Optional[list] = None
    category_id: Optional[str] = None
    force_refetch_transcript: Optional[bool] = False


class ExternalVideoResponse(BaseModel):
    """ExternalVideoレスポンス"""
    video_id: str
    title: Optional[str]
    description: Optional[str]
    published_at: Optional[datetime]
    channel_id: Optional[str]
    channel_title: Optional[str]
    thumbnail_url: Optional[str]
    tags: Optional[list]
    category_id: Optional[str]
    has_transcript: bool
    created_at: datetime

    class Config:
        from_attributes = True


@router.post("/external-videos", response_model=ExternalVideoResponse)
async def create_external_video(
    video_data: ExternalVideoCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    ExternalVideoを作成または更新
    既存の場合、transcriptがなければ自動取得
    """
    try:
        external_video = await external_video_crud.create_or_update_external_video(
            db,
            video_id=video_data.video_id,
            title=video_data.title,
            description=video_data.description,
            published_at=video_data.published_at,
            channel_id=video_data.channel_id,
            channel_title=video_data.channel_title,
            thumbnail_url=video_data.thumbnail_url,
            tags=video_data.tags,
            category_id=video_data.category_id,
            force_refetch_transcript=video_data.force_refetch_transcript
        )
        
        return ExternalVideoResponse(
            video_id=external_video.video_id,
            title=external_video.title,
            description=external_video.description,
            published_at=external_video.published_at,
            channel_id=external_video.channel_id,
            channel_title=external_video.channel_title,
            thumbnail_url=external_video.thumbnail_url,
            tags=external_video.tags,
            category_id=external_video.category_id,
            has_transcript=external_video.yt_transcript is not None,
            created_at=external_video.created_at
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
