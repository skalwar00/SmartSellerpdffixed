import { NextRequest, NextResponse } from 'next/server'

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(line => line.trim())
  if (lines.length === 0) return []

  const headers = lines[0]
    .split(',')
    .map(h => h.trim().toLowerCase().replace(/"/g, ''))

  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    const row: Record<string, string> = {}

    headers.forEach((header, idx) => {
      row[header] = values[idx] || ''
    })

    rows.push(row)
  }

  return rows
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length < 3) {
      return NextResponse.json(
        { error: 'Minimum 3 files required (Flow, SKU, Settlement)' },
        { status: 400 }
      )
    }

    let flowData: Record<string, string>[] | null = null
    let skuData: Record<string, string>[] | null = null
    const forwardList: Record<string, string>[][] = []
    const reverseList: Record<string, string>[][] = []

    // 🔍 FILE DETECTION (same as Streamlit logic)
    for (const file of files) {
      const text = await file.text()
      const data = parseCSV(text)

      if (!data.length) continue

      const cols = Object.keys(data[0])

      // normalize column names
      const normalizedCols = cols.map(c => c.trim().toLowerCase())

      // FLOW FILE
      if (normalizedCols.includes('sale_order_code')) {
        flowData = data
      }

      // SKU FILE
      else if (
        normalizedCols.includes('seller sku code') &&
        !normalizedCols.includes('total_actual_settlement')
      ) {
        skuData = data
      }

      // SETTLEMENT FILE
      else if (normalizedCols.includes('total_actual_settlement')) {
        const avg =
          data.reduce((sum, r) => {
            return sum + parseFloat(r['total_actual_settlement'] || '0')
          }, 0) / data.length

        const fname = file.name.toLowerCase()

        if (
          fname.includes('reverse') ||
          fname.includes('return') ||
          avg < 0
        ) {
          reverseList.push(data)
        } else {
          forwardList.push(data)
        }
      }
    }

    if (!flowData || !skuData) {
      return NextResponse.json(
        { error: 'Flow or SKU file missing' },
        { status: 400 }
      )
    }

    // 🔗 SKU MAP
    const skuMap: Record<string, string> = {}

    for (const row of skuData) {
      const orderId =
        row['order release id'] || row['order_release_id'] || ''
      const sku =
        row['seller sku code'] || row['seller_sku_code'] || ''

      if (orderId && sku) {
        skuMap[orderId] = sku
      }
    }

    // ➕ MERGE FORWARD FILES
    const forwardMap: Record<string, number> = {}

    for (const dataset of forwardList) {
      for (const row of dataset) {
        const orderId = row['order_release_id'] || ''
        const val = parseFloat(row['total_actual_settlement'] || '0')

        if (orderId) {
          forwardMap[orderId] = (forwardMap[orderId] || 0) + val
        }
      }
    }

    // ➖ MERGE REVERSE FILES
    const reverseMap: Record<string, number> = {}

    for (const dataset of reverseList) {
      for (const row of dataset) {
        const orderId = row['order_release_id'] || ''
        const val = parseFloat(row['total_actual_settlement'] || '0')

        if (orderId) {
          reverseMap[orderId] = (reverseMap[orderId] || 0) + val
        }
      }
    }

    // 🔗 FINAL MERGE (Streamlit jaisa)
    const final = flowData.map(row => {
      const orderId = row['sale_order_code'] || ''
      const status = row['order_item_status'] || 'Not Found'

      const forwardAmt = forwardMap[orderId] || 0
      const reverseAmt = reverseMap[orderId] || 0
      const net = forwardAmt + reverseAmt

      let orderType = 'Delivered & Paid'
      if (net === 0) orderType = 'RTO'
      else if (net < 0) orderType = 'Customer Return'

      return {
        orderId,
        sku: skuMap[orderId] || 'Unknown SKU',
        status,
        forwardAmt,
        reverseAmt,
        netSettlement: net,
        orderType,
      }
    })

    // 📊 SUMMARY
    const totalSettlement = final.reduce((s, r) => s + r.netSettlement, 0)

    return NextResponse.json({
      success: true,
      totalOrders: final.length,
      totalSettlement,
      data: final,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: 'Failed to process Myntra data' },
      { status: 500 }
    )
  }
}