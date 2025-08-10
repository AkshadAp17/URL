const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// MongoDB connection
let db;
MongoClient.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(client => {
  console.log('Connected to MongoDB');
  db = client.db();
}).catch(err => console.error(err));

// Middleware
app.use(cors());
app.use(express.json());

// Generate short code
const generateShortCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Shorten URL
app.post('/api/shorten', async (req, res) => {
  try {
    const { originalUrl } = req.body;

    if (!originalUrl) {
      return res.status(400).json({ error: 'Original URL is required' });
    }

    // Validate URL
    try {
      new URL(originalUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    let shortCode;
    let existing;

    // Generate unique short code
    do {
      shortCode = generateShortCode();
      existing = await db.collection('urls').findOne({ shortCode });
    } while (existing);

    const urlDoc = {
      originalUrl,
      shortCode,
      createdAt: new Date(),
      clicks: 0,
      clickHistory: []
    };

    await db.collection('urls').insertOne(urlDoc);

    res.json({
      shortCode,
      shortUrl: `${req.protocol}://${req.get('host')}/${shortCode}`,
      originalUrl
    });
  } catch (error) {
    console.error('Error shortening URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Redirect short URL
app.get('/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    const urlDoc = await db.collection('urls').findOne({ shortCode });

    if (!urlDoc) {
      return res.status(404).json({ error: 'URL not found' });
    }

    // Track click
    const clickData = {
      timestamp: new Date(),
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress,
      referer: req.get('Referer') || 'Direct'
    };

    await db.collection('urls').updateOne(
      { shortCode },
      {
        $inc: { clicks: 1 },
        $push: { clickHistory: clickData }
      }
    );

    res.redirect(urlDoc.originalUrl);
  } catch (error) {
    console.error('Error redirecting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get all URLs
app.get('/api/admin/urls', async (req, res) => {
  try {
    const urls = await db.collection('urls')
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(urls);
  } catch (error) {
    console.error('Error fetching URLs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Delete URL
app.delete('/api/admin/urls/:shortCode', async (req, res) => {
  try {
    const { shortCode } = req.params;

    const result = await db.collection('urls').deleteOne({ shortCode });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'URL not found' });
    }

    res.json({ message: 'URL deleted successfully' });
  } catch (error) {
    console.error('Error deleting URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin: Get stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    const totalUrls = await db.collection('urls').countDocuments();
    const totalClicks = await db.collection('urls').aggregate([
      { $group: { _id: null, total: { $sum: '$clicks' } } }
    ]).toArray();

    const topUrls = await db.collection('urls')
      .find({})
      .sort({ clicks: -1 })
      .limit(10)
      .toArray();

    const recentActivity = await db.collection('urls')
      .find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    res.json({
      totalUrls,
      totalClicks: totalClicks[0]?.total || 0,
      topUrls,
      recentActivity
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});