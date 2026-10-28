# ============================================================
# PythonAnywhere WSGI Configuration File for StudyBuddy
# ============================================================
# This file is used by PythonAnywhere to serve your Flask app.
#
# Instructions:
# 1. Upload your StudyBuddy ZIP to PythonAnywhere Files tab
# 2. Unzip it into /home/YOUR_USERNAME/studybuddy/
# 3. Go to Web tab → WSGI configuration file → paste THIS file
# 4. Replace YOUR_USERNAME with your actual PythonAnywhere username
# 5. Hit Reload in the Web tab
# ============================================================

import sys
import os

# --- Set the path to your project ----------------------------------------
# Replace YOUR_USERNAME with your PythonAnywhere username
PROJECT_HOME = '/home/YOUR_USERNAME/studybuddy'

if PROJECT_HOME not in sys.path:
    sys.path.insert(0, PROJECT_HOME)

# --- Set environment variables -------------------------------------------
os.environ['FLASK_ENV'] = 'production'

# Set your Gemini API Key here (or leave blank and set it inside the app)
# os.environ['GEMINI_API_KEY'] = 'your-gemini-api-key-here'

# --- Import the Flask app -------------------------------------------------
from app import app as application  # noqa: F401
