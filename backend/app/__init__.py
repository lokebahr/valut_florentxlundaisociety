from flask import Flask
from flask_cors import CORS

from app.config import load_config
from app.database import init_db


def create_app():
    app = Flask(__name__)
    load_config(app)
    CORS(app, resources={r"/api/*": {"origins": app.config["FRONTEND_ORIGIN"]}}, supports_credentials=True)
    init_db(app)

    from app.api.agent import bp as agent_bp
    from app.api.analysis import bp as analysis_bp
    from app.api.auth import bp as auth_bp
    from app.api.dashboard import bp as dashboard_bp
    from app.api.montrose import bp as montrose_bp
    from app.api.onboarding import bp as onboarding_bp
    from app.api.tink import bp as tink_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(onboarding_bp)
    app.register_blueprint(tink_bp)
    app.register_blueprint(montrose_bp)
    app.register_blueprint(analysis_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(agent_bp)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    return app
