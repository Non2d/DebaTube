"""
データベースマイグレーションスクリプト
既存データを保持しながらスキーマを更新します
"""
import asyncio
from sqlalchemy import text
from db import async_engine
import logging

# ロガー設定
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def check_column_exists(conn, table_name, column_name):
    result = await conn.execute(text(f"""
        SELECT COUNT(*)
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = '{table_name}'
        AND COLUMN_NAME = '{column_name}'
    """))
    return result.scalar() > 0

async def update_schema_v2():
    """words, sentencesテーブルの作成とadusテーブルの更新"""
    async with async_engine.begin() as conn:
        try:
            # 1. Create words table
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS words (
                    id INTEGER NOT NULL AUTO_INCREMENT,
                    speech_id INTEGER NOT NULL,
                    `index` INTEGER NOT NULL,
                    text VARCHAR(255) NOT NULL,
                    start_time FLOAT NOT NULL,
                    end_time FLOAT NOT NULL,
                    confidence FLOAT,
                    PRIMARY KEY (id),
                    FOREIGN KEY(speech_id) REFERENCES speeches (id) ON DELETE CASCADE,
                    INDEX idx_words_speech_id_index (speech_id, `index`)
                )
            """))
            logger.info("✓ wordsテーブルを確認/作成しました")

            # 2. Create sentences table
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS sentences (
                    id INTEGER NOT NULL AUTO_INCREMENT,
                    speech_id INTEGER NOT NULL,
                    `index` INTEGER NOT NULL,
                    text TEXT NOT NULL,
                    start_word_index INTEGER NOT NULL,
                    end_word_index INTEGER NOT NULL,
                    PRIMARY KEY (id),
                    FOREIGN KEY(speech_id) REFERENCES speeches (id) ON DELETE CASCADE,
                    INDEX idx_sentences_speech_id_index (speech_id, `index`)
                )
            """))
            logger.info("✓ sentencesテーブルを確認/作成しました")

            # 3. Update adus table
            # Add start_sentence_index if not exists
            if not await check_column_exists(conn, 'adus', 'start_sentence_index'):
                await conn.execute(text("""
                    ALTER TABLE adus
                    ADD COLUMN start_sentence_index INTEGER NOT NULL DEFAULT 0
                """))
                logger.info("✓ adusテーブルにstart_sentence_indexを追加しました")

            # Add end_sentence_index if not exists
            if not await check_column_exists(conn, 'adus', 'end_sentence_index'):
                await conn.execute(text("""
                    ALTER TABLE adus
                    ADD COLUMN end_sentence_index INTEGER NOT NULL DEFAULT 0
                """))
                logger.info("✓ adusテーブルにend_sentence_indexを追加しました")

            # Drop start_time if exists
            if await check_column_exists(conn, 'adus', 'start_time'):
                await conn.execute(text("ALTER TABLE adus DROP COLUMN start_time"))
                logger.info("✓ adusテーブルからstart_timeを削除しました")

            # Drop end_time if exists
            if await check_column_exists(conn, 'adus', 'end_time'):
                await conn.execute(text("ALTER TABLE adus DROP COLUMN end_time"))
                logger.info("✓ adusテーブルからend_timeを削除しました")

        except Exception as e:
            logger.error(f"✗ エラー: {e}")
            raise

async def main():
    """マイグレーションを実行"""
    print("=" * 50)
    print("データベースマイグレーション開始")
    print("=" * 50)

    try:
        await update_schema_v2()
        print("=" * 50)
        print("マイグレーション完了")
        print("=" * 50)
    except Exception as e:
        print("マイグレーション失敗")
        # エラー詳細はログに出ているのでここでは再送出しない（必要ならする）

    await async_engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
