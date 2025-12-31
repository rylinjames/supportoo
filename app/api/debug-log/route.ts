import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, message, data } = body;
    
    const timestamp = new Date().toISOString();
    const logEntry = `
[${timestamp}] ${type}
${message}
${data ? JSON.stringify(data, null, 2) : ''}
-----------------------------------
`;
    
    // Write to debug.log file in project root
    const logPath = path.join(process.cwd(), 'debug.log');
    
    try {
      await fs.appendFile(logPath, logEntry);
    } catch (error) {
      // If file doesn't exist, create it
      await fs.writeFile(logPath, logEntry);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error writing to debug log:', error);
    return NextResponse.json(
      { error: 'Failed to write log' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const logPath = path.join(process.cwd(), 'debug.log');
    const content = await fs.readFile(logPath, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error) {
    return new NextResponse('No logs found', { status: 404 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const logPath = path.join(process.cwd(), 'debug.log');
    await fs.writeFile(logPath, `====== DEBUG LOG CLEARED ======\nCleared at: ${new Date().toISOString()}\n================================\n`);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to clear log' },
      { status: 500 }
    );
  }
}