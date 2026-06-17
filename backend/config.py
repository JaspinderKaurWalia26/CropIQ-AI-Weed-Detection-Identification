import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'your-secret-key'
    # Default to a local SQLite database if DATABASE_URL is not provided
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or (
        'sqlite:///' + os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cropiq.db')
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    JWT_ACCESS_TOKEN_EXPIRES = 86400  # 24 hours in seconds

    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True
    }

    # Uploads and content settings
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER') or os.path.join(BASE_DIR, 'uploads')
    MAX_CONTENT_LENGTH = int(os.environ.get('MAX_CONTENT_LENGTH', 16 * 1024 * 1024))  # 16 MB default

    # External services (Groq)
    GROQ_API_KEY = os.environ.get('GROQ_API_KEY')
    GROQ_MODEL = os.environ.get('GROQ_MODEL', 'llama-3.1-8b-instant')
    GROQ_API_BASE = os.environ.get('GROQ_API_BASE', 'https://api.groq.com/openai/v1')

    # Weed detection model
    MODEL_PATH = os.environ.get('MODEL_PATH')

class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}