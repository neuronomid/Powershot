import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  LevelFormat,
  TableOfContents,
  type FileChild,
} from "docx";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import type {
  BlockContent,
  DefinitionContent,
  ListItem,
  List as MdList,
  Table as MdTable,
  Root,
  PhrasingContent,
} from "mdast";

import type { ExportTheme } from "@/lib/theme/types";
import {
  BASE_SIZE_PT,
  LINE_SPACING_VAL,
  FONT_CSS,
  PRESET_COLORS,
  PAGE_SIZE_DOCX_TWIPS,
  MARGIN_TWIPS,
} from "@/lib/theme/types";
import { FOOTER_TEXT } from "@/lib/theme/constants";

function fontName(font: string): string {
  // Extract the first quoted font name for docx font field.
  const m = FONT_CSS[font as keyof typeof FONT_CSS]?.match(/^'([^']+)'/);
  return m ? m[1] : font;
}

function ptToHalfPt(pt: number): number {
  return pt * 2;
}

function withOpacity(hex: string, opacity: number): string {
  const r = Math.round(
    parseInt(hex.slice(1, 3), 16) * opacity + 255 * (1 - opacity),
  );
  const g = Math.round(
    parseInt(hex.slice(3, 5), 16) * opacity + 255 * (1 - opacity),
  );
  const b = Math.round(
    parseInt(hex.slice(5, 7), 16) * opacity + 255 * (1 - opacity),
  );
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function countHeadings(root: Root): number {
  let count = 0;
  for (const node of root.children) {
    if (node.type === "heading" && node.depth >= 1 && node.depth <= 3) {
      count++;
    }
  }
  return count;
}

function mdastToDocx(params: {
  root: Root;
  theme: ExportTheme;
}): FileChild[] {
  const { root, theme } = params;
  const basePt = BASE_SIZE_PT[theme.baseSize];
  const lineHeight = LINE_SPACING_VAL[theme.lineSpacing];
  const bodyFont = fontName(theme.bodyFont);

  const baseSizeHalfPt = ptToHalfPt(basePt);
  const spacing = {
    after: Math.round(basePt * 4),
    line: Math.round(lineHeight * 240),
    lineRule: "auto" as const,
  };

  function runOptions(
    opts: { bold?: boolean; italics?: boolean; strike?: boolean; color?: string; text?: string } = {},
  ) {
    return {
      font: bodyFont,
      size: baseSizeHalfPt,
      bold: opts.bold,
      italics: opts.italics,
      strike: opts.strike,
      color: opts.color,
      text: opts.text ?? "",
    };
  }

  function phrasingToRuns(
    nodes: PhrasingContent[],
    inherited: { bold?: boolean; italics?: boolean; strike?: boolean } = {},
  ): TextRun[] {
    const runs: TextRun[] = [];
    for (const node of nodes) {
      switch (node.type) {
        case "text":
          runs.push(new TextRun({ ...runOptions(inherited), text: node.value }));
          break;
        case "emphasis":
          runs.push(...phrasingToRuns(node.children, { ...inherited, italics: true }));
          break;
        case "strong":
          runs.push(...phrasingToRuns(node.children, { ...inherited, bold: true }));
          break;
        case "delete":
          runs.push(...phrasingToRuns(node.children, { ...inherited, strike: true }));
          break;
        case "inlineCode":
          runs.push(
            new TextRun({
              ...runOptions(inherited),
              text: node.value,
              font: fontName("JetBrains Mono"),
              size: Math.round(baseSizeHalfPt * 0.875),
            }),
          );
          break;
        case "link":
          runs.push(
            new TextRun({
              ...runOptions(inherited),
              text: node.children.map((c) => (c.type === "text" ? c.value : "")).join(""),
              color: PRESET_COLORS[theme.preset].accent,
              underline: { type: "single" },
            }),
          );
          break;
        case "break":
          runs.push(new TextRun({ ...runOptions(inherited), text: "", break: 1 }));
          break;
        default:
          // ignore unsupported inline nodes
          break;
      }
    }
    return runs;
  }

  function listItemToParagraphs(item: ListItem, level: number, ordered: boolean): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const children = item.children;

    // First paragraph with bullet/number
    const firstBlock = children[0];
    if (firstBlock?.type === "paragraph") {
      paragraphs.push(
        new Paragraph({
          children: phrasingToRuns(firstBlock.children),
          spacing,
          numbering: {
            reference: ordered ? "ordered-list" : "bullet-list",
            level,
          },
        }),
      );
    } else if (firstBlock) {
      // Non-paragraph first block: create empty bullet + process block
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(runOptions({ text: "" }))],
          spacing,
          numbering: {
            reference: ordered ? "ordered-list" : "bullet-list",
            level,
          },
        }),
      );
      for (const child of blockToChildren(firstBlock)) {
        if (child instanceof Paragraph) paragraphs.push(child);
      }
    }

    // Remaining blocks
    for (let i = 1; i < children.length; i++) {
      const block = children[i];
      if (block.type === "list") {
        paragraphs.push(...listToParagraphs(block, level + 1));
      } else {
        for (const child of blockToChildren(block)) {
          if (child instanceof Paragraph) paragraphs.push(child);
        }
      }
    }

    return paragraphs;
  }

  function listToParagraphs(list: MdList, level = 0): Paragraph[] {
    const ordered = list.ordered ?? false;
    const paragraphs: Paragraph[] = [];
    for (const item of list.children) {
      paragraphs.push(...listItemToParagraphs(item, level, ordered));
    }
    return paragraphs;
  }

  function blockToChildren(
    node: BlockContent | DefinitionContent,
  ): FileChild[] {
    switch (node.type) {
      case "paragraph": {
        return [
          new Paragraph({
            children: phrasingToRuns(node.children),
            spacing,
          }),
        ];
      }
      case "heading": {
        const levelMap: Record<number, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6,
        };
        const heading = levelMap[node.depth] ?? HeadingLevel.HEADING_6;
        return [
          new Paragraph({
            children: phrasingToRuns(node.children, { bold: true }),
            heading,
            spacing: {
              before: Math.round(basePt * 6),
              after: Math.round(basePt * 3),
              line: Math.round(1.25 * 240),
              lineRule: "auto",
            },
          }),
        ];
      }
      case "list": {
        return listToParagraphs(node, 0);
      }
      case "blockquote": {
        const children: FileChild[] = [];
        for (const child of node.children) {
          if (child.type === "paragraph") {
            children.push(
              new Paragraph({
                children: phrasingToRuns(child.children, { italics: true }),
                spacing,
                border: {
                  left: {
                    color: PRESET_COLORS[theme.preset].accent,
                    space: 4,
                    style: BorderStyle.SINGLE,
                    size: 12,
                  },
                },
                indent: { left: 360 },
              }),
            );
          } else {
            children.push(...blockToChildren(child));
          }
        }
        return children;
      }
      case "code": {
        return [
          new Paragraph({
            children: [
              new TextRun({
                text: node.value,
                font: fontName("JetBrains Mono"),
                size: Math.round(baseSizeHalfPt * 0.875),
                color: PRESET_COLORS[theme.preset].foreground,
              }),
            ],
            spacing,
            shading: { fill: PRESET_COLORS[theme.preset].muted },
          }),
        ];
      }
      case "thematicBreak": {
        return [
          new Paragraph({
            children: [],
            border: {
              bottom: {
                color: withOpacity(PRESET_COLORS[theme.preset].foreground, 0.2),
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6,
              },
            },
            spacing: { before: Math.round(basePt * 4), after: Math.round(basePt * 4) },
          }),
        ];
      }
      case "table": {
        return [tableToDocx(node)];
      }
      default:
        return [];
    }
  }

  function tableToDocx(table: MdTable): Table {
    const rows: TableRow[] = [];
    for (const row of table.children) {
      if (row.type !== "tableRow") continue;
      const cells: TableCell[] = [];
      for (const cell of row.children) {
        if (cell.type !== "tableCell") continue;
        const cellChildren: Paragraph[] = [
          new Paragraph({
            children: phrasingToRuns(cell.children as PhrasingContent[]),
            spacing: { after: Math.round(basePt * 2) },
          }),
        ];
        cells.push(
          new TableCell({
            children: cellChildren.length ? cellChildren : [new Paragraph({ children: [] })],
            borders: {
              top: { color: withOpacity(PRESET_COLORS[theme.preset].foreground, 0.19), style: BorderStyle.SINGLE, size: 4 },
              bottom: { color: withOpacity(PRESET_COLORS[theme.preset].foreground, 0.19), style: BorderStyle.SINGLE, size: 4 },
              left: { color: withOpacity(PRESET_COLORS[theme.preset].foreground, 0.19), style: BorderStyle.SINGLE, size: 4 },
              right: { color: withOpacity(PRESET_COLORS[theme.preset].foreground, 0.19), style: BorderStyle.SINGLE, size: 4 },
            },
          }),
        );
      }
      rows.push(new TableRow({ children: cells }));
    }

    return new Table({
      rows,
      width: { size: 100, type: "pct" as const },
    });
  }

  const children: FileChild[] = [];

  // TOC
  const headingCount = countHeadings(root);
  if (theme.includeToc && headingCount >= 3) {
    children.push(
      new TableOfContents("Table of Contents", {
        hyperlink: true,
        headingStyleRange: "1-3",
      }),
    );
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Press Ctrl+A then F9 in Word to refresh the table of contents.",
            italics: true,
            color: PRESET_COLORS[theme.preset].foreground,
            size: Math.round(baseSizeHalfPt * 0.875),
          }),
        ],
        spacing: { after: Math.round(basePt * 6) },
      }),
    );
  }

  for (const node of root.children as (BlockContent | DefinitionContent)[]) {
    if (node.type === "list") {
      children.push(...listToParagraphs(node, 0));
    } else {
      children.push(...blockToChildren(node));
    }
  }

  // Footer
  if (theme.includeFooter) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: FOOTER_TEXT,
            color: PRESET_COLORS[theme.preset].foreground,
            size: Math.round(ptToHalfPt(8)),
          }),
        ],
        alignment: AlignmentType.CENTER,
        spacing: { before: Math.round(basePt * 8) },
      }),
    );
  }

  return children;
}

