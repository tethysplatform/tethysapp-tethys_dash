from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping

import numpy as np
from numpy.typing import NDArray
from sentence_transformers import SentenceTransformer

FloatArray = NDArray[np.float32]


@dataclass(frozen=True)
class IntentPrediction:
    intent: str | None
    score: float
    second_best_score: float
    margin: float
    accepted: bool

class EmbeddingIntentClassifier:
    def __init__(
        self,
        intents: Mapping[str, list[str]],
        # bge-base separates this domain better than MiniLM (0 misroutes
        # vs 3 on the eval set); ~418 MB weights, loaded once. Thresholds
        # calibrated against the held-out eval set with max-over-examples
        # scoring - low score floor is fine because the margin gate is
        # what rejects out-of-scope (ambiguous prompts have small margins).
        model_name: str = "BAAI/bge-base-en-v1.5",
        minimum_score: float = 0.25,
        minimum_margin: float = 0.03,
    ) -> None:
        if len(intents) < 2:
            raise ValueError("At least two intents are required.")

        for intent, examples in intents.items():
            if not examples:
                raise ValueError(f"Intent {intent!r} has no examples.")

        self.intents = dict(intents)
        self.minimum_score = minimum_score
        self.minimum_margin = minimum_margin
        self.model = SentenceTransformer(model_name)

        self._intent_names = list(self.intents)
        self.intent_embeddings = self._build_intent_embeddings()

    def _build_intent_embeddings(self) -> list[FloatArray]:
        """
        Keep every example's normalized embedding, one matrix per intent.

        Scoring is max-over-examples (nearest single example), NOT a mean
        centroid. Averaging blurs intents whose examples are diverse
        (e.g. docs spans variable-inputs / layers / permissions), pushing
        the centroid into empty space so nothing matches well. With
        max-over-examples a query only has to be close to ONE example.
        """
        matrices: list[FloatArray] = []

        for intent_name in self._intent_names:
            embeddings = self.model.encode(
                self.intents[intent_name],
                normalize_embeddings=True,
                convert_to_numpy=True,
            ).astype(np.float32)
            matrices.append(embeddings)

        return matrices

    def classify(self, text: str) -> IntentPrediction:
        if not text.strip():
            return IntentPrediction(
                intent=None,
                score=0.0,
                second_best_score=0.0,
                margin=0.0,
                accepted=False,
            )

        query_embedding = self.model.encode(
            [text],
            normalize_embeddings=True,
            convert_to_numpy=True,
        )[0].astype(np.float32)

        # Normalized vectors -> dot == cosine. Score each intent by its
        # nearest single example (max over that intent's examples).
        scores = np.array(
            [
                float((matrix @ query_embedding).max())
                for matrix in self.intent_embeddings
            ],
            dtype=np.float32,
        )
        sorted_indices = np.argsort(scores)[::-1]

        best_index = int(sorted_indices[0])
        second_index = int(sorted_indices[1])

        best_score = float(scores[best_index])
        second_score = float(scores[second_index])
        margin = best_score - second_score

        accepted = (
            best_score >= self.minimum_score
            and margin >= self.minimum_margin
        )

        return IntentPrediction(
            intent=self._intent_names[best_index] if accepted else None,
            score=best_score,
            second_best_score=second_score,
            margin=margin,
            accepted=accepted,
        )