// ============================================================
// AK RENOVATIONS — Proposal Generator
// Ports the locked Node.js proposal template to the browser
// using the docx npm package. Drop into src/lib/
// ============================================================

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  LevelFormat,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageBreak,
} from "docx";

// ITableCellBorders was removed in newer docx versions — inline the shape
type ITableCellBorders = Record<
  'top' | 'bottom' | 'left' | 'right',
  { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string }
>;

// ── BRAND ────────────────────────────────────────────────────
const NAVY = "1B2B4D";
const RUST = "B7410E";
const WHITE = "FFFFFF";
const RUST_TINT = "FAF1EE";
const W = 9360;

// ── TYPES ────────────────────────────────────────────────────

export interface ScopeBullet {
  label: string;
  desc: string | null;
}

export interface ScopeSection {
  number: string;
  title: string;
  bullets: ScopeBullet[];
}

export interface SelectionItem {
  name: string;
  desc: string;
  shop: string;
}

export interface SelectionCategory {
  label: string;
  items: SelectionItem[];
}

export interface ProposalData {
  clientLastName: string;
  clientFullNames: string;
  address1: string;
  address2: string;
  projectType: string;
  duration: string;
  overviewTitle: string;
  overviewBody: string;
  totalPrice: string;
  sectionRange: string;
  hasAddOn: boolean;
  addOnName: string;
  addOnDetail: string;
  addOnPrice: string;
  estimatedDuration: string;
  phone: string;
  website: string;
  sections: ScopeSection[];
  selections: SelectionCategory[];
}

export const defaultProposalData: ProposalData = {
  clientLastName: "",
  clientFullNames: "",
  address1: "",
  address2: "",
  projectType: "",
  duration: "",
  overviewTitle: "",
  overviewBody: "",
  totalPrice: "",
  sectionRange: "",
  hasAddOn: false,
  addOnName: "",
  addOnDetail: "",
  addOnPrice: "",
  estimatedDuration: "",
  phone: "(330) 942-4242",
  website: "akrenovationsohio.com",
  sections: [],
  selections: [],
};

// ── SCOPE FRAMEWORKS ─────────────────────────────────────────

export const SCOPE_FRAMEWORKS: Record<string, ScopeSection[]> = {
  bathroom: [
    { number: "Section 01", title: "Site Protection and Prep", bullets: [] },
    { number: "Section 02", title: "Demolition and Wall Removal", bullets: [] },
    { number: "Section 03", title: "Framing, Electrical and Plumbing Rough-In", bullets: [] },
    { number: "Section 04", title: "Subfloor, Waterproofing and Tile Backer", bullets: [] },
    { number: "Section 05", title: "Custom Tile Shower", bullets: [] },
    { number: "Section 06", title: "Freestanding Tub and Wall Recess", bullets: [] },
    { number: "Section 07", title: "Vanity, Cabinetry and Floor Tile", bullets: [] },
    { number: "Section 08", title: "Lighting, Fans and Electrical Finish", bullets: [] },
    { number: "Section 09", title: "Drywall, Paint and Final Finish", bullets: [] },
  ],
  kitchen: [
    { number: "Section 01", title: "Site Protection and Prep", bullets: [] },
    { number: "Section 02", title: "Demolition", bullets: [] },
    { number: "Section 03", title: "Framing, Electrical and Plumbing Rough-In", bullets: [] },
    { number: "Section 04", title: "Drywall and Prep", bullets: [] },
    { number: "Section 05", title: "Cabinet Installation", bullets: [] },
    { number: "Section 06", title: "Countertop and Backsplash", bullets: [] },
    { number: "Section 07", title: "Flooring", bullets: [] },
    { number: "Section 08", title: "Appliance Installation", bullets: [] },
    { number: "Section 09", title: "Lighting, Electrical Finish and Hardware", bullets: [] },
    { number: "Section 10", title: "Paint and Final Finish", bullets: [] },
  ],
  basement: [
    { number: "Section 01", title: "Site Protection and Prep", bullets: [] },
    { number: "Section 02", title: "Framing and Insulation", bullets: [] },
    { number: "Section 03", title: "Electrical Rough-In", bullets: [] },
    { number: "Section 04", title: "Drywall and Ceilings", bullets: [] },
    { number: "Section 05", title: "Flooring", bullets: [] },
    { number: "Section 06", title: "Trim, Doors and Hardware", bullets: [] },
    { number: "Section 07", title: "Electrical Finish and Lighting", bullets: [] },
    { number: "Section 08", title: "Paint and Final Finish", bullets: [] },
  ],
  porch: [
    { number: "Section 01", title: "Site Protection and Prep", bullets: [] },
    { number: "Section 02", title: "Demolition", bullets: [] },
    { number: "Section 03", title: "Foundation and Structural", bullets: [] },
    { number: "Section 04", title: "Framing and Roof", bullets: [] },
    { number: "Section 05", title: "Windows, Doors and Exterior", bullets: [] },
    { number: "Section 06", title: "Electrical and Lighting", bullets: [] },
    { number: "Section 07", title: "Trim, Paint and Final Finish", bullets: [] },
  ],
  flooring: [
    { number: "Section 01", title: "Site Protection and Prep", bullets: [] },
    { number: "Section 02", title: "Subfloor Prep", bullets: [] },
    { number: "Section 03", title: "Flooring Installation", bullets: [] },
    { number: "Section 04", title: "Trim and Transitions", bullets: [] },
    { number: "Section 05", title: "Final Cleanup", bullets: [] },
  ],
};

