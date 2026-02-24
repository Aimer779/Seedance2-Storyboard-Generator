import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { syncAssetListFile } from '@/lib/fileSync';

export async function PUT(
  request: Request,
  { params }: { params: { id: string; assetId: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const assetId = parseInt(params.assetId);
    const body = await request.json();

    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!asset || asset.projectId !== projectId) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.code !== undefined) updateData.code = body.code;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.prompt !== undefined) updateData.prompt = body.prompt;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.usedInEpisodes !== undefined) updateData.usedInEpisodes = JSON.stringify(body.usedInEpisodes);
    if (body.imagePath !== undefined) updateData.imagePath = body.imagePath;

    db.update(assets).set(updateData).where(eq(assets.id, assetId)).run();

    syncAssetListFile(projectId);

    const updated = db.select().from(assets).where(eq(assets.id, assetId)).get();
    return NextResponse.json({
      ...updated,
      usedInEpisodes: JSON.parse(updated?.usedInEpisodes || '[]'),
    });
  } catch {
    return NextResponse.json({ error: '更新素材失败' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; assetId: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const assetId = parseInt(params.assetId);

    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!asset || asset.projectId !== projectId) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    db.delete(assets).where(eq(assets.id, assetId)).run();

    syncAssetListFile(projectId);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: '删除素材失败' }, { status: 500 });
  }
}
