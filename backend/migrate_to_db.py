#!/usr/bin/env python3
"""
Migration script to move data from JSON storage to PostgreSQL database.

Usage:
    # From project root with venv activated:
    python backend/migrate_to_db.py [--dry-run] [--backup]
    
    # Or using venv Python directly:
    venv/bin/python backend/migrate_to_db.py [--dry-run] [--backup]
"""

import json
import sys
import argparse
from pathlib import Path
from datetime import datetime
from typing import Dict, Any
import uuid

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Add project root to path for imports
project_root = backend_dir.parent
sys.path.insert(0, str(project_root))

from app.database import get_db, init_db
from app.database.models import (
    User, Paper as DBPaper, Concept as DBConcept, VideoGeneration,
    AnalysisStatusEnum, VideoStatusEnum
)
from app.models.paper import Paper as PydanticPaper
from app.core.config import settings

# PERSISTENCE_FILE is relative to backend directory
PERSISTENCE_FILE = backend_dir / "storage" / "papers_db.json"


def load_papers_from_json() -> Dict[str, PydanticPaper]:
    """Load papers from JSON file"""
    if not PERSISTENCE_FILE.exists():
        print(f"JSON file not found: {PERSISTENCE_FILE}")
        return {}
    
    papers = {}
    try:
        with open(PERSISTENCE_FILE, "r") as f:
            data = json.load(f)
        
        for paper_id, paper_data in data.items():
            # Convert datetime strings back to datetime objects
            if "upload_time" in paper_data and isinstance(paper_data["upload_time"], str):
                paper_data["upload_time"] = datetime.fromisoformat(paper_data["upload_time"])
            
            # Handle ConceptVideo datetime fields
            if "concept_videos" in paper_data:
                for concept_id, video_data in paper_data["concept_videos"].items():
                    if "created_at" in video_data and isinstance(video_data["created_at"], str):
                        video_data["created_at"] = datetime.fromisoformat(video_data["created_at"])
            
            # Handle backward compatibility
            if "user_id" not in paper_data:
                paper_data["user_id"] = None
            
            paper = PydanticPaper(**paper_data)
            papers[paper_id] = paper
        
        print(f"Loaded {len(papers)} papers from JSON")
        return papers
    except Exception as e:
        print(f"Error loading papers from JSON: {e}")
        import traceback
        traceback.print_exc()
        return {}


def get_or_create_user(db, user_id: str = None, email: str = None):
    """Get existing user or create a dev user for papers without user_id"""
    if user_id:
        try:
            user_uuid = uuid.UUID(user_id)
            user = db.query(User).filter(User.id == user_uuid).first()
            if user:
                return user
        except ValueError:
            pass
    
    # Create a dev user for papers without user_id
    dev_user_id = uuid.UUID("00000000-0000-0000-0000-000000000000")
    user = db.query(User).filter(User.id == dev_user_id).first()
    if not user:
        user = User(
            id=dev_user_id,
            email=email or "dev@localhost",
            google_id=None
        )
        db.add(user)
        db.flush()
        print(f"Created dev user: {user.id}")
    
    return user


