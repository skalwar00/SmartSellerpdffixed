import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

interface OrderItem {
  Master_SKU: string;
  Qty: number;
}

export async function POST(req: NextRequest) {
  try {
    const { orders } = (await req.json()) as { orders: OrderItem[] };

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: "No orders provided" },
        { status: 400 },
      );
    }

    // Aggregate by Master SKU
    const aggregated: Record<string, number> = {};
    for (const order of orders) {
      if (order.Master_SKU) {
        aggregated[order.Master_SKU] =
          (aggregated[order.Master_SKU] || 0) + order.Qty;
      }
    }

    // Sort by SKU
    const sortedItems = Object.entries(aggregated).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    // Create 4x6 inch PDF (288 x 432 points)
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const pageWidth = 4 * 72; // 4 inches
    const pageHeight = 6 * 72; // 6 inches
    const margin = 20;
    const lineHeight = 14;
    const headerHeight = 50;

    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - 30;

    // Draw header
    const drawHeader = (page: typeof currentPage) => {
      page.drawText("PICKLIST", {
        x: pageWidth / 2 - 60,
        y: pageHeight - 25,
        size: 14,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Date
      const date = new Date().toLocaleDateString("en-IN");
      page.drawText(date, {
        x: pageWidth - margin - 50,
        y: pageHeight - 25,
        size: 8,
        font,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Separator line
      page.drawLine({
        start: { x: margin, y: pageHeight - 35 },
        end: { x: pageWidth - margin, y: pageHeight - 35 },
        thickness: 1,
        color: rgb(0, 0, 0),
      });

      // Column headers
      page.drawText("Master SKU", {
        x: margin + 5,
        y: pageHeight - 50,
        size: 10,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      page.drawText("Qty", {
        x: pageWidth - margin - 25,
        y: pageHeight - 50,
        size: 10,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      // Header separator
      page.drawLine({
        start: { x: margin, y: pageHeight - 55 },
        end: { x: pageWidth - margin, y: pageHeight - 55 },
        thickness: 0.5,
        color: rgb(0.7, 0.7, 0.7),
      });

      return pageHeight - 70;
    };

    y = drawHeader(currentPage);

    // Draw items
    for (const [sku, qty] of sortedItems) {
      if (y < 30) {
        // New page
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = drawHeader(currentPage);
      }

      // Truncate long SKUs
      const displaySku = sku.length > 28 ? sku.slice(0, 25) + "..." : sku;

      currentPage.drawText(displaySku, {
        x: margin + 5,
        y,
        size: 9,
        font,
        color: rgb(0, 0, 0),
      });

      currentPage.drawText(qty.toString(), {
        x: pageWidth - margin - 20,
        y,
        size: 9,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      y -= lineHeight;
    }

    // Add total count at bottom
    currentPage.drawLine({
      start: { x: margin, y: y + 5 },
      end: { x: pageWidth - margin, y: y + 5 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });

    y -= 10;
    const totalQty = sortedItems.reduce((sum, [, qty]) => sum + qty, 0);
    currentPage.drawText(
      `Total: ${sortedItems.length} SKUs, ${totalQty} units`,
      {
        x: margin + 5,
        y,
        size: 8,
        font: boldFont,
        color: rgb(0.3, 0.3, 0.3),
      },
    );

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="picklist.pdf"',
      },
    });
  } catch (error) {
    console.error("Picklist generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate picklist" },
      { status: 500 },
    );
  }
}
