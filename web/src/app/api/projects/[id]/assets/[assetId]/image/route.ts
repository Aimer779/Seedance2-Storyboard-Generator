import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { assets, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { getProjectRoot } from '@/lib/import';

export async function POST(
  request: Request,
  { params }: { params: { id: string; assetId: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const assetId = parseInt(params.assetId);

    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!asset || asset.projectId !== projectId) {
      return NextResponse.json({ error: '素材不存在' }, { status: 404 });
    }

    const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
    if (!project) {
      return NextResponse.json({ error: '项目不存在' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: '未找到文件' }, { status: 400 });
    }

    // Save to {project}/素材/{code}.png
    const projectDir = path.join(getProjectRoot(), project.folderName);
    const assetsDir = path.join(projectDir, '素材');
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }

    const ext = path.extname(file.name) || '.png';
    const fileName = `${asset.code}${ext}`;
    const filePath = path.join(assetsDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    // Update DB
    db.update(assets)
      .set({ imagePath: filePath })
      .where(eq(assets.id, assetId))
      .run();

    return NextResponse.json({ success: true, imagePath: filePath });
  } catch {
    return NextResponse.json({ error: '上传图片失败' }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string; assetId: string } }
) {
  try {
    const projectId = parseInt(params.id);
    const assetId = parseInt(params.assetId);

    const asset = db.select().from(assets).where(eq(assets.id, assetId)).get();
    if (!asset || asset.projectId !== projectId || !asset.imagePath) {
      return NextResponse.json({ error: '图片不存在' }, { status: 404 });
    }

    if (!fs.existsSync(asset.imagePath)) {
      return NextResponse.json({ error: '图片文件不存在' }, { status: 404 });
    }

    const buffer = fs.readFileSync(asset.imagePath);
    const ext = path.extname(asset.imagePath).toLowerCase();
    const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
      : ext === '.png' ? 'image/png'
      : ext === '.webp' ? 'image/webp'
      : 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return NextResponse.json({ error: '获取图片失败' }, { status: 500 });
  }
}