def migrate_paper(db, pydantic_paper: PydanticPaper, user: User):
    """Migrate a single paper from Pydantic model to database"""
    try:
        paper_uuid = uuid.UUID(pydantic_paper.id)
        
        # Check if paper already exists
        existing = db.query(DBPaper).filter(DBPaper.id == paper_uuid).first()
        if existing:
            print(f"  Paper {pydantic_paper.id} already exists, skipping...")
            return existing
        
        # Create database paper
        db_paper = DBPaper(
            id=paper_uuid,
            user_id=user.id,
            title=pydantic_paper.title or "",
            authors=pydantic_paper.authors or [],
            abstract=pydantic_paper.abstract or "",
            filename=pydantic_paper.filename,
            file_path=pydantic_paper.file_path,
            upload_time=pydantic_paper.upload_time,
            analysis_status=AnalysisStatusEnum(pydantic_paper.analysis_status.value),
            video_status=VideoStatusEnum(pydantic_paper.video_status.value),
            content=pydantic_paper.content or "",
            full_analysis=pydantic_paper.full_analysis or "",
            methodology=pydantic_paper.methodology or "",
            insights=pydantic_paper.insights or [],
            video_path=pydantic_paper.video_path,
            clips_paths=pydantic_paper.clips_paths or []
        )
        db.add(db_paper)
        db.flush()
        
        # Migrate concepts
        for pydantic_concept in pydantic_paper.concepts:
            concept_uuid = uuid.UUID(pydantic_concept.id)
            db_concept = DBConcept(
                id=concept_uuid,
                paper_id=db_paper.id,
                name=pydantic_concept.name,
                description=pydantic_concept.description,
                importance_score=pydantic_concept.importance_score,
                concept_type=pydantic_concept.concept_type,
                page_numbers=pydantic_concept.page_numbers or [],
                text_snippets=pydantic_concept.text_snippets or [],
                related_concepts=pydantic_concept.related_concepts or []
            )
            db.add(db_concept)
            db.flush()
            
            # Migrate concept videos to VideoGeneration
            if pydantic_concept.id in pydantic_paper.concept_videos:
                concept_video = pydantic_paper.concept_videos[pydantic_concept.id]
                video_gen = VideoGeneration(
                    id=uuid.uuid4(),
                    user_id=user.id,
                    paper_id=db_paper.id,
                    concept_id=concept_uuid,
                    concept_name=concept_video.concept_name,
                    status=VideoStatusEnum(concept_video.status.value),
                    video_url=concept_video.video_path,
                    clips_paths=concept_video.clips_paths or [],
                    captions=concept_video.captions or [],
                    logs=concept_video.logs or [],
                    created_at=concept_video.created_at,
                    completed_at=datetime.now() if concept_video.status.value == "completed" else None
                )
                db.add(video_gen)
        
        print(f"  ✓ Migrated paper: {pydantic_paper.title or pydantic_paper.filename}")
        return db_paper
    
    except Exception as e:
        print(f"  ✗ Error migrating paper {pydantic_paper.id}: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return None


def migrate_all(dry_run: bool = False, backup: bool = True):
    """Migrate all papers from JSON to database"""
    print("=" * 60)
    print("JSON to Database Migration")
    print("=" * 60)
    
    if not settings.SUPABASE_DATABASE_URL:
        print("\n❌ ERROR: SUPABASE_DATABASE_URL not configured!")
        print("\nTo migrate to database, you need to:")
        print("1. Go to your Supabase project dashboard")
        print("2. Navigate to Settings → Database")
        print("3. Copy the Connection string (URI format)")
        print("4. Add it to your .env file:")
        print("   SUPABASE_DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT].supabase.co:5432/postgres")
        print("\nAlternatively, the app will continue using JSON storage if database is not configured.")
        return False
    
    # Check if database URL uses connection pooling (recommended)
    db_url = settings.SUPABASE_DATABASE_URL
    if "pooler.supabase.com" not in db_url and "db." in db_url:
        print("\n⚠️  NOTE: You're using the direct database URL.")
        print("   If connection fails, try using the connection pooling URL instead:")
        print("   - Go to Supabase Dashboard → Settings → Database")
        print("   - Use 'Connection pooling' → 'Session mode' URL")
        print("   - Format: postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres")
        print()
    
    # Initialize database
    print("\n1. Initializing database...")
    try:
        init_db()
        print("   ✓ Database initialized")
    except Exception as e:
        print(f"\n❌ ERROR: Failed to connect to database!")
        print(f"   Error: {e}")
        print("\nPlease check:")
        print("  1. SUPABASE_DATABASE_URL is correct in .env")
        print("  2. Your Supabase project is active (free tier databases pause after inactivity)")
        print("     → Go to Supabase Dashboard and wake up the database if needed")
        print("  3. Database is accessible from your network")
        print("  4. Try using the connection pooling URL instead:")
        print("     → Supabase Dashboard → Settings → Database → Connection pooling → Session mode")
        print("  5. Database tables exist (run schema.sql in Supabase SQL editor)")
        print(f"\n   Direct connection format:")
        print(f"   postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres")
        print(f"\n   Connection pooling format (recommended):")
        print(f"   postgresql://postgres.[PROJECT]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres")
        return False
    
    # Load papers from JSON
    print("\n2. Loading papers from JSON...")
    papers = load_papers_from_json()
    if not papers:
        print("   No papers to migrate")
        return True
    
    # Backup JSON file
    if backup and not dry_run:
        backup_path = PERSISTENCE_FILE.with_suffix(f".json.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
        import shutil
        shutil.copy2(PERSISTENCE_FILE, backup_path)
        print(f"\n3. Backed up JSON file to: {backup_path}")
    
    # Migrate papers
    print(f"\n4. Migrating {len(papers)} papers...")
    if dry_run:
        print("   [DRY RUN] Would migrate:")
        for paper_id, paper in papers.items():
            print(f"   - {paper.title or paper.filename} (user_id: {paper.user_id})")
        return True
    
    db = next(get_db())
    try:
        migrated_count = 0
        error_count = 0
        
        for paper_id, pydantic_paper in papers.items():
            print(f"\n  Migrating paper: {pydantic_paper.id}")
            
            # Get or create user
            user = get_or_create_user(
                db,
                user_id=pydantic_paper.user_id,
                email=f"migrated-{pydantic_paper.id}@localhost"
            )
            
            # Migrate paper
            result = migrate_paper(db, pydantic_paper, user)
            if result:
                migrated_count += 1
            else:
                error_count += 1
        
        # Commit all changes
        db.commit()
        print(f"\n5. Migration complete!")
        print(f"   ✓ Migrated: {migrated_count}")
        print(f"   ✗ Errors: {error_count}")
        
        return error_count == 0
    
    except Exception as e:
        print(f"\n✗ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate papers from JSON to database")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be migrated without actually doing it")
    parser.add_argument("--no-backup", action="store_true", help="Skip creating backup of JSON file")
    args = parser.parse_args()
    
    success = migrate_all(dry_run=args.dry_run, backup=not args.no_backup)
    sys.exit(0 if success else 1)

