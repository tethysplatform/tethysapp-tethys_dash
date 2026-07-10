"""chat_provider_settings

Revision ID: b7d1c4a9e2f3
Revises: add270eff36c
Create Date: 2026-07-09

Per-user LLM provider selection for the chat agent. api_key_enc holds a
Fernet-encrypted key (derived from Django SECRET_KEY) - plaintext keys
are never persisted.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7d1c4a9e2f3"
down_revision: Union[str, None] = "add270eff36c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "chat_provider_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("username", sa.String, nullable=False, unique=True),
        sa.Column("provider", sa.String, nullable=False, server_default="local"),
        sa.Column("model_name", sa.String, nullable=True),
        sa.Column("api_key_enc", sa.String, nullable=True),
    )


def downgrade() -> None:
    op.drop_table("chat_provider_settings")
