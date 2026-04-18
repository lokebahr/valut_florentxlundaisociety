from datetime import datetime

from peewee import CharField, DateTimeField, TextField

from app.db import database


class User(database.Model):
    """End-user identity comes only from Tink (GET user after OAuth)."""

    tink_user_id = CharField(unique=True, index=True, max_length=64)
    tink_profile_json = TextField()
    created_at = DateTimeField(default=datetime.utcnow)

    class Meta:
        table_name = "users"
