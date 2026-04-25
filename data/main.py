from auth import get_long_lived_token
from func import get_posts, get_comments, get_likes
from func import get_conversations, get_messages
import json
from func import get_conversations, get_messages

def collect_conversations(page_token):
    conversations = get_conversations(page_token)

    all_convos = []

    for convo in conversations:
        convo_id = convo["id"]

        print(f"💬 Conversation {convo_id}")

        messages = get_messages(convo_id, page_token)

        all_convos.append({
            "conversation_id": convo_id,
            "updated_time": convo.get("updated_time"),
            "messages": messages
        })

    return all_convos

def run_pipeline():
    print("🔐 Getting valid token...")
    page_token = get_long_lived_token()

    print("📦 Fetching posts...")
    posts = get_posts(page_token)

    all_data = []

    for post in posts:
        post_id = post["id"]

        print(f"📝 Processing post {post_id}")

        comments = get_comments(post_id, page_token)
        likes = get_likes(post_id, page_token)

        all_data.append({
            "post_id": post_id,
            "message": post.get("message"),
            "created_time": post.get("created_time"),
            "permalink_url": post.get("permalink_url"),
            "likes": likes,
            "comments": comments
        })
    print("💬 Fetching conversations...")
    conversations_data = collect_conversations(page_token)

    # -------------------------
    # FINAL OUTPUT (MERGED)
    # -------------------------
    final_output = {
        "posts": all_data,
        "conversations": conversations_data
    }
    with open("fb_data.json", "w", encoding="utf-8") as f:
        json.dump(final_output, f, indent=4, ensure_ascii=False)

    print("✅ Done. Data saved to fb_data.json")



if __name__ == "__main__":
    run_pipeline()
