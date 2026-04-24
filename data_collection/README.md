# CanBebe Social Collector

## Architecture minimale

Ce dossier contient uniquement la logique de collecte et d'enrichissement :

1. `webhook_receiver.py`
   Recoit les evenements Meta, valide le webhook, verifie la signature et transmet la charge utile au pipeline.
2. `event_parser.py`
   Parse tous les `entry` et `changes` recus depuis Meta pour eviter de perdre des interactions.
3. `exceptions.py`
   Centralise les erreurs metier du pipeline et les erreurs d'acces Meta.
4. `meta_api_client.py`
   Encapsule les appels a la Graph API pour recuperer les details d'un commentaire ou DM.
5. `normalizer.py`
   Transforme les donnees Meta detaillees vers le JSON canonique unique.
6. `llm_classifier.py`
   Utilise Gemini si `GEMINI_API_KEY` est disponible, sinon bascule sur un mode regles/mots-cles.
7. `csv_exporter.py`
   Ecrit toutes les interactions enrichies dans un fichier CSV local.
8. `pipeline.py`
   Orchestration simple : `receive -> fetch details -> normalize -> classify -> export CSV -> final JSON`.
9. `examples.py`
   Fournit des evenements Meta bruts mockes et produit des JSON enrichis finaux.

## Flux de donnees

1. Meta envoie un evenement webhook brut.
2. `webhook_receiver.py` verifie la signature `X-Hub-Signature-256` si `META_APP_SECRET` est configure.
3. `event_parser.py` identifie tous les types d'interaction supportes dans chaque `entry/change` :
   `Instagram comment`, `Instagram DM`, `Facebook Page comment`, `Facebook Group comment`, `Facebook DM`.
4. `pipeline.py` construit un `InteractionContext` pour chaque interaction.
5. `meta_api_client.py` recupere les details complets via la Graph API.
6. `normalizer.py` genere le format canonique avec les champs obligatoires.
7. `llm_classifier.py` enrichit avec :
   `sentiment_label`, `emotion_label`, `category_main`, `category_labels`, `problem_detected`,
   `problem_labels`, `problem_summary`, `is_urgent`, `urgency_reason`,
   `recommended_solution`, `solution_labels`, `suggested_reply`, `suggested_reply_options`.
8. `csv_exporter.py` ajoute chaque interaction enrichie dans un CSV.
9. Le pipeline retourne une liste de JSON enrichis si Meta envoie plusieurs interactions dans un seul webhook.

## Export CSV

Toutes les donnees collectees et enrichies sont automatiquement enregistrees dans un fichier CSV.

Chemin par defaut :
`data_collection/outputs/collected_interactions.csv`

Regles d'export :
- chaque interaction enrichie ajoute une ligne
- les champs liste comme `category_labels`, `problem_labels`, `solution_labels` ou `suggested_reply_options` sont aplatis avec ` | `
- le CSV est cree automatiquement si le fichier n'existe pas

## Contexte du post

Le JSON canonique porte aussi le contexte du post d'origine quand il est disponible :
- `post_link`
- `post_description`
- `nb_comments`

Ces champs sont surtout utiles pour les commentaires publics.
Pour les DMs, ils peuvent rester vides ou a `null`.

## Regle d'urgence metier

L'urgence n'est pas determinee uniquement par un sentiment negatif.

Le classifieur doit marquer un message comme urgent si le contenu evoque par exemple :
- un danger ou un risque pour la sante
- un bebe en detresse ou malade
- une allergie, une infection, un saignement, une reaction severe
- un sujet sensible necessitant une revue prioritaire

## Variables d'environnement

```env
META_VERIFY_TOKEN=change-me
META_APP_SECRET=your-meta-app-secret
META_ACCESS_TOKEN=meta-long-lived-token
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash
CSV_OUTPUT_PATH=./data_collection/outputs/collected_interactions.csv
```

Tu peux creer un fichier local `data_collection/.env` a partir de `data_collection/.env.example`.

Exemple :

```env
META_VERIFY_TOKEN=my_webhook_verify_token
META_APP_SECRET=your_meta_app_secret
META_ACCESS_TOKEN=EAAB...
META_GRAPH_VERSION=v20.0
META_GRAPH_BASE_URL=https://graph.facebook.com
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-1.5-flash
CSV_OUTPUT_PATH=./data_collection/outputs/collected_interactions.csv
```

Important :
- ne mets jamais le mot de passe Facebook ou Instagram ici
- mets uniquement les tokens Meta et la cle API LLM
- `META_ACCESS_TOKEN` doit etre un token autorise pour lire les messages/commentaires selon les permissions accordees par Meta
- `META_APP_SECRET` permet de verifier que le webhook vient bien de Meta
- `CSV_OUTPUT_PATH` permet de choisir le fichier CSV de sortie

## Lancer les exemples

```bash
python -m data_collection.examples
```

## Lancer le receiver webhook

```bash
uvicorn data_collection.webhook_receiver:app --reload
```

## Exemple de JSON enrichi

```json
{
  "id": "msg_000145",
  "platform": "instagram",
  "source_type": "public_comment",
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
  "category_main": "prix",
  "category_labels": ["prix", "disponibilite"],
  "problem_detected": "prix_trop_eleve",
  "problem_labels": ["prix_trop_eleve", "rupture_de_stock"],
  "problem_summary": "Cliente frustree par l'indisponibilite frequente et le prix percu comme eleve.",
  "is_urgent": false,
  "urgency_reason": "",
  "recommended_solution": "Remonter le cas a l'equipe distribution et communiquer les points de vente disponibles.",
  "solution_labels": ["ameliorer_communication_prix", "remonter_equipe_distribution"],
  "suggested_reply": "Merci pour votre retour. Nous sommes desoles pour cette indisponibilite. Nous transmettons l'information a notre equipe concernee.",
  "suggested_reply_options": [
    "Merci pour votre retour. Nous sommes desoles pour cette indisponibilite. Nous transmettons l'information a notre equipe concernee.",
    "Merci pour votre message. Nous faisons remonter ce point a l'equipe concernee afin de verifier la disponibilite.",
    "Nous sommes desoles pour cette situation et partageons votre retour avec notre equipe distribution."
  ],
  "status": "non-treated"
}
```
