import type { Deck, Card } from "@/lib/flashcard/types";

function cardToHtml(card: Card): string {
  const front = escapeHtml(card.front).replace(/\n/g, "<br>");
  const back = escapeHtml(card.back).replace(/\n/g, "<br>");
  const extra = card.extra ? escapeHtml(card.extra).replace(/\n/g, "<br>") : "";

  return `
    <div class="card">
      <div class="front">
        <div class="label">Question</div>
        <div class="content">${front}</div>
      </div>
      <div class="divider"></div>
      <div class="back">
        <div class="label">Answer</div>
        <div class="content">${back}</div>
        ${extra ? `<div class="extra">${extra}</div>` : ""}
      </div>
      <div class="tags">${card.tags.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildDeckPdfHtml(deck: Deck): string {
  const cardsHtml = deck.cards.map(cardToHtml).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(deck.name)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 24px;
      background: #fff;
      color: #1a1a1a;
      line-height: 1.5;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin: 0 0 16px;
      padding-bottom: 12px;
      border-bottom: 2px solid #e5e5e5;
    }
    .meta {
      font-size: 12px;
      color: #666;
      margin-bottom: 24px;
    }
    .card {
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .label {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #888;
      margin-bottom: 6px;
    }
    .content {
      font-size: 15px;
      font-weight: 500;
    }
    .divider {
      height: 1px;
      background: #e5e5e5;
      margin: 14px 0;
    }
    .extra {
      margin-top: 10px;
      font-size: 13px;
      color: #555;
      padding: 10px;
      background: #f8f8f8;
      border-radius: 8px;
    }
    .tags {
      margin-top: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .tag {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 999px;
      background: #f0f0f0;
      color: #555;
    }
    @media print {
      body { padding: 16px; }
      .card { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(deck.name)}</h1>
  <div class="meta">${deck.cards.length} cards · ${deck.subject ? escapeHtml(deck.subject) : "No subject"}</div>
  ${cardsHtml}
</body>
</html>`;
}