// ── DOCX PRIMITIVES ──────────────────────────────────────────

const NONE_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const THIN_BORDER = { style: BorderStyle.SINGLE, size: 2, color: "DDDDDA" };
const noBorders: ITableCellBorders = {
  top: NONE_BORDER,
  bottom: NONE_BORDER,
  left: NONE_BORDER,
  right: NONE_BORDER,
};

const sp = (before = 0, after = 0) =>
  new Paragraph({ spacing: { before, after }, children: [] });

const rustRule = () =>
  new Paragraph({
    spacing: { before: 0, after: 0 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: RUST, space: 1 },
    },
    children: [],
  });

const eyebrow = (text: string) =>
  new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [
      new TextRun({
        text,
        font: "Arial",
        size: 16,
        bold: true,
        color: RUST,
        allCaps: true,
        characterSpacing: 40,
      }),
    ],
  });

const heading = (
  text: string,
  size = 36,
  color = NAVY,
  spaceBefore = 0,
  spaceAfter = 120
) =>
  new Paragraph({
    spacing: { before: spaceBefore, after: spaceAfter },
    children: [new TextRun({ text, font: "Arial", size, bold: true, color })],
  });

const body = (
  text: string,
  color = "333333",
  spaceBefore = 0,
  spaceAfter = 0
) =>
  new Paragraph({
    spacing: { before: spaceBefore, after: spaceAfter },
    children: [new TextRun({ text, font: "Arial", size: 20, color })],
  });

const scopeBullet = (label: string, desc: string | null) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 60, after: 60 },
    children: [
      new TextRun({
        text: label,
        font: "Arial",
        size: 20,
        bold: true,
        color: "1A1A1A",
      }),
      ...(desc
        ? [
            new TextRun({
              text: ": " + desc,
              font: "Arial",
              size: 20,
              color: "555555",
            }),
          ]
        : []),
    ],
  });

const termsBullet = (text: string) =>
  new Paragraph({
    numbering: { reference: "terms", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 19, color: "444444" })],
  });

// ── COVER PAGE ───────────────────────────────────────────────