export async function markdownToDocxBuffer(params: {
  markdown: string;
  title: string;
  theme: ExportTheme;
}): Promise<Buffer> {
  const { markdown, title, theme } = params;

  const parsed = await remark().use(remarkGfm).parse(markdown);
  const children = mdastToDocx({ root: parsed as Root, theme });

  const basePt = BASE_SIZE_PT[theme.baseSize];
  const bodyFont = fontName(theme.bodyFont);
  const headingFont = fontName(theme.headingFont);

  const pageSize = PAGE_SIZE_DOCX_TWIPS[theme.pageSize];
  const margin = MARGIN_TWIPS[theme.margins];

  const doc = new Document({
    title,
    sections: [
      {
        children,
        properties: {
          page: {
            size: {
              width: pageSize.width,
              height: pageSize.height,
            },
            margin: {
              top: margin,
              right: margin,
              bottom: margin,
              left: margin,
            },
          },
        },
      },
    ],
    styles: {
      default: {
        document: {
          run: {
            font: bodyFont,
            size: ptToHalfPt(basePt),
          },
        },
        heading1: {
          run: { font: headingFont, size: ptToHalfPt(basePt * 1.75), bold: true },
        },
        heading2: {
          run: { font: headingFont, size: ptToHalfPt(basePt * 1.4), bold: true },
        },
        heading3: {
          run: { font: headingFont, size: ptToHalfPt(basePt * 1.2), bold: true },
        },
        heading4: {
          run: { font: headingFont, size: ptToHalfPt(basePt * 1.1), bold: true },
        },
        heading5: {
          run: { font: headingFont, size: ptToHalfPt(basePt * 1.05), bold: true },
        },
        heading6: {
          run: { font: headingFont, size: ptToHalfPt(basePt), bold: true },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullet-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2022",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
            {
              level: 1,
              format: LevelFormat.BULLET,
              text: "\u25e6",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 1080, hanging: 360 } },
              },
            },
            {
              level: 2,
              format: LevelFormat.BULLET,
              text: "\u25aa",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 1440, hanging: 360 } },
              },
            },
          ],
        },
        {
          reference: "ordered-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 720, hanging: 360 } },
              },
            },
            {
              level: 1,
              format: LevelFormat.DECIMAL,
              text: "%1.%2.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 1080, hanging: 360 } },
              },
            },
            {
              level: 2,
              format: LevelFormat.DECIMAL,
              text: "%1.%2.%3.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: { indent: { left: 1440, hanging: 360 } },
              },
            },
          ],
        },
      ],
    },
  });

  return Packer.toBuffer(doc);
}
