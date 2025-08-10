import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/mongodb';

async function getUrlByShortCode(shortCode) {
  try {
    const { db } = await connectToDatabase();
    
    const urlDoc = await db.collection('urls').findOne({ shortCode });
    
    if (!urlDoc) {
      return null;
    }

    // Track the click
    const clickData = {
      timestamp: new Date(),
      userAgent: 'Server-side render',
      ip: 'unknown',
      referer: 'Direct'
    };

    // Update click count and history
    await db.collection('urls').updateOne(
      { shortCode },
      {
        $inc: { clicks: 1 },
        $push: { clickHistory: clickData }
      }
    );

    return urlDoc;
  } catch (error) {
    console.error('Error fetching URL:', error);
    return null;
  }
}

export default async function ShortCodeRedirect({ params }) {
  const { shortCode } = params;
  
  const urlDoc = await getUrlByShortCode(shortCode);
  
  if (!urlDoc) {
    // Return a 404 page instead of redirecting
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mb-6">
            <svg className="w-16 h-16 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">URL Not Found</h1>
            <p className="text-gray-600 mb-6">
              The short URL <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">/{shortCode}</code> doesn't exist or has been removed.
            </p>
            <a 
              href="/" 
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create New Short URL
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to the original URL
  redirect(urlDoc.originalUrl);
}