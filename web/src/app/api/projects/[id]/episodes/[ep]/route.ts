import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { episodes, timeSlots, assetSlots } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { syncEpisodeFile } from '@/lib/fileSync';

export async function GET(
  _request: Request,
  { params }: { params: { id: string; ep: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const epNumber = parseInt(params.ep);

    const episode = db.select().from(episodes)
      .where(and(
        eq(episodes.projectId, projectId),
        eq(episodes.episodeNumber, epNumber)
      ))
      .get();

    if (!episode) {
      return NextResponse.json({ error: '分镜不存在' }, { status: 404 });
    }

    const slots = db.select().from(timeSlots)
      .where(eq(timeSlots.episodeId, episode.id))
      .all();

    const aSlots = db.select().from(assetSlots)
      .where(eq(assetSlots.episodeId, episode.id))
      .all();

    return NextResponse.json({
      ...episode,
      timeSlots: slots,
      assetSlots: aSlots,
    });
  } catch {
    return NextResponse.json({ error: '获取分镜详情失败' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string; ep: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const epNumber = parseInt(params.ep);
    const body = await request.json();

    const episode = db.select().from(episodes)
      .where(and(
        eq(episodes.projectId, projectId),
        eq(episodes.episodeNumber, epNumber)
      ))
      .get();

    if (!episode) {
      return NextResponse.json({ error: '分镜不存在' }, { status: 404 });
    }

    // Update episode fields
    const updateData: Record<string, unknown> = {};
    if (body.title !== undefined) updateData.title = body.title;
    if (body.styleLine !== undefined) updateData.styleLine = body.styleLine;
    if (body.soundDesign !== undefined) updateData.soundDesign = body.soundDesign;
    if (body.referenceList !== undefined) updateData.referenceList = body.referenceList;
    if (body.endFrameDescription !== undefined) updateData.endFrameDescription = body.endFrameDescription;

    if (Object.keys(updateData).length > 0) {
      db.update(episodes).set(updateData).where(eq(episodes.id, episode.id)).run();
    }

    // Update time slots if provided
    if (body.timeSlots && Array.isArray(body.timeSlots)) {
      db.delete(timeSlots).where(eq(timeSlots.episodeId, episode.id)).run();
      for (const slot of body.timeSlots) {
        db.insert(timeSlots).values({
          episodeId: episode.id,
          startSecond: slot.startSecond,
          endSecond: slot.endSecond,
          cameraMovement: slot.cameraMovement || '',
          description: slot.description || '',
        }).run();
      }
    }

    // Update asset slots if provided
    if (body.assetSlots && Array.isArray(body.assetSlots)) {
      db.delete(assetSlots).where(eq(assetSlots.episodeId, episode.id)).run();
      for (const slot of body.assetSlots) {
        db.insert(assetSlots).values({
          episodeId: episode.id,
          slotNumber: slot.slotNumber,
          slotType: slot.slotType || 'image',
          assetCode: slot.assetCode || '',
          description: slot.description || '',
        }).run();
      }
    }

    // Sync to file
    syncEpisodeFile(projectId, epNumber);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('更新分镜失败:', e);
    return NextResponse.json({ error: '更新分镜失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; ep: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const epNumber = parseInt(params.ep);

    const episode = db.select().from(episodes)
      .where(and(
        eq(episodes.projectId, projectId),
        eq(episodes.episodeNumber, epNumber)
      ))
      .get();

    if (!episode) {
      return NextResponse.json({ error: '分镜不存在' }, { status: 404 });
    }

    db.delete(timeSlots).where(eq(timeSlots.episodeId, episode.id)).run();
    db.delete(assetSlots).where(eq(assetSlots.episodeId, episode.id)).run();
    db.delete(episodes).where(eq(episodes.id, episode.id)).run();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '删除分镜失败' }, { status: 500 });
  }
}