const coverTable = (data: ProposalData) => {
  const metaLabel = (text: string) =>
    new Paragraph({
      spacing: { before: 0, after: 40 },
      children: [
        new TextRun({
          text,
          font: "Arial",
          size: 15,
          color: "7A9BBC",
          allCaps: true,
          characterSpacing: 30,
        }),
      ],
    });

  const metaValue = (text: string) =>
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        new TextRun({ text, font: "Arial", size: 21, color: "DDDDDD" }),
      ],
    });

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: W, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: RUST, type: ShadingType.CLEAR },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: W, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 1600, bottom: 1600, left: 560, right: 560 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 1400 },
                children: [
                  new TextRun({
                    text: "AK RENOVATIONS",
                    font: "Arial",
                    size: 18,
                    color: "7A9BBC",
                    characterSpacing: 60,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 160 },
                children: [
                  new TextRun({
                    text: data.projectType,
                    font: "Arial",
                    size: 22,
                    color: RUST,
                    characterSpacing: 20,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: data.clientLastName,
                    font: "Arial",
                    size: 80,
                    bold: true,
                    color: WHITE,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 600 },
                children: [
                  new TextRun({
                    text: "Residence",
                    font: "Arial",
                    size: 80,
                    bold: true,
                    color: WHITE,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 1400 },
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 6,
                    color: RUST,
                    space: 1,
                  },
                },
                children: [
                  new TextRun({
                    text: "\u00A0".repeat(8),
                    font: "Arial",
                    size: 22,
                    color: NAVY,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          new TableCell({
            width: { size: W, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [
              new Table({
                width: { size: W, type: WidthType.DXA },
                columnWidths: [W / 2, W / 2],
                borders: noBorders,
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: W / 2, type: WidthType.DXA },
                        borders: {
                          ...noBorders,
                          right: {
                            style: BorderStyle.SINGLE,
                            size: 2,
                            color: "2E4266",
                          },
                        },
                        shading: { fill: NAVY, type: ShadingType.CLEAR },
                        margins: {
                          top: 200,
                          bottom: 200,
                          left: 560,
                          right: 320,
                        },
                        children: [
                          metaLabel("Prepared for"),
                          metaValue(data.clientFullNames),
                        ],
                      }),
                      new TableCell({
                        width: { size: W / 2, type: WidthType.DXA },
                        borders: noBorders,
                        shading: { fill: NAVY, type: ShadingType.CLEAR },
                        margins: {
                          top: 200,
                          bottom: 200,
                          left: 320,
                          right: 560,
                        },
                        children: [
                          metaLabel("Prepared by"),
                          metaValue("Adam Kilgore, AK Renovations"),
                        ],
                      }),
                    ],
                  }),
                  new TableRow({
                    children: [
                      new TableCell({
                        width: { size: W / 2, type: WidthType.DXA },
                        borders: {
                          ...noBorders,
                          top: {
                            style: BorderStyle.SINGLE,
                            size: 2,
                            color: "2E4266",
                          },
                          right: {
                            style: BorderStyle.SINGLE,
                            size: 2,
                            color: "2E4266",
                          },
                        },
                        shading: { fill: NAVY, type: ShadingType.CLEAR },
                        margins: {
                          top: 200,
                          bottom: 800,
                          left: 560,
                          right: 320,
                        },
                        children: [
                          metaLabel("Property"),
                          metaValue(data.address1),
                          metaValue(data.address2),
                        ],
                      }),
                      new TableCell({
                        width: { size: W / 2, type: WidthType.DXA },
                        borders: {
                          ...noBorders,
                          top: {
                            style: BorderStyle.SINGLE,
                            size: 2,
                            color: "2E4266",
                          },
                        },
                        shading: { fill: NAVY, type: ShadingType.CLEAR },
                        margins: {
                          top: 200,
                          bottom: 800,
                          left: 320,
                          right: 560,
                        },
                        children: [
                          metaLabel("Date"),
                          metaValue(date),
                          sp(80),
                          metaLabel("Estimated duration"),
                          metaValue(data.duration),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
};

// ── SCOPE SECTION ROW ────────────────────────────────────────

const rustSectionRule = () =>
  new Paragraph({
    spacing: { before: 0, after: 0 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: RUST, space: 1 },
    },
    children: [],
  });

const sectionRow = (
  number: string,
  title: string,
  bullets: Paragraph[]
) => {
  const SIDEBAR = 2000;
  const CONTENT = W - SIDEBAR;
  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [SIDEBAR, CONTENT],
    borders: {
      top: THIN_BORDER,
      bottom: NONE_BORDER,
      left: NONE_BORDER,
      right: NONE_BORDER,


    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: SIDEBAR, type: WidthType.DXA },
            borders: {
              ...noBorders,
              right: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: "E8E8E6",
              },
            },
            shading: { fill: "FAFAFA", type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 200, left: 0, right: 200 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: number,
                    font: "Arial",
                    size: 16,
                    bold: true,
                    color: RUST,
                    allCaps: true,
                    characterSpacing: 40,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: title,
                    font: "Arial",
                    size: 22,
                    bold: true,
                    color: NAVY,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: CONTENT, type: WidthType.DXA },
            borders: noBorders,
            margins: { top: 160, bottom: 200, left: 240, right: 0 },
            children: bullets,
          }),
        ],
      }),
    ],
  });
};

// ── TOTAL PRICE BOX ──────────────────────────────────────────

const totalBox = (data: ProposalData) =>
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [5800, 3560],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 5800, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 280, bottom: 280, left: 320, right: 200 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: "TOTAL FOR ALL LABOR, CONSTRUCTION MATERIALS, AND INSTALLATION",
                    font: "Arial",
                    size: 16,
                    color: "AACCEE",
                    allCaps: true,
                    characterSpacing: 20,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 0 },
                children: [
                  new TextRun({
                    text: data.totalPrice,
                    font: "Arial",
                    size: 52,
                    bold: true,
                    color: WHITE,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 100, after: 0 },
                children: [
                  new TextRun({
                    text: "Client selections purchased separately. See shopping list.",
                    font: "Arial",
                    size: 17,
                    color: "AACCEE",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3560, type: WidthType.DXA },
            borders: {
              ...noBorders,
              left: { style: BorderStyle.SINGLE, size: 6, color: RUST },
            },
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 280, bottom: 280, left: 280, right: 280 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: data.sectionRange,
                    font: "Arial",
                    size: 15,
                    color: RUST,
                    allCaps: true,
                    characterSpacing: 20,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "All permits, inspections, labor, and construction materials included.",
                    font: "Arial",
                    size: 17,
                    color: "AACCEE",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

// ── ADD-ON BOX ───────────────────────────────────────────────

const addOnBox = (data: ProposalData) =>
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [6200, 3160],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: RUST },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: RUST },
      left: { style: BorderStyle.SINGLE, size: 6, color: RUST },
      right: { style: BorderStyle.SINGLE, size: 6, color: RUST },


    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 6200, type: WidthType.DXA },
            borders: {
              ...noBorders,
              left: { style: BorderStyle.SINGLE, size: 16, color: RUST },
            },
            shading: { fill: "FDF7F5", type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 280, right: 200 },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({
                    text: "OPTIONAL ADD-ON",
                    font: "Arial",
                    size: 15,
                    color: RUST,
                    allCaps: true,
                    characterSpacing: 30,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 80 },
                children: [
                  new TextRun({
                    text: data.addOnName,
                    font: "Arial",
                    size: 24,
                    bold: true,
                    color: NAVY,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: data.addOnDetail,
                    font: "Arial",
                    size: 19,
                    color: "555555",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3160, type: WidthType.DXA },
            borders: {
              ...noBorders,
              left: {
                style: BorderStyle.SINGLE,
                size: 4,
                color: "E8DDD9",
              },
            },
            shading: { fill: "FDF7F5", type: ShadingType.CLEAR },
            margins: { top: 200, bottom: 200, left: 240, right: 240 },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 40 },
                children: [
                  new TextRun({
                    text: data.addOnPrice,
                    font: "Arial",
                    size: 40,
                    bold: true,
                    color: NAVY,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "if selected",
                    font: "Arial",
                    size: 17,
                    color: "999999",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

// ── SELECTIONS TABLE ─────────────────────────────────────────

const selectionsTable = (data: ProposalData) => {
  const cols = [2340, 2800, 2360, 1860];
  const thBorder = { style: BorderStyle.SINGLE, size: 4, color: "CCCCCA" };
  const itemBorder = { style: BorderStyle.SINGLE, size: 2, color: "E8E8E6" };

  const th = (text: string, w: number) =>
    new TableCell({
      width: { size: w, type: WidthType.DXA },
      borders: { top: NONE_BORDER, bottom: thBorder, left: NONE_BORDER, right: NONE_BORDER },
      margins: { top: 80, bottom: 100, left: 120, right: 120 },
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              font: "Arial",
              size: 16,
              color: "888885",
              allCaps: true,
              characterSpacing: 20,
            }),
          ],
        }),
      ],
    });

  const catRow = (label: string) =>
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 4,
          width: { size: W, type: WidthType.DXA },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 2, color: "E8DDD9" },
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "E8DDD9" },
            left: { style: BorderStyle.SINGLE, size: 14, color: RUST },
            right: NONE_BORDER,
          },
          shading: { fill: RUST_TINT, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: label,
                  font: "Arial",
                  size: 17,
                  bold: true,
                  color: RUST,
                  allCaps: true,
                  characterSpacing: 25,
                }),
              ],
            }),
          ],
        }),
      ],
    });

  const itemRow = (
    name: string,
    desc: string,
    shop: string,
    isLast = false
  ) => {
    const borders = isLast
      ? noBorders
      : { top: NONE_BORDER, bottom: itemBorder, left: NONE_BORDER, right: NONE_BORDER };

    const mkCell = (text: string, w: number, bold: boolean) =>
      new TableCell({
        width: { size: w, type: WidthType.DXA },
        borders,
        margins: { top: 90, bottom: 90, left: 120, right: 120 },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text,
                font: "Arial",
                size: 19,
                bold,
                color: bold ? "1A1A1A" : "555555",
              }),
            ],
          }),
        ],
      });

    return new TableRow({
      children: [
        mkCell(name, cols[0], true),
        mkCell(desc, cols[1], false),
        mkCell(shop, cols[2], false),
        mkCell("$_______", cols[3], false),
      ],
    });
  };

  const rows = [
    new TableRow({
      children: [
        th("Item", cols[0]),
        th("What to look for", cols[1]),
        th("Where to shop", cols[2]),
        th("Your budget", cols[3]),
      ],
    }),
  ];

  data.selections.forEach((cat) => {
    rows.push(catRow(cat.label));
    cat.items.forEach((item, i) => {
      rows.push(
        itemRow(item.name, item.desc, item.shop, i === cat.items.length - 1)
      );
    });
  });

  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: cols,
    borders: noBorders,
    rows,
  });
};

