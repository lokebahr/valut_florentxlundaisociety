from __future__ import annotations

from datetime import datetime

from flask import Blueprint, jsonify, request

from app.api.deps import current_user
from app.models import OnboardingProfile

bp = Blueprint("onboarding", __name__, url_prefix="/api/onboarding")


def _profile_to_dict(p: OnboardingProfile) -> dict:
    return {
        "risk_tolerance": p.risk_tolerance,
        "time_horizon_years": p.time_horizon_years,
        "savings_purpose": p.savings_purpose,
        "dependents_count": p.dependents_count,
        "salary_monthly_sek": p.salary_monthly_sek,
        "age": p.age,
        "disposable_income_monthly_sek": p.disposable_income_monthly_sek,
        "expensive_loans": p.expensive_loans,
        "adjusted_risk_tolerance": p.adjusted_risk_tolerance,
        "monthly_contribution_sek": p.monthly_contribution_sek,
        "onboarding_completed": p.onboarding_completed,
        "current_step": p.current_step,
    }


@bp.get("/profile")
def get_profile():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    profile = OnboardingProfile.get(OnboardingProfile.user == user)
    return jsonify({"profile": _profile_to_dict(profile)})


@bp.put("/profile")
def put_profile():
    user = current_user()
    if not user:
        return jsonify({"error": "Ogiltig behörighet."}), 401
    data = request.get_json(silent=True) or {}
    profile = OnboardingProfile.get(OnboardingProfile.user == user)

    fields = [
        "risk_tolerance",
        "time_horizon_years",
        "savings_purpose",
        "dependents_count",
        "salary_monthly_sek",
        "age",
        "disposable_income_monthly_sek",
        "expensive_loans",
        "adjusted_risk_tolerance",
        "monthly_contribution_sek",
        "onboarding_completed",
        "current_step",
    ]
    # These two can be intentionally cleared to null by the user
    explicitly_nullable = {"adjusted_risk_tolerance", "monthly_contribution_sek"}
    for key in fields:
        if key in data:
            val = data[key]
            if val is not None or key in explicitly_nullable:
                setattr(profile, key, val)
    profile.updated_at = datetime.utcnow()
    profile.save()
    saved = _profile_to_dict(profile)
    print(f"[put_profile] received={data}")
    print(f"[put_profile] saved={saved}")
    return jsonify({"profile": saved})


@bp.get("/mission")
def mission():
    return jsonify(
        {
            "title": "Valut",
            "mission": (
                "Vi vill att svenska konsumenter ska få en investeringsstrategi som faktiskt passar deras mål. "
                "Storbankerna säljer ofta egna, dyrare produkter i stället för att tydligt redovisa vad som är lämpligt."
            ),
            "sources": [
                {
                    "label": "FI (2025): Majoriteten sparar hos storbanker – trots högre avgifter",
                    "url": "https://www.fi.se/sv/publicerat/rapporter/rapporter/2025/majoriteten-sparar-hos-storbanker--trots-hogre-avgifter/",
                },
                {
                    "label": "Affärsvärlden: Så tjänar Nordea 16 Mkr på en ointresserad sparare",
                    "url": "https://www.affarsvarlden.se/kronika/sa-tjanar-nordea-16-mkr-pa-en-ointresserad-sparare",
                },
                {
                    "label": "Småspararguiden: Ekonomibyrån i SVT om höga fondavgifter (Wahlroos-citat)",
                    "url": "https://www.smaspararguiden.se/blogg/ekonomibyran-i-svt-belyser-hoga-fondavgifter/",
                },
            ],
            "quote": (
                "– Varför ska du betala 1 procent eller 2 procent åt en förvaltare?, säger Wahlroos i Ekonomibyrån."
            ),
        }
    )
