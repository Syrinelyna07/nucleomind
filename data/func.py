import requests
from config import BASE_URL, PAGE_ID

# -----------------------------
# Get posts
# -----------------------------
def get_posts(page_token):
    url = f"{BASE_URL}/{PAGE_ID}/posts"

    params = {
        "access_token": page_token,
        "fields": "id,message,created_time,permalink_url"
    }

    res = requests.get(url, params=params).json()
    return res.get("data", [])


# -----------------------------
# Get comments
# -----------------------------
def get_comments(post_id, page_token):
    url = f"{BASE_URL}/{post_id}/comments"

    params = {
        "access_token": page_token,
        "fields": "message,created_time,from"
    }

    res = requests.get(url, params=params).json()
    return res.get("data", [])


# -----------------------------
# Get likes
# -----------------------------
def get_likes(post_id, page_token):
    url = f"{BASE_URL}/{post_id}"

    params = {
        "access_token": page_token,
        "fields": "likes.summary(true)"
    }

    res = requests.get(url, params=params).json()

    return res.get("likes", {}).get("summary", {}).get("total_count", 0)

# -----------------------------
# Get conversations
# -----------------------------
def get_conversations(page_token):
    url = f"{BASE_URL}/{PAGE_ID}/conversations"

    params = {
        "access_token": page_token,
        "fields": "id,updated_time"
    }

    res = requests.get(url, params=params).json()
    return res.get("data", [])


# -----------------------------
# Get messages from conversation
# -----------------------------
def get_messages(conversation_id, page_token):
    url = f"{BASE_URL}/{conversation_id}/messages"

    params = {
        "access_token": page_token,
        "fields": "message,from,created_time"
    }

    res = requests.get(url, params=params).json()

    messages = []
    for m in res.get("data", []):
        messages.append({
            "sender": m.get("from", {}).get("name"),
            "message": m.get("message"),
            "created_time": m.get("created_time")
        })

    return messages