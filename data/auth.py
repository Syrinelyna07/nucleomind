import requests
import json
import os
from config import APP_ID, APP_SECRET, SHORT_LIVED_USER_TOKEN, BASE_URL

TOKEN_FILE = "token_store.json"

# -----------------------------
# Exchange short token -> long token
# -----------------------------
def get_long_lived_token():
    url = f"{BASE_URL}/oauth/access_token"

    params = {
        "grant_type": "fb_exchange_token",
        "client_id": APP_ID,
        "client_secret": APP_SECRET,
        "fb_exchange_token": SHORT_LIVED_USER_TOKEN
    }

    res = requests.get(url, params=params).json()

    return res.get("access_token")


# -----------------------------
# Get page access token
# -----------------------------
def get_page_token(user_token):
    url = f"{BASE_URL}/me/accounts"

    params = {"access_token": user_token}

    res = requests.get(url, params=params).json()

    data = res.get("data", [])
    if not data:
        raise Exception("No page found or invalid token")

    return data[0]["access_token"]


# -----------------------------
# Save tokens locally
# -----------------------------
def save_tokens(page_token, user_token):
    with open(TOKEN_FILE, "w") as f:
        json.dump({
            "page_token": page_token,
            "user_token": user_token
        }, f, indent=4)


# -----------------------------
# Load tokens
# -----------------------------
def load_tokens():
    if not os.path.exists(TOKEN_FILE):
        return None

    with open(TOKEN_FILE, "r") as f:
        return json.load(f)


# -----------------------------
# Get valid page token (auto refresh logic)
# -----------------------------
def get_valid_page_token():
    stored = load_tokens()

    if stored and "page_token" in stored:
        return stored["page_token"]

    user_token = get_long_lived_token()
    page_token = get_page_token(user_token)

    save_tokens(page_token, user_token)

    return page_token