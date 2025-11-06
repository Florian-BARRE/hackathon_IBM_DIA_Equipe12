import re
from loggerplusplus import LoggerClass


class PromptComputer(LoggerClass):
    def __init__(self):
        super().__init__()

    @staticmethod
    def _tokenize_words(text: str) -> list[str]:
        """
        Tokenize words using word boundaries.
        Includes letters, digits, and underscore. Unicode aware.
        """
        return re.findall(r"\b\w+\b", text, flags=re.UNICODE)

    @staticmethod
    def _split_sentences(text: str) -> list[str]:
        """
        Split sentences on ., !, ? (one or more), keep non-empty trimmed pieces.
        """
        raw = re.split(r"[.!?]+", text)
        return [s.strip() for s in raw if s.strip()]

    def compute(self, prompt: str) -> dict[str, int | float]:
        """Compute requested text statistics for the current prompt."""
        text = prompt

        words = self._tokenize_words(text)
        word_count = len(words)

        avg_word_length = (
            sum(len(w) for w in words) / word_count if word_count else 0.0
        )

        sentences = self._split_sentences(text)
        sentence_count = len(sentences)
        sentence_lengths = [len(self._tokenize_words(s)) for s in sentences]
        avg_sentence_length = (
            sum(sentence_lengths) / sentence_count if sentence_count else 0.0
        )
        avg_sentence_length_cubed = avg_sentence_length ** 3

        question_marks = text.count("?")
        exclamation_marks = text.count("!")

        result = {
            "word_count": word_count,
            "avg_word_length": avg_word_length,
            "avg_sentence_length": avg_sentence_length,
            "avg_sentence_length_cubed": avg_sentence_length_cubed,
            "question_marks": question_marks,
            "exclamation_marks": exclamation_marks,
        }

        self.logger.debug(
            "📊 Computed metrics: "
            f"words={word_count}, "
            f"avg_word_len={avg_word_length:.3f}, "
            f"avg_sent_len={avg_sentence_length:.3f}, "
            f"avg_sent_len_cubed={avg_sentence_length_cubed:.3f}, "
            f"?={question_marks}, !={exclamation_marks}"
        )

        return result
