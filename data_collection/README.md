# CanBebe Social Collector

## Architecture minimale

Ce dossier contient uniquement la logique de collecte et d'enrichissement :

1. `webhook_receiver.py`
   Recoit les evenements Meta, valide le webhook, verifie la signature et transmet la charge utile au pipeline.
2. `event_parser.py`
   Parse tous les `entry` et `changes` recus depuis Meta.
3. `meta_api_client.py`
   Recupere les details des commentaires et DMs via Meta API.
4. `normalizer.py`
   Transforme les donnees detaillees vers le format canonique unique.
5. `llm_classifier.py`
   Enrichit le texte avec le LLM ou le fallback par regles.
6. `csv_exporter.py`
   Ecrit toutes les interactions enrichies dans un fichier CSV local.
7. `pipeline.py`
   Orchestration simple : `receive -> fetch details -> normalize -> classify -> export CSV -> final JSON`.

## Source types

Les valeurs supportees pour `source_type` sont :
- `private_comment`
- `public_comment`
- `private_dm`

Convention utilisee :
- `private_comment` : commentaires sur vos propres comptes/pages/posts Instagram ou Facebook
- `public_comment` : commentaires de groupes Facebook
- `private_dm` : messages prives Instagram ou Facebook Messenger

## Format canonique

```json
{
  "id": "msg_000145",
  "platform": "instagram",
  "source_type": "private_comment",
  "account_name": "canbebe_official",
  "comment_link": "https://instagram.com/p/ABC123/c/178923456",
  "post_link": "https://instagram.com/p/ABC123/",
  "post_description": "Decouvrez CanBebe, douceur et protection pour chaque jour.",
  "nb_comments": 128,
  "author_username": "sarahdz",
  "content_text": "Le produit est bien mais trop cher et je ne le trouve jamais en pharmacie",
  "content_language": "fr",
  "created_at": "2026-04-23T13:10:00Z",
  "sentiment_label": "negatif",
  "emotion_label": "frustration",
  "category_labels": ["prix", "disponibilite"],
  "problem_labels": ["prix_trop_eleve", "rupture_de_stock"],
  "problem_summary": "Cliente frustree par l'indisponibilite frequente et le prix percu comme eleve.",
  "is_urgent": false,
  "urgency_reason": "",
  "recommended_solution": [
    "Ameliorer la communication sur le prix et partager les formats les plus adaptes.",
    "Remonter le cas a l'equipe distribution et verifier la disponibilite locale."
  ],
  "suggested_reply": "Merci pour votre retour. Nous sommes desoles pour cette indisponibilite. Nous transmettons l'information a notre equipe concernee.",
  "status": "non-treated"
}
```

## CSV

Toutes les interactions enrichies sont aussi ajoutees dans :

`data_collection/outputs/collected_interactions.csv`

## Lancer

```bash
py -3 -m pip install -r data_collection/requirements.txt
py -3 -m data_collection.examples
py -3 -m uvicorn data_collection.webhook_receiver:app --reload
```
