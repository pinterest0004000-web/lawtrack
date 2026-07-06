import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: Request) {
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
      }[];
    };

    if (!Array.isArray(cases) || !Array.isArray(expenses)) {
      return NextResponse.json({ error: 'Invalid data format' }, { status: 400 });
    }

    const batchSize = 50;
    let processed = 0;

    for (let i = 0; i < cases.length; i += batchSize) {
      const batch = cases.slice(i, i + batchSize);
      await Promise.all(
        batch.map(c =>
          db.lawyerCase.upsert({
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
          })
        )
      );
      processed += batch.length;
    }

    for (let i = 0; i < expenses.length; i += batchSize) {
      const batch = expenses.slice(i, i + batchSize);
      await db.expense.createMany({ data: batch, skipDuplicates: true });
    }

    return NextResponse.json({ success: true, synced: { cases: cases.length, expenses: expenses.length } });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cases = await db.lawyerCase.findMany({ orderBy: { updatedAt: 'desc' } });
    const expenses = await db.expense.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ cases, expenses });
  } catch (error) {
    console.error('Fetch error:', error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}