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
    "category_labels",
    "problem_labels",
    "problem_summary",
    "is_urgent",
    "urgency_reason",
    "recommended_solution",
    "suggested_reply",
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

@dataclass
class LLMClassifier:
    api_key: str = settings.gemini_api_key
    model: str = settings.gemini_model

    def classify(
        self, platform: str, source_type: str, content_text: str
    ) -> Dict[str, Any]:
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
sentiment_label, emotion_label, category_labels, problem_labels, problem_summary, is_urgent, urgency_reason, recommended_solution, suggested_reply

Contraintes:
- sentiment_label in [positif, neutre, negatif]
- emotion_label in [satisfaction, frustration, confiance, colere, deception, neutre]
- category_labels: une seule valeur parmi [prix, disponibilite, qualite, confort, absorption, service_client, autre]
- problem_labels: tableau de une ou plusieurs valeurs parmi [rupture_de_stock, prix_trop_eleve, defaut_qualite, inconfort_utilisation, probleme_absorption, absence_reponse_service_client, autre]
- is_urgent: true si le message evoque un danger, un risque pour la sante, un bebe en detresse, un probleme sensible, ou un cas serieux
- l'urgence ne depend pas uniquement d'un sentiment negatif
- urgency_reason: phrase courte expliquant pourquoi le message est urgent, sinon chaine vide
- problem_summary: phrase courte et claire
- recommended_solution: tableau de une ou plusieurs actions exploitables en francais
- recommended_solution[i] doit correspondre a problem_labels[i]
- suggested_reply: court, poli, empathique, professionnel, en francais

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
        detected_categories = [
            name for name, keywords in KEYWORD_RULES.items()
            if any(keyword in text for keyword in keywords)
        ]
        if not detected_categories:
            detected_categories = ["autre"]
        category = detected_categories[0]

        sentiment = "neutre"
        if any(token in text for token in ["bien", "merci", "satisfait", "excellent", "mli7"]):
            sentiment = "positif"
        if any(token in text for token in ["cher", "decu", "mauvais", "introuvable", "probleme", "ghali", "ma l9itch"]):
            sentiment = "negatif"

        problem_labels = [PROBLEM_BY_CATEGORY.get(cat, "autre") for cat in detected_categories]
        if not problem_labels:
            problem_labels = ["autre"]

        is_urgent = any(token in text for token in URGENT_KEYWORDS)
        urgency_reason = ""
        if is_urgent:
            urgency_reason = self._build_urgency_reason(text, category)

        emotion = "neutre"
        if sentiment == "positif":
            emotion = "satisfaction"
        elif any(label != "autre" for label in problem_labels):
            emotion = "frustration"
        if is_urgent and any(token in text for token in ["grave", "danger", "inadmissible"]):
            emotion = "colere"

        summary = self._build_problem_summary(category, sentiment, content_text)
        solution = self._build_solution(problem_labels, is_urgent)
        reply = self._build_reply(category, sentiment, is_urgent)

        return self._sanitize_result(
            {
                "sentiment_label": sentiment,
                "emotion_label": emotion,
                "category_labels": category,
                "problem_labels": problem_labels,
                "problem_summary": summary,
                "is_urgent": is_urgent,
                "urgency_reason": urgency_reason,
                "recommended_solution": solution,
                "suggested_reply": reply,
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

    def _build_solution(self, problem_labels: list[str], is_urgent: bool) -> list[str]:
        solutions: list[str] = []
        mapped = {
            "prix_trop_eleve": "Ameliorer la communication sur le prix et partager les formats les plus adaptes.",
            "rupture_de_stock": "Remonter le cas a l'equipe distribution et verifier la disponibilite locale.",
            "defaut_qualite": "Escalader a l'equipe qualite pour verification du lot ou du produit.",
            "inconfort_utilisation": "Transmettre le retour au support client et verifier l'usage recommande.",
            "probleme_absorption": "Faire remonter le cas a l'equipe qualite produit pour investigation.",
            "absence_reponse_service_client": "Transmettre au support client pour reprise de contact rapide.",
            "autre": "Faire une revue manuelle pour orienter le message vers la bonne equipe.",
        }
        for problem in problem_labels:
            if is_urgent:
                solutions.append(
                    "Escalader immediatement au support senior et a l'equipe qualite pour revue prioritaire du cas."
                )
                is_urgent = False
            solution = mapped.get(problem, mapped["autre"])
            solutions.append(solution)
        return solutions or ["Faire une revue manuelle pour orienter le message vers la bonne equipe."]

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

    def _sanitize_result(self, result: Dict[str, Any]) -> Dict[str, Any]:
        sanitized = {field: result.get(field, "") for field in CLASSIFICATION_FIELDS}
        sanitized["sentiment_label"] = str(sanitized["sentiment_label"]).strip()
        sanitized["emotion_label"] = str(sanitized["emotion_label"]).strip()
        sanitized["category_labels"] = str(sanitized["category_labels"]).strip()
        sanitized["problem_summary"] = str(sanitized["problem_summary"]).strip()
        sanitized["urgency_reason"] = str(sanitized["urgency_reason"]).strip()
        sanitized["suggested_reply"] = str(sanitized["suggested_reply"]).strip()
        raw_problem_labels = sanitized.get("problem_labels", [])
        raw_recommended_solution = sanitized.get("recommended_solution", [])
        if not isinstance(raw_problem_labels, list):
            raw_problem_labels = [raw_problem_labels]
        if not isinstance(raw_recommended_solution, list):
            raw_recommended_solution = [raw_recommended_solution]
        sanitized["problem_labels"] = [
            str(value).strip() for value in raw_problem_labels if str(value).strip()
        ]
        sanitized["recommended_solution"] = [
            str(value).strip()
            for value in raw_recommended_solution
            if str(value).strip()
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
        if sanitized["category_labels"] not in {
            "prix",
            "disponibilite",
            "qualite",
            "confort",
            "absorption",
            "service_client",
            "autre",
        }:
            sanitized["category_labels"] = "autre"
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
            sanitized["problem_labels"] = ["autre"]
        if not sanitized["problem_summary"]:
            sanitized["problem_summary"] = "Analyse incomplete."
        sanitized["is_urgent"] = bool(sanitized["is_urgent"])
        if not sanitized["recommended_solution"]:
            sanitized["recommended_solution"] = self._build_solution(
                sanitized["problem_labels"], sanitized["is_urgent"]
            )
        if len(sanitized["recommended_solution"]) != len(sanitized["problem_labels"]):
            sanitized["recommended_solution"] = self._build_solution(
                sanitized["problem_labels"], sanitized["is_urgent"]
            )
        if not sanitized["suggested_reply"]:
            sanitized["suggested_reply"] = "Merci pour votre message. Nous revenons vers vous rapidement."
        return sanitized
