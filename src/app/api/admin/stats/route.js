import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET() {
  try {
    const { db } = await connectToDatabase();

    // Get total URLs count
    const totalUrls = await db.collection('urls').countDocuments();

    // Get total clicks
    const totalClicksResult = await db.collection('urls').aggregate([
      { $group: { _id: null, total: { $sum: '$clicks' } } }
    ]).toArray();
    const totalClicks = totalClicksResult[0]?.total || 0;

    // Get top URLs by clicks
    const topUrls = await db.collection('urls')
      .find({})
      .sort({ clicks: -1 })
      .limit(10)
      .toArray();

    // Get recent activity (recently created URLs)
    const recentActivity = await db.collection('urls')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    // Serialize the data for JSON response
    const serializedTopUrls = topUrls.map(url => ({
      ...url,
      _id: url._id.toString(),
      createdAt: url.createdAt.toISOString()
    }));

    const serializedRecentActivity = recentActivity.map(url => ({
      ...url,
      _id: url._id.toString(),
      createdAt: url.createdAt.toISOString()
    }));

    // Get daily click statistics for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const dailyStats = await db.collection('urls').aggregate([
      { $unwind: '$clickHistory' },
      { 
        $match: { 
          'clickHistory.timestamp': { $gte: sevenDaysAgo } 
        } 
      },
      {
        $group: {
          _id: {
            year: { $year: '$clickHistory.timestamp' },
            month: { $month: '$clickHistory.timestamp' },
            day: { $dayOfMonth: '$clickHistory.timestamp' }
          },
          clicks: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]).toArray();

    // Get browser statistics from user agents
    const browserStats = await db.collection('urls').aggregate([
      { $unwind: '$clickHistory' },
      {
        $project: {
          userAgent: '$clickHistory.userAgent'
        }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: { $regexMatch: { input: '$userAgent', regex: /Chrome/i } },
              then: 'Chrome',
              else: {
                $cond: {
                  if: { $regexMatch: { input: '$userAgent', regex: /Firefox/i } },
                  then: 'Firefox',
                  else: {
                    $cond: {
                      if: { $regexMatch: { input: '$userAgent', regex: /Safari/i } },
                      then: 'Safari',
                      else: {
                        $cond: {
                          if: { $regexMatch: { input: '$userAgent', regex: /Edge/i } },
                          then: 'Edge',
                          else: 'Other'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    // Get referrer statistics
    const referrerStats = await db.collection('urls').aggregate([
      { $unwind: '$clickHistory' },
      {
        $group: {
          _id: '$clickHistory.referer',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    return NextResponse.json({
      totalUrls,
      totalClicks,
      topUrls: serializedTopUrls,
      recentActivity: serializedRecentActivity,
      dailyStats: dailyStats.map(stat => ({
        date: `${stat._id.year}-${stat._id.month.toString().padStart(2, '0')}-${stat._id.day.toString().padStart(2, '0')}`,
        clicks: stat.clicks
      })),
      browserStats: browserStats.map(stat => ({
        browser: stat._id,
        count: stat.count
      })),
      referrerStats: referrerStats.map(stat => ({
        referrer: stat._id === 'Direct' ? 'Direct' : stat._id || 'Unknown',
        count: stat.count
      }))
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}