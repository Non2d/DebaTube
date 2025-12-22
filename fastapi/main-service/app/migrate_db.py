"""
データベースマイグレーションスクリプト
既存データを保持しながらスキーマを更新します
"""
import asyncio
from sqlalchemy import text
from db import async_engine, Base
from models.round import Round, Speech, Adu, Rebuttal


async def add_name_column_to_rounds():
    """roundsテーブルにnameカラムを追加"""
    async with async_engine.begin() as conn:
        try:
            # nameカラムが存在するかチェック
            result = await conn.execute(text("""
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = 'debate'
                AND TABLE_NAME = 'rounds'
                AND COLUMN_NAME = 'name'
            """))
            exists = result.scalar()

            if exists == 0:
                # nameカラムを追加
                await conn.execute(text("""
                    ALTER TABLE rounds
                    ADD COLUMN name VARCHAR(255) NOT NULL DEFAULT 'untitled'
                """))
                print("✓ roundsテーブルにnameカラムを追加しました")

                # 既存のデータにユニークな名前を設定
                await conn.execute(text("""
                    UPDATE rounds
                    SET name = CONCAT('round_', id, '_', DATE_FORMAT(created_at, '%Y%m%d_%H%i%s'))
                """))
                print("✓ 既存レコードに名前を設定しました")

                # UNIQUE制約とINDEXを追加
                await conn.execute(text("""
                    ALTER TABLE rounds
                    ADD UNIQUE KEY unique_name (name)
                """))
                await conn.execute(text("""
                    ALTER TABLE rounds
                    ADD INDEX idx_rounds_name (name)
                """))
                print("✓ UNIQUE制約とINDEXを追加しました")
            else:
                print("✓ nameカラムは既に存在します")

        except Exception as e:
            print(f"✗ エラー: {e}")
            raise


async def main():
    """マイグレーションを実行"""
    print("=" * 50)
    print("データベースマイグレーション開始")
    print("=" * 50)

    # nameカラムを追加
    await add_name_column_to_rounds()

    print("=" * 50)
    print("マイグレーション完了")
    print("=" * 50)

    # エンジンを閉じる
    await async_engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
