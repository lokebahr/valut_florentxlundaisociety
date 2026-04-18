from datetime import datetime

from peewee import BooleanField, DateTimeField, FloatField, ForeignKeyField, IntegerField, TextField

from app.db import database
from app.models.user import User


class OnboardingProfile(database.Model):
    user = ForeignKeyField(User, backref="onboarding_profile", unique=True)
    updated_at = DateTimeField(default=datetime.utcnow)

    risk_tolerance = IntegerField(null=True)
    time_horizon_years = IntegerField(null=True)
    savings_purpose = TextField(null=True)
    dependents_count = IntegerField(null=True)
    salary_monthly_sek = IntegerField(null=True)
    age = IntegerField(null=True)
    disposable_income_monthly_sek = IntegerField(null=True)
    expensive_loans = BooleanField(null=True)

    adjusted_risk_tolerance = IntegerField(null=True)
    monthly_contribution_sek = IntegerField(null=True)
    scenario_answers_json = TextField(null=True)
    recommendations_json = TextField(null=True)

    onboarding_completed = BooleanField(default=False)
    current_step = IntegerField(default=0)

    class Meta:
        table_name = "onboarding_profiles"
