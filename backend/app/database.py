from flask import g

from app.config import Config
from app.db import database
from app.models import (
    BankConnection,
    FundOrder,
    OnboardingProfile,
    PortfolioSnapshot,
    RebalanceAlert,
    User,
)

_TABLES = [
    User,
    OnboardingProfile,
    BankConnection,
    PortfolioSnapshot,
    RebalanceAlert,
    FundOrder,
]


def init_db(app):
    database.init(Config.DATABASE_PATH)
    database.bind(_TABLES)
    database.connect()
    database.create_tables(_TABLES)

    @app.teardown_appcontext
    def close_db(_exc):
        if not database.is_closed():
            database.close()


def get_db():
    if "db" not in g:
        g.db = database
    return g.db
