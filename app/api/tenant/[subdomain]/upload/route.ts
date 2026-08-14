import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ subdomain: string }> }
) {
  try {
    const { subdomain } = await params;
    
    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;

    if (!file) {
      return NextResponse.json({ error: '업로드할 파일이 없습니다.' }, { status: 400 });
    }

    // Convert File to ArrayBuffer and then Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file size is under 1MB to prevent Firestore document size limit error (1MB)
    if (file.size > 1024 * 1024) {
      return NextResponse.json({
        error: '데이터베이스 저장 공간 제한으로 인해, 업로드할 파일의 크기는 1MB 이하여야 합니다. 파일 용량을 압축하여 다시 업로드해주세요.'
      }, { status: 400 });
    }

    const contentType = file.type || (type === 'hwp' ? 'application/x-hwp' : 'application/pdf');
    const base64Data = buffer.toString('base64');
    const downloadURL = `data:${contentType};base64,${base64Data}`;

    // Optional: write to local public/uploads directory as a local backup
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      const fileExt = file.name.split('.').pop() || (type === 'hwp' ? 'hwp' : 'pdf');
      const fileName = `${Date.now()}_notice.${fileExt}`;
      const filePath = path.join(uploadDir, fileName);
      await fs.writeFile(filePath, buffer);
      console.log(`Saved local upload backup to: ${filePath}`);
    } catch (fsErr) {
      console.error('Failed to write local backup file:', fsErr);
    }

    return NextResponse.json({
      success: true,
      downloadURL,
      fileName: file.name
    });
  } catch (error: any) {
    console.error('Server-side file upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
