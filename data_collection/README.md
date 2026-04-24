# CanBebe Social Collector

## Format canonique

Chaque interaction est normalisee avec les champs suivants :

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
  "category_labels": "prix",
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

## Regles metier

- `category_labels` est maintenant une seule valeur
- `problem_labels` reste une liste
- `recommended_solution` reste une liste
- `problem_labels[i]` correspond a `recommended_solution[i]`
- `suggested_reply` reste une seule reponse suggeree
- `status` utilise maintenant seulement `non-treated` ou `treated`

## Source types

Les valeurs supportees pour `source_type` sont :
- `private_comment`
- `public_comment`
- `private_dm`

Convention :
- `private_comment` : commentaires sur vos propres comptes/pages/posts
- `public_comment` : commentaires de groupes Facebook
- `private_dm` : messages prives

## Export CSV

Toutes les interactions enrichies sont aussi ajoutees dans :

`data_collection/outputs/collected_interactions.csv`

Regles d'export :
- une ligne par interaction
- `problem_labels` et `recommended_solution` sont aplatis avec ` | `

## Lancer

```bash
py -3 -m pip install -r data_collection/requirements.txt
py -3 -m data_collection.examples
py -3 -m uvicorn data_collection.webhook_receiver:app --reload
```
