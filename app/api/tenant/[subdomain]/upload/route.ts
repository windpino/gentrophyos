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

    // Generate unique storage path
    const fileExt = file.name.split('.').pop() || (type === 'hwp' ? 'hwp' : 'pdf');
    const fileName = `${Date.now()}_notice.${fileExt}`;
    const storagePath = `${subdomain}/notices/${fileName}`;
    const encodedPath = encodeURIComponent(storagePath);
    
    const bucketName = "gentrophyos.firebasestorage.app";
    const contentType = file.type || (type === 'hwp' ? 'application/x-hwp' : 'application/pdf');

    // Make direct REST API call to Firebase Storage upload endpoint
    const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}`;
    
    console.log(`Uploading to REST URL: ${uploadUrl}`);

    let response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': contentType,
      },
      body: buffer,
    });

    // If the default bucket .firebasestorage.app fails (e.g. 404), fallback to .appspot.com
    if (!response.ok && response.status === 404) {
      const fallbackBucket = "gentrophyos.appspot.com";
      const fallbackUrl = `https://firebasestorage.googleapis.com/v0/b/${fallbackBucket}/o/${encodedPath}`;
      console.log(`Retrying upload with fallback URL: ${fallbackUrl}`);
      response = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
        },
        body: buffer,
      });
    }

    const data = await response.json();

    if (!response.ok) {
      console.error('Firebase Storage REST error response:', data);
      return NextResponse.json({ 
        error: `Firebase Storage REST upload failed: ${data.error?.message || response.statusText}` 
      }, { status: response.status });
    }

    // Firebase Storage public download URL format:
    // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encodedPath>?alt=media&token=<downloadTokens>
    const finalBucket = data.bucket || bucketName;
    const downloadTokens = data.downloadTokens;
    
    let downloadURL = `https://firebasestorage.googleapis.com/v0/b/${finalBucket}/o/${encodedPath}?alt=media`;
    if (downloadTokens) {
      downloadURL += `&token=${downloadTokens}`;
    }

    return NextResponse.json({
      success: true,
      downloadURL,
      fileName: file.name
    });
  } catch (error: any) {
    console.error('Server-side REST file upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
