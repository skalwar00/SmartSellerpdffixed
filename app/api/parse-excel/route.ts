import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const workbook = XLSX.read(buffer, { type: 'buffer' })

    // Try to find the "Orders P&L" sheet or use the first sheet
    let sheetName = workbook.SheetNames.find(name => name.includes('Orders P&L'))
    if (!sheetName) {
      sheetName = workbook.SheetNames[0]
    }

    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    return NextResponse.json({ rows, sheetName })
  } catch (error) {
    console.error('Excel parse error:', error)
    return NextResponse.json({ error: 'Failed to parse Excel file' }, { status: 500 })
  }
}
