import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { projects, scripts, pipelineStages } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { createProjectFolder } from '@/lib/fileSync';

export async function GET() {
  try {
    const allProjects = db.select().from(projects).orderBy(desc(projects.updatedAt)).all();
    return NextResponse.json(allProjects);
  } catch {
    return NextResponse.json({ error: '获取项目列表失败' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, style, aspectRatio, emotionalTone, episodeDuration, totalEpisodes, markdownFormat } = body;

    if (!name) {
      return NextResponse.json({ error: '项目名称不能为空' }, { status: 400 });
    }

    const folderName = `${name}项目`;

    // Create project in DB
    const project = db.insert(projects).values({
      name,
      folderName,
      style: style || '',
      aspectRatio: aspectRatio || '9:16',
      emotionalTone: emotionalTone || '',
      episodeDuration: episodeDuration || '15秒',
      totalEpisodes: totalEpisodes || 0,
      status: 'draft',
      markdownFormat: markdownFormat || 'linchong',
    }).returning().get();

    // Create project folder
    createProjectFolder(project);

    // Initialize empty script
    db.insert(scripts).values({
      projectId: project.id,
      rawMarkdown: '',
      filePath: '',
    }).run();

    // Initialize pipeline stages
    const stages: Array<'script' | 'assets' | 'images' | 'storyboard' | 'video'> = [
      'script', 'assets', 'images', 'storyboard', 'video',
    ];
    for (const stage of stages) {
      db.insert(pipelineStages).values({
        projectId: project.id,
        stage,
        status: 'pending',
      }).run();
    }

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json({ error: '创建项目失败' }, { status: 500 });
  }
}
