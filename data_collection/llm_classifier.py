from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any, Dict

import requests

from .config import settings


CLASSIFICATION_FIELDS = [
    "sentiment_label",
    "emotion_label",
    "category_main",
    "category_labels",
    "problem_detected",
    "problem_labels",
    "problem_summary",
    "is_urgent",
    "urgency_reason",
    "recommended_solution",
    "solution_labels",
    "suggested_reply",
    "suggested_reply_options",
]


KEYWORD_RULES = {
    "prix": ["cher", "prix", "couteux", "ghali"],
    "disponibilite": ["introuvable", "rupture", "indisponible", "stock", "ma l9itch"],
    "qualite": ["qualite", "defaut", "fuite", "quality"],
    "confort": ["inconfort", "gene", "irritation", "hurt", "douleur"],
    "absorption": ["absorption", "n'absorbe pas", "absorbe pas", "leak", "tasarab"],
    "service_client": ["service client", "support", "aucune reponse", "messenger"],
}

URGENT_KEYWORDS = [
    "danger",
    "dangereux",
    "grave",
    "urgent",
    "urgence",
    "saignement",
    "sang",
    "allergie",
    "allergique",
    "infection",
    "brulure",
    "brule",
    "irritation severe",
    "reaction",
    "hopital",
    "medecin",
    "bebe malade",
    "risque",
    "toxique",
    "etouffe",
]

PROBLEM_BY_CATEGORY = {
    "prix": "prix_trop_eleve",
    "disponibilite": "rupture_de_stock",
    "qualite": "defaut_qualite",
    "confort": "inconfort_utilisation",
    "absorption": "probleme_absorption",
    "service_client": "absence_reponse_service_client",
    "autre": "autre",
}

SOLUTION_BY_CATEGORY = {
    "prix": "ameliorer_communication_prix",
    "disponibilite": "remonter_equipe_distribution",
    "qualite": "escalader_equipe_qualite",
    "confort": "transmettre_support_client",
    "absorption": "investigation_qualite_produit",
    "service_client": "reprendre_contact_support",
    "autre": "analyse_manuelle",
}


