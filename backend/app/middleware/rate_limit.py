"""
Rate limiting middleware for per-user video generation limits
"""

from datetime import datetime, date
from fastapi import HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db, VideoGeneration, User
from ..core.auth import get_current_user


# Configuration
DAILY_VIDEO_LIMIT = 5  # Free tier: 5 videos per day
MAX_CONCURRENT_GENERATIONS = 3  # Max 3 videos generating at once per user


async def check_daily_video_limit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Check if user has exceeded daily video generation limit.

    Raises:
        HTTPException: 429 if limit exceeded
    """
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    # Count videos generated today
    count = db.query(func.count(VideoGeneration.id))\
        .filter(VideoGeneration.user_id == current_user.id)\
        .filter(VideoGeneration.created_at >= today_start)\
        .scalar()

    if count >= DAILY_VIDEO_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {DAILY_VIDEO_LIMIT} video generations reached. Try again tomorrow."
        )


async def check_concurrent_video_limit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> None:
    """
    Check if user has too many videos currently generating.

    Raises:
        HTTPException: 429 if too many concurrent generations
    """
    from ..models.paper import VideoStatus

    # Count currently generating videos
    count = db.query(func.count(VideoGeneration.id))\
        .filter(VideoGeneration.user_id == current_user.id)\
        .filter(VideoGeneration.status == VideoStatus.GENERATING.value)\
        .scalar()

    if count >= MAX_CONCURRENT_GENERATIONS:
        raise HTTPException(
            status_code=429,
            detail=f"You have {MAX_CONCURRENT_GENERATIONS} videos currently generating. Please wait for one to complete."
        )


async def get_remaining_daily_videos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> int:
    """
    Get number of remaining video generations for today.

    Returns:
        int: Number of videos left (0 to DAILY_VIDEO_LIMIT)
    """
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    count = db.query(func.count(VideoGeneration.id))\
        .filter(VideoGeneration.user_id == current_user.id)\
        .filter(VideoGeneration.created_at >= today_start)\
        .scalar()

    remaining = max(0, DAILY_VIDEO_LIMIT - count)
    return remaining


async def get_user_usage_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> dict:
    """
    Get comprehensive usage statistics for the current user.

    Returns:
        dict: Usage stats including today's count, total count, etc.
    """
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())

    # Today's count
    today_count = db.query(func.count(VideoGeneration.id))\
        .filter(VideoGeneration.user_id == current_user.id)\
        .filter(VideoGeneration.created_at >= today_start)\
        .scalar()

    # Total count
    total_count = db.query(func.count(VideoGeneration.id))\
        .filter(VideoGeneration.user_id == current_user.id)\
        .scalar()

    # Currently generating
    from ..models.paper import VideoStatus
    generating_count = db.query(func.count(VideoGeneration.id))\
        .filter(VideoGeneration.user_id == current_user.id)\
        .filter(VideoGeneration.status == VideoStatus.GENERATING.value)\
        .scalar()

    # Completed videos
    completed_count = db.query(func.count(VideoGeneration.id))\
        .filter(VideoGeneration.user_id == current_user.id)\
        .filter(VideoGeneration.status == VideoStatus.COMPLETED.value)\
        .scalar()

    return {
        "daily_limit": DAILY_VIDEO_LIMIT,
        "today_count": today_count,
        "remaining_today": max(0, DAILY_VIDEO_LIMIT - today_count),
        "total_videos_generated": total_count,
        "currently_generating": generating_count,
        "max_concurrent": MAX_CONCURRENT_GENERATIONS,
        "completed_videos": completed_count
    }
