import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pipelineStages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const stages = db.select().from(pipelineStages)
      .where(eq(pipelineStages.projectId, projectId))
      .all();

    return NextResponse.json(stages);
  } catch {
    return NextResponse.json({ error: '获取流程状态失败' }, { status: 500 });
  }
}
