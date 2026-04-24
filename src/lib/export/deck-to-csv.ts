import type { Deck } from "@/lib/flashcard/types";

function escapeCsvCell(cell: string): string {
  if (cell.includes(",") || cell.includes('"') || cell.includes("\n") || cell.includes("\r")) {
    return '"' + cell.replace(/"/g, '""') + '"';
  }
  return cell;
}

export function deckToCsv(deck: Deck): string {
  const lines: string[] = [];
  lines.push("front,back,tags");
  for (const card of deck.cards) {
    const front = escapeCsvCell(card.front);
    const back = escapeCsvCell(card.back);
    const tags = escapeCsvCell(card.tags.join(" "));
    lines.push(`${front},${back},${tags}`);
  }
  return lines.join("\n");
}
