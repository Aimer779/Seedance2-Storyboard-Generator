import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, assets, episodes, pipelineStages, scripts, scriptEpisodes, timeSlots, assetSlots } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // 获取关联数据数量
    const assetCount = db.select().from(assets).where(eq(assets.projectId, id)).all().length;
    const episodeList = db.select().from(episodes).where(eq(episodes.projectId, id)).all();
    const pipeline = db.select().from(pipelineStages).where(eq(pipelineStages.projectId, id)).all();

    return NextResponse.json({
      ...project,
      assetCount,
      episodeCount: episodeList.length,
      episodes: episodeList.map(e => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        title: e.title,
      })),
      pipeline,
    });
  } catch {
    return NextResponse.json({ error: '获取项目详情失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const body = await request.json();

    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.style !== undefined) updateData.style = body.style;
    if (body.aspectRatio !== undefined) updateData.aspectRatio = body.aspectRatio;
    if (body.emotionalTone !== undefined) updateData.emotionalTone = body.emotionalTone;
    if (body.episodeDuration !== undefined) updateData.episodeDuration = body.episodeDuration;
    if (body.totalEpisodes !== undefined) updateData.totalEpisodes = body.totalEpisodes;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.markdownFormat !== undefined) updateData.markdownFormat = body.markdownFormat;
    updateData.updatedAt = sql`datetime('now')`;

    db.update(projects).set(updateData).where(eq(projects.id, id)).run();

    const updated = db.select().from(projects).where(eq(projects.id, id)).get();
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: '更新项目失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const project = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    // Cascade delete: scripts -> scriptEpisodes, episodes -> timeSlots/assetSlots
    const scriptList = db.select().from(scripts).where(eq(scripts.projectId, id)).all();
    for (const s of scriptList) {
      db.delete(scriptEpisodes).where(eq(scriptEpisodes.scriptId, s.id)).run();
    }
    db.delete(scripts).where(eq(scripts.projectId, id)).run();

    const episodeList = db.select().from(episodes).where(eq(episodes.projectId, id)).all();
    for (const ep of episodeList) {
      db.delete(timeSlots).where(eq(timeSlots.episodeId, ep.id)).run();
      db.delete(assetSlots).where(eq(assetSlots.episodeId, ep.id)).run();
    }
    db.delete(episodes).where(eq(episodes.projectId, id)).run();
    db.delete(assets).where(eq(assets.projectId, id)).run();
    db.delete(pipelineStages).where(eq(pipelineStages.projectId, id)).run();
    db.delete(projects).where(eq(projects.id, id)).run();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '删除项目失败' }, { status: 500 });
  }
}
