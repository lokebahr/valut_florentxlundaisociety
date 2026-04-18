from datetime import datetime

from peewee import CharField, DateTimeField, ForeignKeyField, IntegerField, TextField

from app.db import database
from app.models.user import User


class MontroseOAuthState(database.Model):
    """Temporary PKCE + state for Montrose OAuth (per user).

    client_id / client_secret come from Montrose ``POST {issuer}/register`` for this flow.
    """

    user = ForeignKeyField(User, backref="montrose_oauth_states")
    state = CharField(unique=True, max_length=128, index=True)
    code_verifier = TextField()
    client_id = CharField(max_length=512, null=True)
    client_secret = CharField(max_length=512, null=True)
    created_at = DateTimeField(default=datetime.utcnow)

    class Meta:
        table_name = "montrose_oauth_states"


class MontroseConnection(database.Model):
    """Montrose MCP OAuth tokens (per user)."""

    user = ForeignKeyField(User, unique=True, backref="montrose_connection")
    access_token = TextField()
    refresh_token = TextField(null=True)
    client_id = CharField(max_length=512)
    client_secret = CharField(max_length=512, null=True)
    expires_at = IntegerField(null=True)
    obtained_at = IntegerField(null=True)
    updated_at = DateTimeField(default=datetime.utcnow)

    class Meta:
        table_name = "montrose_connections"
