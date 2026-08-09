"""Add AI KYC document verification fields.

Revision ID: 8f0c7a9b3d21
Revises: 4058b1cb88dd
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "8f0c7a9b3d21"
down_revision: Union[str, Sequence[str], None] = "4058b1cb88dd"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("rider_profiles", sa.Column("ai_document_status", sa.String(), server_default="pending"))
    op.add_column("rider_profiles", sa.Column("ai_document_confidence", sa.Float(), nullable=True))
    op.add_column("rider_profiles", sa.Column("ai_document_type", sa.String(), nullable=True))
    op.add_column("rider_profiles", sa.Column("ai_extracted_name", sa.String(), nullable=True))
    op.add_column("rider_profiles", sa.Column("ai_extracted_dob", sa.String(), nullable=True))
    op.add_column("rider_profiles", sa.Column("ai_extracted_id_number", sa.String(), nullable=True))
    op.add_column("rider_profiles", sa.Column("ai_verification_note", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("rider_profiles", "ai_verification_note")
    op.drop_column("rider_profiles", "ai_extracted_id_number")
    op.drop_column("rider_profiles", "ai_extracted_dob")
    op.drop_column("rider_profiles", "ai_extracted_name")
    op.drop_column("rider_profiles", "ai_document_type")
    op.drop_column("rider_profiles", "ai_document_confidence")
    op.drop_column("rider_profiles", "ai_document_status")
