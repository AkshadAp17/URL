import mongoose from 'mongoose';

const clickSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  userAgent: String,
  ip: String,
  referer: {
    type: String,
    default: 'Direct'
  }
});

const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  clicks: {
    type: Number,
    default: 0
  },
  clickHistory: [clickSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create indexes for better performance
urlSchema.index({ shortCode: 1 });
urlSchema.index({ createdAt: -1 });
urlSchema.index({ clicks: -1 });

// Prevent model re-compilation during development
const Url = mongoose.models.Url || mongoose.model('Url', urlSchema);

export default Url;