"""drop chat_provider_settings

Revision ID: 6bc053c77e23
Revises: b7d1c4a9e2f3
Create Date: 2026-07-13

Removes the per-user LLM provider selection table. Multi-provider chat
support was dropped; the chat agent now uses the local Ollama model
only, so the table is no longer read or written.

The downgrade recreates the table exactly as b7d1c4a9e2f3 defined it, so
this migration is fully reversible.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6bc053c77e23"
down_revision: Union[str, None] = "b7d1c4a9e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("chat_provider_settings")


def downgrade() -> None:
    op.create_table(
        "chat_provider_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("provider", sa.String, nullable=False, server_default="local"),
        sa.Column("model_name", sa.String, nullable=True),
        sa.Column("api_key_enc", sa.String, nullable=True),
    )