@dataclass
class LLMClassifier:
    api_key: str = settings.gemini_api_key
    model: str = settings.gemini_model

    def classify(
        self, platform: str, source_type: str, content_text: str
    ) -> Dict[str, str]:
        if self.api_key:
            try:
                return self._classify_with_gemini(platform, source_type, content_text)
            except Exception:
                return self._classify_with_rules(content_text)
        return self._classify_with_rules(content_text)

    def _classify_with_gemini(
        self, platform: str, source_type: str, content_text: str
    ) -> Dict[str, str]:
        prompt = f"""
Tu es un classifieur SAV social media pour CanBebe.
Retourne uniquement un JSON valide avec ces champs exacts:
sentiment_label, emotion_label, category_main, category_labels, problem_detected, problem_labels, problem_summary, is_urgent, urgency_reason, recommended_solution, solution_labels, suggested_reply, suggested_reply_options

Contraintes:
- sentiment_label in [positif, neutre, negatif]
- emotion_label in [satisfaction, frustration, confiance, colere, deception, neutre]
- category_main in [prix, disponibilite, qualite, confort, absorption, service_client, autre]
- category_labels: tableau de une ou plusieurs valeurs parmi [prix, disponibilite, qualite, confort, absorption, service_client, autre]
- `category_main` est la categorie principale
- `category_labels` peut contenir plusieurs categories si le message parle de prix et disponibilite en meme temps
- problem_detected in [rupture_de_stock, prix_trop_eleve, defaut_qualite, inconfort_utilisation, probleme_absorption, absence_reponse_service_client, autre]
- problem_labels: tableau de une ou plusieurs valeurs parmi [rupture_de_stock, prix_trop_eleve, defaut_qualite, inconfort_utilisation, probleme_absorption, absence_reponse_service_client, autre]
- `problem_detected` est le probleme principal
- is_urgent: true si le message evoque un danger, un risque pour la sante, un bebe en detresse, un probleme sensible, ou un cas serieux
- l'urgence ne depend pas uniquement d'un sentiment negatif
- urgency_reason: phrase courte expliquant pourquoi le message est urgent, sinon chaine vide
- problem_summary: phrase courte et claire
- recommended_solution: action principale exploitable
- solution_labels: tableau de une ou plusieurs actions metier courtes
- suggested_reply: court, poli, empathique, professionnel, en francais
- suggested_reply_options: tableau de 2 a 4 variantes courtes et professionnelles en francais

Contexte:
platform={platform}
source_type={source_type}
content_text={content_text}
""".strip()

        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent",
            params={"key": self.api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json"},
            },
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
        return self._sanitize_result(parsed)

    def _classify_with_rules(self, content_text: str) -> Dict[str, str]:
        text = content_text.lower()
        category_labels = [
            name for name, keywords in KEYWORD_RULES.items()
            if any(keyword in text for keyword in keywords)
        ]
        if not category_labels:
            category_labels = ["autre"]
        category = category_labels[0]

        sentiment = "neutre"
        if any(token in text for token in ["bien", "merci", "satisfait", "excellent", "mli7"]):
            sentiment = "positif"
        if any(token in text for token in ["cher", "decu", "mauvais", "introuvable", "probleme", "ghali", "ma l9itch"]):
            sentiment = "negatif"

        problem_labels = [PROBLEM_BY_CATEGORY.get(cat, "autre") for cat in category_labels]
        if not problem_labels:
            problem_labels = ["autre"]
        problem_detected = problem_labels[0]

        is_urgent = any(token in text for token in URGENT_KEYWORDS)
        urgency_reason = ""
        if is_urgent:
            urgency_reason = self._build_urgency_reason(text, category)

        emotion = "neutre"
        if sentiment == "positif":
            emotion = "satisfaction"
        elif problem_detected != "autre":
            emotion = "frustration"
        if is_urgent and any(token in text for token in ["grave", "danger", "inadmissible"]):
            emotion = "colere"

        summary = self._build_problem_summary(category, sentiment, content_text)
        solution_labels = self._build_solution_labels(category_labels, is_urgent)
        solution = self._build_solution(category, is_urgent)
        reply = self._build_reply(category, sentiment, is_urgent)
        reply_options = self._build_reply_options(category, sentiment, is_urgent)

        return self._sanitize_result(
            {
                "sentiment_label": sentiment,
                "emotion_label": emotion,
                "category_main": category,
                "category_labels": category_labels,
                "problem_detected": problem_detected,
                "problem_labels": problem_labels,
                "problem_summary": summary,
                "is_urgent": is_urgent,
                "urgency_reason": urgency_reason,
                "recommended_solution": solution,
                "solution_labels": solution_labels,
                "suggested_reply": reply,
                "suggested_reply_options": reply_options,
            }
        )

    def _build_problem_summary(self, category: str, sentiment: str, text: str) -> str:
        text = re.sub(r"\s+", " ", text).strip()
        if category == "prix":
            return "Cliente insatisfaite du prix percu comme trop eleve."
        if category == "disponibilite":
            return "Cliente frustree par l'indisponibilite ou la rupture de stock du produit."
        if category == "qualite":
            return "Cliente signale un probleme de qualite ou un defaut produit."
        if category == "confort":
            return "Cliente remonte un inconfort lie a l'utilisation du produit."
        if category == "absorption":
            return "Cliente exprime un probleme d'absorption du produit."
        if category == "service_client":
            return "Cliente indique un manque de reponse du service client."
        if sentiment == "positif":
            return "Retour globalement positif sans probleme principal detecte."
        return f"Interaction a analyser plus finement: {text[:90]}".strip()

    def _build_urgency_reason(self, text: str, category: str) -> str:
        if any(token in text for token in ["allergie", "allergique", "reaction", "infection", "brulure", "brule"]):
            return "Le message signale un risque sante ou une reaction sensible concernant le bebe ou le produit."
        if any(token in text for token in ["saignement", "sang", "hopital", "medecin", "bebe malade"]):
            return "Le message mentionne un cas potentiellement medical ou une situation sensible liee au bebe."
        if any(token in text for token in ["danger", "dangereux", "grave", "toxique", "risque"]):
            return "Le message evoque un danger ou un risque serieux necessitant une revue prioritaire."
        return f"Le message doit etre traite en priorite en raison de sa sensibilite ({category})."

    def _build_solution(self, category: str, is_urgent: bool) -> str:
        if is_urgent:
            return "Escalader immediatement au support senior et a l'equipe qualite pour revue prioritaire du cas."
        return {
            "prix": "Ameliorer la communication sur le prix et partager les formats les plus adaptes.",
            "disponibilite": "Remonter le cas a l'equipe distribution et verifier la disponibilite locale.",
            "qualite": "Escalader a l'equipe qualite pour verification du lot ou du produit.",
            "confort": "Transmettre le retour au support client et verifier l'usage recommande.",
            "absorption": "Faire remonter le cas a l'equipe qualite produit pour investigation.",
            "service_client": "Transmettre au support client pour reprise de contact rapide.",
            "autre": "Faire une revue manuelle pour orienter le message vers la bonne equipe.",
        }[category]

    def _build_solution_labels(self, category_labels: list[str], is_urgent: bool) -> list[str]:
        labels = [SOLUTION_BY_CATEGORY.get(cat, "analyse_manuelle") for cat in category_labels]
        if is_urgent:
            labels = ["escalade_prioritaire_support_qualite"] + labels
        deduped: list[str] = []
        for label in labels:
            if label not in deduped:
                deduped.append(label)
        return deduped or ["analyse_manuelle"]

    def _build_reply(self, category: str, sentiment: str, is_urgent: bool) -> str:
        if is_urgent:
            return "Merci pour votre message. Nous prenons cette situation tres au serieux et la transmettons immediatement a l'equipe concernee."
        if sentiment == "positif":
            return "Merci beaucoup pour votre retour positif, cela nous fait plaisir."
        if category == "disponibilite":
            return "Merci pour votre retour. Nous sommes desoles pour cette indisponibilite et transmettons l'information a notre equipe."
        if category == "prix":
            return "Merci pour votre retour. Nous comprenons votre remarque et la partageons avec l'equipe concernee."
        if category == "qualite":
            return "Merci pour votre message. Nous sommes desoles et transmettons votre retour a notre equipe qualite."
        if category == "service_client":
            return "Merci pour votre message. Nous sommes desoles pour ce delai et faisons le necessaire pour revenir vers vous."
        return "Merci pour votre retour. Nous prenons bien en compte votre message et le partageons avec l'equipe concernee."

    def _build_reply_options(self, category: str, sentiment: str, is_urgent: bool) -> list[str]:
        if is_urgent:
            return [
                "Merci pour votre message. Nous prenons cette situation tres au serieux et la transmettons immediatement a l'equipe concernee.",
                "Merci de nous avoir ecrit. Votre retour est prioritaire et notre equipe va l'examiner sans delai.",
                "Nous sommes desoles pour cette situation. Le cas est transmis en priorite a l'equipe concernee.",
            ]
        if sentiment == "positif":
            return [
                "Merci beaucoup pour votre retour positif, cela nous fait plaisir.",
                "Merci pour votre confiance et pour ce retour encourageant.",
                "Nous vous remercions sincerement pour votre message positif.",
            ]
        if category == "disponibilite":
            return [
                "Merci pour votre retour. Nous sommes desoles pour cette indisponibilite et transmettons l'information a notre equipe.",
                "Merci pour votre message. Nous faisons remonter ce point a l'equipe concernee afin de verifier la disponibilite.",
                "Nous sommes desoles pour cette situation et partageons votre retour avec notre equipe distribution.",
            ]
        if category == "prix":
            return [
                "Merci pour votre retour. Nous comprenons votre remarque et la partageons avec l'equipe concernee.",
                "Merci pour votre message. Votre remarque sur le prix est bien prise en compte.",
                "Nous vous remercions pour votre retour et transmettons votre remarque a l'equipe concernee.",
            ]
        if category == "qualite":
            return [
                "Merci pour votre message. Nous sommes desoles et transmettons votre retour a notre equipe qualite.",
                "Merci pour votre signalement. Nous partageons ce retour avec notre equipe qualite pour verification.",
                "Nous sommes desoles pour cette situation et faisons suivre votre message a l'equipe concernee.",
            ]
        if category == "service_client":
            return [
                "Merci pour votre message. Nous sommes desoles pour ce delai et faisons le necessaire pour revenir vers vous.",
                "Merci pour votre retour. Nous transmettons votre message au support afin qu'un suivi soit assure rapidement.",
                "Nous sommes desoles pour cette experience et revenons vers vous des que possible.",
            ]
        return [
            "Merci pour votre retour. Nous prenons bien en compte votre message et le partageons avec l'equipe concernee.",
            "Merci pour votre message. Votre retour est bien pris en compte par notre equipe.",
            "Nous vous remercions pour votre retour et le transmettons a l'equipe concernee.",
        ]

    def _sanitize_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        sanitized = {field: result.get(field, "") for field in CLASSIFICATION_FIELDS}
        sanitized["sentiment_label"] = str(sanitized["sentiment_label"]).strip()
        sanitized["emotion_label"] = str(sanitized["emotion_label"]).strip()
        sanitized["category_main"] = str(sanitized["category_main"]).strip()
        sanitized["problem_detected"] = str(sanitized["problem_detected"]).strip()
        sanitized["problem_summary"] = str(sanitized["problem_summary"]).strip()
        sanitized["urgency_reason"] = str(sanitized["urgency_reason"]).strip()
        sanitized["recommended_solution"] = str(sanitized["recommended_solution"]).strip()
        sanitized["suggested_reply"] = str(sanitized["suggested_reply"]).strip()
        raw_category_labels = sanitized.get("category_labels", [])
        raw_problem_labels = sanitized.get("problem_labels", [])
        raw_solution_labels = sanitized.get("solution_labels", [])
        raw_reply_options = sanitized.get("suggested_reply_options", [])
        if not isinstance(raw_category_labels, list):
            raw_category_labels = [raw_category_labels]
        if not isinstance(raw_problem_labels, list):
            raw_problem_labels = [raw_problem_labels]
        if not isinstance(raw_solution_labels, list):
            raw_solution_labels = [raw_solution_labels]
        if not isinstance(raw_reply_options, list):
            raw_reply_options = [raw_reply_options]
        sanitized["category_labels"] = [
            str(value).strip() for value in raw_category_labels if str(value).strip()
        ]
        sanitized["problem_labels"] = [
            str(value).strip() for value in raw_problem_labels if str(value).strip()
        ]
        sanitized["solution_labels"] = [
            str(value).strip() for value in raw_solution_labels if str(value).strip()
        ]
        sanitized["suggested_reply_options"] = [
            str(value).strip() for value in raw_reply_options if str(value).strip()
        ]
        if sanitized["sentiment_label"] not in {"positif", "neutre", "negatif"}:
            sanitized["sentiment_label"] = "neutre"
        if sanitized["emotion_label"] not in {
            "satisfaction",
            "frustration",
            "confiance",
            "colere",
            "deception",
            "neutre",
        }:
            sanitized["emotion_label"] = "neutre"
        if sanitized["category_main"] not in {
            "prix",
            "disponibilite",
            "qualite",
            "confort",
            "absorption",
            "service_client",
            "autre",
        }:
            sanitized["category_main"] = "autre"
        sanitized["category_labels"] = [
            value for value in sanitized["category_labels"]
            if value in {
                "prix",
                "disponibilite",
                "qualite",
                "confort",
                "absorption",
                "service_client",
                "autre",
            }
        ]
        if not sanitized["category_labels"]:
            sanitized["category_labels"] = [sanitized["category_main"]]
        if not sanitized["problem_detected"]:
            sanitized["problem_detected"] = "autre"
        sanitized["problem_labels"] = [
            value for value in sanitized["problem_labels"]
            if value in {
                "rupture_de_stock",
                "prix_trop_eleve",
                "defaut_qualite",
                "inconfort_utilisation",
                "probleme_absorption",
                "absence_reponse_service_client",
                "autre",
            }
        ]
        if not sanitized["problem_labels"]:
            sanitized["problem_labels"] = [sanitized["problem_detected"]]
        if not sanitized["problem_summary"]:
            sanitized["problem_summary"] = "Analyse incomplete."
        sanitized["is_urgent"] = bool(sanitized["is_urgent"])
        if not sanitized["recommended_solution"]:
            sanitized["recommended_solution"] = "Faire une revue manuelle."
        if not sanitized["solution_labels"]:
            sanitized["solution_labels"] = ["analyse_manuelle"]
        if not sanitized["suggested_reply"]:
            sanitized["suggested_reply"] = "Merci pour votre message. Nous revenons vers vous rapidement."
        if not sanitized["suggested_reply_options"]:
            sanitized["suggested_reply_options"] = [sanitized["suggested_reply"]]
        return sanitized
