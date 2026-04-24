import type { Deck } from "@/lib/flashcard/types";

export function deckToTsv(deck: Deck): string {
  const lines: string[] = [];
  for (const card of deck.cards) {
    const front = card.front.replace(/\t/g, " ").replace(/\n/g, " ");
    const back = card.back.replace(/\t/g, " ").replace(/\n/g, " ");
    const tags = card.tags.join(" ");
    lines.push(`${front}\t${back}\t${tags}`);
  }
  return lines.join("\n");
}
