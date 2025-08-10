import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    
    const urls = await db.collection('urls')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    // Convert MongoDB ObjectId to string for JSON serialization
    const serializedUrls = urls.map(url => ({
      ...url,
      _id: url._id.toString(),
      createdAt: url.createdAt.toISOString(),
      clickHistory: url.clickHistory?.map(click => ({
        ...click,
        timestamp: click.timestamp.toISOString()
      })) || []
    }));

    return NextResponse.json(serializedUrls);
  } catch (error) {
    console.error('Error fetching URLs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const { originalUrl, customCode } = await request.json();

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

    let shortCode = customCode;

    // If custom code provided, check if it's available
    if (customCode) {
      const existing = await db.collection('urls').findOne({ shortCode: customCode });
      if (existing) {
        return NextResponse.json(
          { error: 'Custom code already exists' },
          { status: 409 }
        );
      }
    } else {
      // Generate random short code
      const generateShortCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };

      let existing;
      do {
        shortCode = generateShortCode();
        existing = await db.collection('urls').findOne({ shortCode });
      } while (existing);
    }

    const urlDoc = {
      originalUrl,
      shortCode,
      createdAt: new Date(),
      clicks: 0,
      clickHistory: []
    };

    await db.collection('urls').insertOne(urlDoc);

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                   `${request.nextUrl.protocol}//${request.nextUrl.host}`;

    return NextResponse.json({
      shortCode,
      shortUrl: `${baseUrl}/${shortCode}`,
      originalUrl
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}