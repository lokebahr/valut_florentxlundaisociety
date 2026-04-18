from flask import g

from app.config import Config
from app.db import database
from app.models import (
    BankConnection,
    FundOrder,
    MontroseConnection,
    MontroseOAuthState,
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
    MontroseOAuthState,
    MontroseConnection,
]


def _ensure_onboarding_profile_columns():
    try:
        cursor = database.execute_sql("PRAGMA table_info(onboarding_profiles)")
        names = {row[1] for row in cursor.fetchall()}
    except Exception:
        return
    if "scenario_answers_json" not in names:
        database.execute_sql("ALTER TABLE onboarding_profiles ADD COLUMN scenario_answers_json TEXT")
    if "recommendations_json" not in names:
        database.execute_sql("ALTER TABLE onboarding_profiles ADD COLUMN recommendations_json TEXT")


def _ensure_montrose_oauth_state_columns():
    """SQLite: add client_id / client_secret if DB predates dynamic client registration."""
    try:
        cursor = database.execute_sql("PRAGMA table_info(montrose_oauth_states)")
        names = {row[1] for row in cursor.fetchall()}
    except Exception:
        return
    if "client_id" not in names:
        database.execute_sql("ALTER TABLE montrose_oauth_states ADD COLUMN client_id VARCHAR(512)")
    if "client_secret" not in names:
        database.execute_sql("ALTER TABLE montrose_oauth_states ADD COLUMN client_secret VARCHAR(512)")


def init_db(app):
    database.init(Config.DATABASE_PATH)
    database.bind(_TABLES)
    database.connect()
    database.create_tables(_TABLES)
    _ensure_onboarding_profile_columns()
    _ensure_montrose_oauth_state_columns()

    @app.teardown_appcontext
    def close_db(_exc):
        if not database.is_closed():
            database.close()


def get_db():
    if "db" not in g:
        g.db = database
    return g.db
