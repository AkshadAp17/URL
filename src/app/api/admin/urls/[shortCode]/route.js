import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request, { params }) {
  try {
    const { shortCode } = params;
    const { db } = await connectToDatabase();

    const url = await db.collection('urls').findOne({ shortCode });

    if (!url) {
      return NextResponse.json(
        { error: 'URL not found' },
        { status: 404 }
      );
    }

    // Convert ObjectId to string for JSON serialization
    const serializedUrl = {
      ...url,
      _id: url._id.toString()
    };

    return NextResponse.json(serializedUrl);
  } catch (error) {
    console.error('Error fetching URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const { shortCode } = params;
    const { db } = await connectToDatabase();

    const result = await db.collection('urls').deleteOne({ shortCode });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'URL not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'URL deleted successfully',
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error('Error deleting URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const { shortCode } = params;
    const { originalUrl, newShortCode } = await request.json();
    const { db } = await connectToDatabase();

    const updateData = {};
    
    if (originalUrl) {
      // Validate URL format
      try {
        new URL(originalUrl);
        updateData.originalUrl = originalUrl;
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    if (newShortCode && newShortCode !== shortCode) {
      // Check if new short code is available
      const existing = await db.collection('urls').findOne({ shortCode: newShortCode });
      if (existing) {
        return NextResponse.json(
          { error: 'New short code already exists' },
          { status: 409 }
        );
      }
      updateData.shortCode = newShortCode;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const result = await db.collection('urls').updateOne(
      { shortCode },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'URL not found' },
        { status: 404 }
      );
    }

    // Get updated document
    const updatedUrl = await db.collection('urls').findOne({ 
      shortCode: newShortCode || shortCode 
    });

    const serializedUrl = {
      ...updatedUrl,
      _id: updatedUrl._id.toString()
    };

    return NextResponse.json(serializedUrl);
  } catch (error) {
    console.error('Error updating URL:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}