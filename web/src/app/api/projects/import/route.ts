import { NextResponse } from 'next/server';
import { importAllProjects, scanProjectFolders } from '@/lib/import';

export async function POST() {
  try {
    const result = await importAllProjects();
    return NextResponse.json(result);
  } catch (error) {
    console.error('导入失败:', error);
    return NextResponse.json({ error: '导入项目失败' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const folders = scanProjectFolders();
    return NextResponse.json({ folders });
  } catch {
    return NextResponse.json({ error: '扫描文件夹失败' }, { status: 500 });
  }
}
