from __future__ import annotations

import json

from .pipeline import SocialCollectionPipeline


RAW_INSTAGRAM_COMMENT_EVENT = {
    "object": "instagram",
    "entry": [
        {
            "id": "17841400000000000",
            "platform": "instagram",
            "changes": [
                {
                    "field": "comments",
                    "value": {
                        "event_type": "comment",
                        "comment_id": "178923456",
                        "media_id": "179000001",
                        "account_name": "canbebe_official",
                        "mock_detail": {
                            "id": "178923456",
                            "text": "Le produit est bien mais trop cher et je ne le trouve jamais en pharmacie",
                            "timestamp": "2026-04-23T13:10:00+00:00",
                            "username": "sarahdz",
                            "media": {
                                "id": "179000001",
                                "permalink": "https://instagram.com/p/ABC123/",
                                "caption": "Découvrez CanBebe, douceur et protection pour chaque jour.",
                                "comments_count": 128,
                            },
                        },
                    },
                }
            ],
        }
    ],
}


RAW_INSTAGRAM_DM_EVENT = {
    "object": "instagram",
    "entry": [
        {
            "id": "17841400000000000",
            "platform": "instagram",
            "changes": [
                {
                    "field": "messages",
                    "value": {
                        "event_type": "dm",
                        "message_id": "ig_mid_7788",
                        "account_name": "canbebe_official",
                        "mock_detail": {
                            "id": "ig_mid_7788",
                            "message": "Salam, ma l9itch had produit f la pharmacie 9riba.",
                            "created_time": "2026-04-23T14:00:00+00:00",
                            "from": {"name": "amina_bdz"},
                            "to": {"name": "canbebe_official"},
                        },
                    },
                }
            ],
        }
    ],
}


RAW_FACEBOOK_COMMENT_EVENT = {
    "object": "page",
    "entry": [
        {
            "id": "1020304050",
            "platform": "facebook",
            "changes": [
                {
                    "field": "feed",
                    "value": {
                        "event_type": "comment",
                        "comment_id": "fb_comment_456",
                        "post_id": "fb_post_777",
                        "page_name": "CanBebe Algeria",
                        "mock_detail": {
                            "id": "fb_comment_456",
                            "message": "Je suis decue, aucune reponse sur Messenger depuis 3 jours.",
                            "created_time": "2026-04-23T15:10:00+00:00",
                            "from": {"name": "Nadia K."},
                            "permalink_url": "https://facebook.com/CanBebe/posts/fb_post_777?comment_id=fb_comment_456",
                            "parent": {
                                "id": "fb_post_777",
                                "message": "Nos couches CanBebe sont maintenant disponibles dans plusieurs pharmacies.",
                                "permalink_url": "https://facebook.com/CanBebe/posts/fb_post_777",
                                "comments_count": 42
                            }
                        },
                    },
                }
            ],
        }
    ],
}


RAW_FACEBOOK_GROUP_COMMENT_EVENT = {
    "object": "group",
    "entry": [
        {
            "id": "group_998877",
            "platform": "facebook",
            "changes": [
                {
                    "field": "group_feed",
                    "value": {
                        "event_type": "group_comment",
                        "comment_id": "fb_group_comment_001",
                        "post_id": "fb_group_post_123",
                        "group_id": "9988776655",
                        "group_name": "CanBebe Community DZ",
                        "access_mode": "partial",
                        "mock_detail": {
                            "id": "fb_group_comment_001",
                            "message": "Produit introuvable a Oran depuis 2 semaines.",
                            "created_time": "2026-04-23T15:45:00+00:00",
                            "from": {"name": "Imane O."},
                            "parent": {
                                "id": "fb_group_post_123",
                                "message": "Les mamans, ou trouvez-vous les produits CanBebe a Oran ?",
                                "permalink_url": "https://www.facebook.com/groups/9988776655/posts/fb_group_post_123",
                                "comments_count": 19
                            }
                        },
                    },
                }
            ],
        }
    ],
}


RAW_FACEBOOK_DM_EVENT = {
    "object": "page",
    "entry": [
        {
            "id": "1020304050",
            "platform": "facebook",
            "changes": [
                {
                    "field": "messages",
                    "value": {
                        "event_type": "dm",
                        "message_id": "fb_mid_900",
                        "page_name": "CanBebe Algeria",
                        "mock_detail": {
                            "id": "fb_mid_900",
                            "message": "Le paquet fuit, c'est un defaut ?",
                            "created_time": "2026-04-23T16:30:00+00:00",
                            "from": {"name": "Samia Ben"},
                            "to": {"name": "CanBebe Algeria"},
                        },
                    },
                }
            ],
        }
    ],
}


RAW_INSTAGRAM_URGENT_EVENT = {
    "object": "instagram",
    "entry": [
        {
            "id": "17841400000000000",
            "platform": "instagram",
            "changes": [
                {
                    "field": "messages",
                    "value": {
                        "event_type": "dm",
                        "message_id": "ig_mid_urgent_001",
                        "account_name": "canbebe_official",
                        "mock_detail": {
                            "id": "ig_mid_urgent_001",
                            "message": "Bonjour, mon bebe a eu une allergie et une irritation severe apres utilisation. Le produit est aussi introuvable pres de chez moi.",
                            "created_time": "2026-04-24T09:15:00+00:00",
                            "from": {"name": "Lina M."},
                            "to": {"name": "canbebe_official"},
                        },
                    },
                }
            ],
        }
    ],
}


RAW_BATCH_EVENT = {
    "object": "page",
    "entry": [
        RAW_FACEBOOK_COMMENT_EVENT["entry"][0],
        RAW_FACEBOOK_DM_EVENT["entry"][0],
    ],
}


if __name__ == "__main__":
    pipeline = SocialCollectionPipeline()
    examples = [
        RAW_INSTAGRAM_COMMENT_EVENT,
        RAW_INSTAGRAM_DM_EVENT,
        RAW_FACEBOOK_COMMENT_EVENT,
        RAW_FACEBOOK_GROUP_COMMENT_EVENT,
        RAW_FACEBOOK_DM_EVENT,
        RAW_INSTAGRAM_URGENT_EVENT,
        RAW_BATCH_EVENT,
    ]
    for event in examples:
        print(json.dumps(pipeline.process_events(event), ensure_ascii=False, indent=2))
