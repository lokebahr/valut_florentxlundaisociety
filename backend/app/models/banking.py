from datetime import datetime

from peewee import BooleanField, DateTimeField, ForeignKeyField, IntegerField, TextField

from app.db import database
from app.models.user import User


class BankConnection(database.Model):
    user = ForeignKeyField(User, backref="bank_connections")
    is_mock = BooleanField(default=True)
    credentials_id = TextField(null=True)
    access_token = TextField(null=True)
    token_expires_at = DateTimeField(null=True)
    created_at = DateTimeField(default=datetime.utcnow)

    class Meta:
        table_name = "bank_connections"


class PortfolioSnapshot(database.Model):
    user = ForeignKeyField(User, backref="portfolio_snapshots")
    raw_json = TextField()
    normalized_json = TextField()
    created_at = DateTimeField(default=datetime.utcnow)

    class Meta:
        table_name = "portfolio_snapshots"


class RebalanceAlert(database.Model):
    user = ForeignKeyField(User, backref="rebalance_alerts")
    kind = TextField()
    message = TextField()
    severity = TextField()
    created_at = DateTimeField(default=datetime.utcnow)
    dismissed = BooleanField(default=False)

    class Meta:
        table_name = "rebalance_alerts"


class FundOrder(database.Model):
    user = ForeignKeyField(User, backref="fund_orders")
    from_name = TextField()
    to_name = TextField()
    amount_sek = IntegerField()
    status = TextField(default="pending")
    created_at = DateTimeField(default=datetime.utcnow)

    class Meta:
        table_name = "fund_orders"
