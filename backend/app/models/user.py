from datetime import datetime

from peewee import CharField, DateTimeField, TextField

from app.db import database


class User(database.Model):
    email = CharField(unique=True, index=True, max_length=255)
    password_hash = CharField(max_length=255)
    created_at = DateTimeField(default=datetime.utcnow)
    tink_external_user_id = CharField(max_length=64, null=True, unique=True)

    class Meta:
        table_name = "users"
