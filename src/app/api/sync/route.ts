import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

const SYNC_API_KEY = process.env.SYNC_API_KEY || '';

function isAuthorized(request: Request): boolean {
  if (!SYNC_API_KEY) return true; // No key configured = open (dev mode)
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${SYNC_API_KEY}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { cases, expenses } = body as {
      cases: {
        caseId: string;
        lawyerName: string;
        partyName: string;
        opponentName: string;
        caseType: string;
        section: string;
        policeStation: string;
        enteringDate: string;
        nextDate: string;
        phone: string;
        judgeRemarks: string;
        pendingFee: number;
        totalFeeReceived: number;
        history: string;
      }[];
      expenses: {
        caseId: string;
        lawyerName: string;
        partyName: string;
        description: string;
        amount: number;
        date: string;
        category: string;
      }[];
    };

    if (!Array.isArray(cases) || !Array.isArray(expenses)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    // Process cases in batches of 30 to avoid memory issues
    const BATCH = 30;
    let casesProcessed = 0;

    for (let i = 0; i < cases.length; i += BATCH) {
      const batch = cases.slice(i, i + BATCH);

      // Use sequential upserts (not parallel) to avoid connection pool exhaustion
      for (let j = 0; j < batch.length; j++) {
        const c = batch[j];
        try {
          await db.lawyerCase.upsert({
            where: { caseId: c.caseId },
            update: {
              lawyerName: c.lawyerName,
              partyName: c.partyName,
              opponentName: c.opponentName,
              caseType: c.caseType,
              section: c.section,
              policeStation: c.policeStation,
              enteringDate: c.enteringDate,
              nextDate: c.nextDate,
              phone: c.phone,
              judgeRemarks: c.judgeRemarks,
              pendingFee: c.pendingFee,
              totalFeeReceived: c.totalFeeReceived,
              history: c.history,
            },
            create: {
              caseId: c.caseId,
              lawyerName: c.lawyerName,
              partyName: c.partyName,
              opponentName: c.opponentName,
              caseType: c.caseType,
              section: c.section,
              policeStation: c.policeStation,
              enteringDate: c.enteringDate,
              nextDate: c.nextDate,
              phone: c.phone,
              judgeRemarks: c.judgeRemarks,
              pendingFee: c.pendingFee,
              totalFeeReceived: c.totalFeeReceived,
              history: c.history,
            },
          });
        } catch (e) {
          console.error(`Failed to upsert case ${c.caseId}:`, e);
        }
      }
      casesProcessed += batch.length;
    }

    // Process expenses in batches
    let expensesProcessed = 0;
    for (let i = 0; i < expenses.length; i += BATCH) {
      const batch = expenses.slice(i, i + BATCH);
      try {
        await db.expense.createMany({
          data: batch.map(e => ({
            caseId: e.caseId,
            lawyerName: e.lawyerName,
            partyName: e.partyName,
            description: e.description,
            amount: e.amount,
            date: e.date,
            category: e.category || 'case_expense',
          })),
          skipDuplicates: true,
        });
        expensesProcessed += batch.length;
      } catch (e) {
        console.error('Failed to create expenses batch:', e);
      }
    }

    return NextResponse.json({
      success: true,
      synced: { cases: casesProcessed, expenses: expensesProcessed }
    });
  } catch (error) {
    console.error('Sync POST error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    // Stream cases to avoid loading all at once
    const cases = await db.lawyerCase.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100000, // Safety limit
    });
    const expenses = await db.expense.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100000,
    });
    return NextResponse.json({ cases, expenses });
  } catch (error) {
    console.error('Sync GET error:', error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}