import { NextRequest, NextResponse } from 'next/server';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/src/lib/firebase';

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

    // Convert File to Buffer then Uint8Array for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate unique storage path
    const fileExt = file.name.split('.').pop() || (type === 'hwp' ? 'hwp' : 'pdf');
    const storageRef = ref(storage, `${subdomain}/notices/${Date.now()}_notice.${fileExt}`);
    
    // Upload file using server context (bypasses browser CORS policy)
    const snapshot = await uploadBytes(storageRef, new Uint8Array(buffer), {
      contentType: file.type || (type === 'hwp' ? 'application/x-hwp' : 'application/pdf')
    });
    
    const downloadURL = await getDownloadURL(snapshot.ref);

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