// ── TERMS TABLE ──────────────────────────────────────────────

const termsTable = (data: ProposalData) => {
  const HALF = W / 2;

  const termBlock = (title: string, items: string[]) =>
    new TableCell({
      width: { size: HALF, type: WidthType.DXA },
      borders: {
        top: THIN_BORDER,
        bottom: THIN_BORDER,
        left: NONE_BORDER,
        right: NONE_BORDER,
      },
      shading: { fill: WHITE, type: ShadingType.CLEAR },
      margins: { top: 200, bottom: 200, left: 200, right: 200 },
      children: [
        new Paragraph({
          spacing: { before: 0, after: 80 },
          children: [
            new TextRun({
              text: title,
              font: "Arial",
              size: 20,
              bold: true,
              color: NAVY,
            }),
          ],
        }),
        ...items.map((t) => termsBullet(t)),
      ],
    });

  const row = (left: TableCell, right: TableCell) =>
    new TableRow({ children: [left, right] });

  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [HALF, HALF],
    borders: noBorders,
    rows: [
      row(
        termBlock("Payment schedule", [
          "Deposit of [__]% due upon signing to secure your start date and order materials",
          "Progress payments invoiced at agreed milestones throughout the project",
          "Final payment due upon completion and your walkthrough approval",
        ]),
        termBlock("Change orders", [
          "Any work outside this scope is documented as a written change order before it begins",
          "Each change order includes a full description of the work and the associated cost",
          "No additional work proceeds without your written approval",
        ])
      ),
      row(
        termBlock("Project timeline", [
          "Start date to be confirmed upon contract execution",
          `Estimated duration is ${data.estimatedDuration} from the start date`,
          "You will be kept updated on any schedule changes promptly",
        ]),
        termBlock("Warranty", [
          "AK Renovations guarantees all workmanship for one year from project completion",
          "Manufacturer warranties on materials remain in effect per their respective terms",
          "Warranty does not cover damage from misuse, neglect, or normal wear and tear",
        ])
      ),
      row(
        termBlock("Client selections", [
          "All selections must be finalized before the corresponding phase of work begins",
          "Delays in selections may affect the project schedule",
          "Items in the shopping list are purchased directly by the homeowner at no markup",
        ]),
        termBlock("General conditions", [
          "All work performed per applicable local building codes and ordinances",
          "Permits and inspections are pulled and managed by AK Renovations",
          "AK Renovations carries full liability insurance and workers compensation coverage",
        ])
      ),
    ],
  });
};

