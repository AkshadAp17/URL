import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

// Generate random short code
function generateShortCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function POST(request) {
  try {
    const { originalUrl } = await request.json();

    if (!originalUrl) {
      return NextResponse.json(
        { error: 'Original URL is required' },
        { status: 400 }
      );
    }

    // Validate URL format
    try {
      new URL(originalUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Generate unique short code
    let shortCode;
    let existing;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      shortCode = generateShortCode();
      existing = await db.collection('urls').findOne({ shortCode });
      attempts++;
      
      if (attempts >= maxAttempts) {
        return NextResponse.json(
          { error: 'Unable to generate unique short code' },
          { status: 500 }
        );
      }
    } while (existing);

    // Create URL document
    const urlDoc = {
      originalUrl,
      shortCode,
      clicks: 0,
      clickHistory: [],
      createdAt: new Date()
    };

    await db.collection('urls').insertOne(urlDoc);

    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                    `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    return NextResponse.json({
      shortCode,
      shortUrl: `${baseUrl}/${shortCode}`,
      originalUrl
    }, { status: 201 });

  } catch (error) {
    console.error('Error shortening URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}