import type { FlashcardGenCandidate } from "./types";

export function extractWordTokens(text: string): Set<string> {
  const tokens = new Set<string>();
  const matches = text.toLowerCase().match(/\b[a-z0-9]+\b/g);
  if (matches) {
    for (const token of matches) tokens.add(token);
  }
  return tokens;
}

export function answerTextForGuardrail(card: FlashcardGenCandidate): string {
  if (card.model === "cloze") {
    const parts: string[] = [];
    const re = /\{\{c\d+::([^}]+?)(?:::[^}]*)?\}\}/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(card.front))) {
      const span = match[1];
      if (span) parts.push(span);
    }
    return parts.join(" ");
  }

  return `${card.back} ${card.extra ?? ""}`;
}

export function findAnswerTokenSubsetViolations(params: {
  sourceMarkdown: string;
  cards: FlashcardGenCandidate[];
}): string[] {
  const sourceTokens = extractWordTokens(params.sourceMarkdown);
  const violations = new Set<string>();

  for (const card of params.cards) {
    const answerTokens = extractWordTokens(answerTextForGuardrail(card));
    for (const token of answerTokens) {
      if (!sourceTokens.has(token)) violations.add(token);
    }
  }

  return [...violations];
}
