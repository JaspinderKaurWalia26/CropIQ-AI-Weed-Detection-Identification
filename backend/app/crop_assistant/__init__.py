from flask import Blueprint

bp = Blueprint("assistant", __name__)
from app.crop_assistant import routes