// ── SIGNATURE TABLE ──────────────────────────────────────────

const signatureTable = (_data: ProposalData) => {
  const HALF = W / 2;

  const sigBlock = (party: string, name: string | null) =>
    new TableCell({
      width: { size: HALF, type: WidthType.DXA },
      borders: noBorders,
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: party === "Client" ? 200 : 0,
      },
      children: [
        new Paragraph({
          spacing: { before: 0, after: 80 },
          children: [
            new TextRun({
              text: party,
              font: "Arial",
              size: 17,
              color: RUST,
              allCaps: true,
              characterSpacing: 30,
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 0, after: 0 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 4,
              color: "CCCCCA",
              space: 1,
            },
          },
          children: [new TextRun({ text: " ", font: "Arial", size: 36 })],
        }),
        sp(80),
        new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [
            new TextRun({
              text: "Signature",
              font: "Arial",
              size: 17,
              color: "AAAAAA",
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 0, after: 0 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 2,
              color: "E0E0DE",
              space: 1,
            },
          },
          children: [
            new TextRun({
              text:
                "Printed name: " +
                (name || "______________________________"),
              font: "Arial",
              size: 19,
              color: name ? "1A1A1A" : "AAAAAA",
            }),
          ],
        }),
        sp(60),
        new Paragraph({
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 2,
              color: "E0E0DE",
              space: 1,
            },
          },
          children: [
            new TextRun({
              text: "Date: ______________________________",
              font: "Arial",
              size: 19,
              color: "AAAAAA",
            }),
          ],
        }),
      ],
    });

  return new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [HALF - 200, 400, HALF - 200],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          sigBlock("Client", null),
          new TableCell({
            width: { size: 400, type: WidthType.DXA },
            borders: noBorders,
            children: [new Paragraph({ children: [] })],
          }),
          sigBlock("AK Renovations", "Adam Kilgore"),
        ],
      }),
    ],
  });
};

