"""update_20260115_103955

Revision ID: 4a7b9bb2e1a9
Revises: 2b546eeeda57
Create Date: 2026-01-15 01:39:57.131266

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = '4a7b9bb2e1a9'
down_revision: Union[str, Sequence[str], None] = '2b546eeeda57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    
    op.add_column('words', sa.Column('round_id', sa.Integer(), nullable=True))
    conn.execute(sa.text("""
        UPDATE words w
        JOIN speeches s ON w.speech_id = s.id
        SET w.round_id = s.round_id
    """))
    op.alter_column('words', 'round_id', existing_type=sa.Integer(), nullable=False)
    op.create_index(op.f('ix_words_round_id'), 'words', ['round_id'], unique=False)
    op.create_foreign_key(None, 'words', 'rounds', ['round_id'], ['id'], ondelete='CASCADE')
    
    op.add_column('sentences', sa.Column('round_id', sa.Integer(), nullable=True))
    op.add_column('sentences', sa.Column('first_word_id', sa.Integer(), nullable=True))
    op.add_column('sentences', sa.Column('last_word_id', sa.Integer(), nullable=True))
    
    conn.execute(sa.text("""
        UPDATE sentences sen
        JOIN speeches sp ON sen.speech_id = sp.id
        SET sen.round_id = sp.round_id
    """))
    
    conn.execute(sa.text("""
        UPDATE sentences sen
        JOIN (
            SELECT sen.id as sentence_id, MIN(w.id) as first_word_id, MAX(w.id) as last_word_id
            FROM sentences sen
            JOIN speeches sp ON sen.speech_id = sp.id
            JOIN words w ON w.speech_id = sp.id
            WHERE w.index >= sen.start_word_index AND w.index <= sen.end_word_index
            GROUP BY sen.id
        ) word_ranges ON sen.id = word_ranges.sentence_id
        SET sen.first_word_id = word_ranges.first_word_id,
            sen.last_word_id = word_ranges.last_word_id
    """))
    
    op.alter_column('sentences', 'round_id', existing_type=sa.Integer(), nullable=False)
    op.alter_column('sentences', 'first_word_id', existing_type=sa.Integer(), nullable=False)
    op.alter_column('sentences', 'last_word_id', existing_type=sa.Integer(), nullable=False)
    
    op.drop_constraint(op.f('sentences_ibfk_1'), 'sentences', type_='foreignkey')
    op.drop_index(op.f('idx_sentences_speech_id_index'), table_name='sentences')
    op.drop_index(op.f('ix_sentences_speech_id'), table_name='sentences')
    op.create_index(op.f('ix_sentences_round_id'), 'sentences', ['round_id'], unique=False)
    op.create_foreign_key(None, 'sentences', 'words', ['first_word_id'], ['id'])
    op.create_foreign_key(None, 'sentences', 'words', ['last_word_id'], ['id'])
    op.create_foreign_key(None, 'sentences', 'rounds', ['round_id'], ['id'], ondelete='CASCADE')
    
    op.add_column('speeches', sa.Column('first_sentence_id', sa.Integer(), nullable=True))
    op.add_column('speeches', sa.Column('last_sentence_id', sa.Integer(), nullable=True))
    
    conn.execute(sa.text("""
        UPDATE speeches sp
        JOIN (
            SELECT speech_id, MIN(id) as first_id, MAX(id) as last_id
            FROM sentences
            GROUP BY speech_id
        ) sen_ranges ON sp.id = sen_ranges.speech_id
        SET sp.first_sentence_id = sen_ranges.first_id,
            sp.last_sentence_id = sen_ranges.last_id
    """))
    
    op.create_foreign_key(None, 'speeches', 'sentences', ['first_sentence_id'], ['id'])
    op.create_foreign_key(None, 'speeches', 'sentences', ['last_sentence_id'], ['id'])
    
    conn.execute(sa.text("""
        DELETE FROM adus
        WHERE speech_id NOT IN (SELECT DISTINCT speech_id FROM sentences)
    """))
    
    op.add_column('adus', sa.Column('first_sentence_id', sa.Integer(), nullable=True))
    op.add_column('adus', sa.Column('last_sentence_id', sa.Integer(), nullable=True))
    
    conn.execute(sa.text("""
        UPDATE adus a
        JOIN (
            SELECT a.id as adu_id, MIN(sen.id) as first_id, MAX(sen.id) as last_id
            FROM adus a
            JOIN sentences sen ON sen.speech_id = a.speech_id
            WHERE sen.index >= a.start_sentence_index AND sen.index <= a.end_sentence_index
            GROUP BY a.id
        ) sen_ranges ON a.id = sen_ranges.adu_id
        SET a.first_sentence_id = sen_ranges.first_id,
            a.last_sentence_id = sen_ranges.last_id
    """))
    
    op.alter_column('adus', 'first_sentence_id', existing_type=sa.Integer(), nullable=False)
    op.alter_column('adus', 'last_sentence_id', existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key(None, 'adus', 'sentences', ['first_sentence_id'], ['id'])
    op.create_foreign_key(None, 'adus', 'sentences', ['last_sentence_id'], ['id'])
    
    op.drop_column('adus', 'end_sentence_index')
    op.drop_column('adus', 'start_sentence_index')
    op.drop_column('sentences', 'start_word_index')
    op.drop_column('sentences', 'speech_id')
    op.drop_column('sentences', 'end_word_index')
    op.drop_column('sentences', 'index')
    op.drop_constraint(op.f('words_ibfk_1'), 'words', type_='foreignkey')
    op.drop_index(op.f('idx_words_speech_id_index'), table_name='words')
    op.drop_index(op.f('ix_words_speech_id'), table_name='words')
    op.drop_column('words', 'speech_id')
    op.drop_column('words', 'index')


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.add_column('words', sa.Column('index', mysql.INTEGER(), autoincrement=False, nullable=False))
    op.add_column('words', sa.Column('speech_id', mysql.INTEGER(), autoincrement=False, nullable=False))
    op.drop_constraint(None, 'words', type_='foreignkey')
    op.create_foreign_key(op.f('words_ibfk_1'), 'words', 'speeches', ['speech_id'], ['id'], ondelete='CASCADE')
    op.drop_index(op.f('ix_words_round_id'), table_name='words')
    op.create_index(op.f('ix_words_speech_id'), 'words', ['speech_id'], unique=False)
    op.create_index(op.f('idx_words_speech_id_index'), 'words', ['speech_id', 'index'], unique=False)
    op.drop_column('words', 'round_id')
    op.drop_constraint(None, 'speeches', type_='foreignkey')
    op.drop_constraint(None, 'speeches', type_='foreignkey')
    op.drop_column('speeches', 'last_sentence_id')
    op.drop_column('speeches', 'first_sentence_id')
    op.add_column('sentences', sa.Column('index', mysql.INTEGER(), autoincrement=False, nullable=False))
    op.add_column('sentences', sa.Column('end_word_index', mysql.INTEGER(), autoincrement=False, nullable=False))
    op.add_column('sentences', sa.Column('speech_id', mysql.INTEGER(), autoincrement=False, nullable=False))
    op.add_column('sentences', sa.Column('start_word_index', mysql.INTEGER(), autoincrement=False, nullable=False))
    op.drop_constraint(None, 'sentences', type_='foreignkey')
    op.drop_constraint(None, 'sentences', type_='foreignkey')
    op.drop_constraint(None, 'sentences', type_='foreignkey')
    op.create_foreign_key(op.f('sentences_ibfk_1'), 'sentences', 'speeches', ['speech_id'], ['id'], ondelete='CASCADE')
    op.drop_index(op.f('ix_sentences_round_id'), table_name='sentences')
    op.create_index(op.f('ix_sentences_speech_id'), 'sentences', ['speech_id'], unique=False)
    op.create_index(op.f('idx_sentences_speech_id_index'), 'sentences', ['speech_id', 'index'], unique=False)
    op.drop_column('sentences', 'last_word_id')
    op.drop_column('sentences', 'first_word_id')
    op.drop_column('sentences', 'round_id')
    op.add_column('adus', sa.Column('start_sentence_index', mysql.INTEGER(), autoincrement=False, nullable=False))
    op.add_column('adus', sa.Column('end_sentence_index', mysql.INTEGER(), autoincrement=False, nullable=False))
    op.drop_constraint(None, 'adus', type_='foreignkey')
    op.drop_constraint(None, 'adus', type_='foreignkey')
    op.drop_column('adus', 'last_sentence_id')
    op.drop_column('adus', 'first_sentence_id')
    # ### end Alembic commands ###
