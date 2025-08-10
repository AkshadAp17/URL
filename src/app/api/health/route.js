export async function GET() {
  try {
    // Test database connection
    const { db } = await connectToDatabase();
    await db.admin().ping();

    return NextResponse.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: 'Connected',
      service: 'URL Shortener API'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        database: 'Disconnected',
        error: error.message
      },
      { status: 500 }
    );
  }
}