// ── FOOTER ───────────────────────────────────────────────────

const footerTable = (data: ProposalData) =>
  new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [W / 2, W / 2],
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: W / 2, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 280, right: 200 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "AK RENOVATIONS",
                    font: "Arial",
                    size: 17,
                    color: "CCDDEE",
                    characterSpacing: 50,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: W / 2, type: WidthType.DXA },
            borders: noBorders,
            shading: { fill: NAVY, type: ShadingType.CLEAR },
            margins: { top: 160, bottom: 160, left: 200, right: 280 },
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `Craftsmanship you can trust. Communication you deserve.  |  ${data.phone}  |  ${data.website}`,
                    font: "Arial",
                    size: 16,
                    color: "AABBCC",
                    italics: true,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

// ── BUILD AND DOWNLOAD ───────────────────────────────────────

export async function buildProposalDocxBlob(data: ProposalData): Promise<{ blob: Blob; filename: string }> {
  const { doc, filename } = await composeProposalDoc(data)
  const blob = await Packer.toBlob(doc)
  return { blob, filename }
}

export async function generateProposalDocx(data: ProposalData): Promise<void> {
  const { blob, filename } = await buildProposalDocxBlob(data)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function composeProposalDoc(data: ProposalData): Promise<{ doc: Document; filename: string }> {
  const children = [
    coverTable(data),
    sp(560),
    new Paragraph({ children: [new PageBreak()] }),

    eyebrow("Project Overview"),
    heading(data.overviewTitle, 34, NAVY, 0, 160),
    body(data.overviewBody, "444444", 0, 320),
    rustRule(),
    sp(320),

    ...data.sections.flatMap((s) => [
      sectionRow(
        s.number,
        s.title,
        s.bullets.map((b) => scopeBullet(b.label, b.desc))
      ),
      rustSectionRule(),
      sp(200),
    ]),

    sp(200),
    eyebrow("Investment"),
    sp(120),
    totalBox(data),
    ...(data.hasAddOn ? [sp(240), addOnBox(data)] : []),
    sp(400),
    rustRule(),
    sp(320),

    eyebrow("Client Selections Shopping List"),
    heading(
      "Everything below is purchased directly by you",
      26,
      NAVY,
      0,
      100
    ),
    body(
      "AK Renovations does not mark up any of these items. Deliver selections to the job site before the corresponding phase begins. Use this as your shopping checklist and fill in your budget targets as you make decisions.",
      "555555",
      0,
      280
    ),
    selectionsTable(data),
    sp(400),
    rustRule(),
    sp(320),

    eyebrow("Terms and Conditions"),
    sp(120),
    termsTable(data),
    sp(400),
    rustRule(),
    sp(320),

    eyebrow("Authorization and Signatures"),
    body(
      "By signing below, both parties agree to the scope of work, pricing, and terms described in this proposal. This document becomes a binding contract upon execution.",
      "555555",
      0,
      280
    ),
    signatureTable(data),
    sp(400),
    rustRule(),
    sp(120),
    footerTable(data),
  ];

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u25AA",
              alignment: AlignmentType.LEFT,
              style: {
                run: { color: RUST, size: 16 },
                paragraph: { indent: { left: 480, hanging: 300 } },
              },
            },
          ],
        },
        {
          reference: "terms",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "\u2013",
              alignment: AlignmentType.LEFT,
              style: {
                run: { color: RUST, size: 20 },
                paragraph: { indent: { left: 360, hanging: 220 } },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 720, right: 1440, bottom: 720, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const filename = `${data.clientLastName}_${data.projectType.replace(/\s+/g, '_')}_Proposal.docx`
  return { doc, filename }
}
