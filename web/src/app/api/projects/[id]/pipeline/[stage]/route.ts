import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { pipelineStages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function PUT(
  request: Request,
  { params }: { params: { id: string; stage: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const stage = params.stage;
    const body = await request.json();

    const existing = db.select().from(pipelineStages)
      .where(and(
        eq(pipelineStages.projectId, projectId),
        eq(pipelineStages.stage, stage as 'script' | 'assets' | 'images' | 'storyboard' | 'video')
      ))
      .get();

    if (!existing) {
      return NextResponse.json({ error: '阶段不存在' }, { status: 404 });
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'needs_revision'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json({ error: '无效的状态' }, { status: 400 });
    }

    db.update(pipelineStages)
      .set({
        status: body.status,
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(pipelineStages.id, existing.id))
      .run();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '更新流程状态失败' }, { status: 500 });
  }
}
