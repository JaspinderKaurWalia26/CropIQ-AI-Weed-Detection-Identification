from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_migrate import Migrate
from config import config

db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()

def create_app(config_name='default'):
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)
    CORS(app, origins=["http://localhost:3000"])  # React dev server
    
    # Register blueprints
    from app.auth import bp as auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    
    from app.main import bp as main_bp
    app.register_blueprint(main_bp, url_prefix='/api')

    from app.tips import bp as tips_bp   
    app.register_blueprint(tips_bp, url_prefix='/api') 

    from app.crop_assistant import bp as assistant_bp
    app.register_blueprint(assistant_bp, url_prefix="/api/assistant")

    return app
