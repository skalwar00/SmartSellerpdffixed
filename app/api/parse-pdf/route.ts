export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
      import.meta.url
    ).href;

    const standardFontDataUrl = path.join(
      process.cwd(),
      "node_modules/pdfjs-dist/standard_fonts/"
    );

    const pdf = await pdfjsLib.getDocument({
      data: buffer,
      standardFontDataUrl: `file://${standardFontDataUrl}`,
    }).promise;

    const orders: { Portal_SKU: string; Qty: number }[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();

      const items = content.items as Array<{
        str: string;
        transform: number[];
      }>;

      // Page filter: must contain "PICKLIST" and must NOT contain "COURIER"
      const pageText = items.map((it) => it.str).join(" ").toUpperCase();
      if (!pageText.includes("PICKLIST") || pageText.includes("COURIER")) {
        continue;
      }

      // Group text items into rows by y-coordinate (within 5pt = same row)
      const rowMap: Map<number, Array<{ x: number; text: string }>> = new Map();

      for (const item of items) {
        if (!item.str.trim()) continue;
        const x = Math.round(item.transform[4]);
        const y = Math.round(item.transform[5]);

        let rowKey: number | null = null;
        for (const key of rowMap.keys()) {
          if (Math.abs(key - y) <= 5) {
            rowKey = key;
            break;
          }
        }
        if (rowKey === null) {
          rowMap.set(y, []);
          rowKey = y;
        }
        rowMap.get(rowKey)!.push({ x, text: item.str.trim() });
      }

      // Sort rows top-to-bottom, cells left-to-right within each row
      const sortedRows = [...rowMap.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, cells]) => cells.sort((a, b) => a.x - b.x).map((c) => c.text));

      for (const row of sortedRows) {
        // Need at least 3 columns: SKU | ... | Size | Qty
        if (row.length < 3) continue;

        // Skip the header row where first cell is "SKU"
        if (row[0].toUpperCase().trim() === "SKU") continue;

        // row[0]  = style code (e.g. "HS005-GREEN")
        // row[-2] = size      (e.g. "XXL")
        // row[-1] = quantity  (e.g. "1")
        const styleCode = row[0].toUpperCase().trim();
        const size = row[row.length - 2].toUpperCase().trim();
        const qtyRaw = row[row.length - 1];

        // Skip rows where last cell isn't a number (info/title rows)
        let qty = 1;
        try {
          const parsed = parseInt(parseFloat(qtyRaw).toString(), 10);
          if (!isNaN(parsed) && parsed > 0) qty = parsed;
          else continue;
        } catch {
          continue;
        }

        if (!styleCode) continue;

        // Full SKU = style code + "-" + size (e.g. "HS005-GREEN-XXL")
        const fullSku = `${styleCode}-${size}`;

        const existing = orders.find((o) => o.Portal_SKU === fullSku);
        if (existing) {
          existing.Qty += qty;
        } else {
          orders.push({ Portal_SKU: fullSku, Qty: qty });
        }
      }
    }

    return NextResponse.json({ orders });
  } catch (error) {
    console.error("PDF error:", error);
    return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
  }
}
