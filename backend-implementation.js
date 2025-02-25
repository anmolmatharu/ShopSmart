// server.js - Main entry point for the Express.js backend
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Route imports
const productRoutes = require('./routes/productRoutes');
const searchRoutes = require('./routes/searchRoutes');
const comparisonRoutes = require('./routes/comparisonRoutes');
const userRoutes = require('./routes/userRoutes');
const alertRoutes = require('./routes/alertRoutes');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(morgan('dev')); // Logging
app.use(cors()); // Cross-origin resource sharing
app.use(express.json()); // Parse JSON request bodies

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', apiLimiter);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false
})
.then(() => console.log('MongoDB connected'))
.catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/comparisons', comparisonRoutes);
app.use('/api/users', userRoutes);
app.use('/api/alerts', alertRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// models/Product.js - MongoDB schema for product data
const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  externalId: {
    type: String,
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  brand: {
    type: String,
    required: true,
    index: true
  },
  retailer: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  subCategory: {
    type: String,
    index: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  additionalImages: [String],
  currentPrice: {
    type: Number,
    required: true
  },
  originalPrice: {
    type: Number
  },
  currency: {
    type: String,
    default: 'USD'
  },
  discount: {
    type: Number,
    default: 0
  },
  url: {
    type: String,
    required: true
  },
  specifications: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  stock: {
    status: {
      type: String,
      enum: ['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'BACK_ORDERED'],
      default: 'IN_STOCK'
    },
    quantity: {
      type: Number
    }
  },
  ratings: {
    average: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    count: {
      type: Number,
      default: 0
    }
  },
  reviews: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Review'
  }],
  metadata: {
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }
}, { timestamps: true });

// Create text index for search functionality
ProductSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text'
});

module.exports = mongoose.model('Product', ProductSchema);

// models/PriceHistory.js - MongoDB schema for price history tracking
const mongoose = require('mongoose');

const PricePointSchema = new mongoose.Schema({
  price: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  retailer: {
    type: String,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  isPromotion: {
    type: Boolean,
    default: false
  },
  promotionDetails: {
    type: String
  }
});

const PriceHistorySchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  externalId: {
    type: String,
    required: true
  },
  pricePoints: [PricePointSchema],
  lowestPrice: {
    price: Number,
    date: Date
  },
  highestPrice: {
    price: Number,
    date: Date
  },
  metadata: {
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  }
});

// Middleware to update lowest and highest prices before saving
PriceHistorySchema.pre('save', function(next) {
  if (this.pricePoints && this.pricePoints.length > 0) {
    // Find lowest price
    const lowestPricePoint = this.pricePoints.reduce((lowest, current) => {
      return (current.price < lowest.price) ? current : lowest;
    }, this.pricePoints[0]);
    
    // Find highest price
    const highestPricePoint = this.pricePoints.reduce((highest, current) => {
      return (current.price > highest.price) ? current : highest;
    }, this.pricePoints[0]);
    
    this.lowestPrice = {
      price: lowestPricePoint.price,
      date: lowestPricePoint.date
    };
    
    this.highestPrice = {
      price: highestPricePoint.price,
      date: highestPricePoint.date
    };
  }
  
  this.metadata.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('PriceHistory', PriceHistorySchema);

// models/User.js - MongoDB schema for user data
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  profile: {
    firstName: String,
    lastName: String,
    avatar: String
  },
  preferences: {
    favoriteCategories: [String],
    preferredRetailers: [String],
    darkMode: {
      type: Boolean,
      default: false
    },
    emailNotifications: {
      type: Boolean,
      default: true
    }
  },
  savedComparisons: [{
    productIds: [String],
    title: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  savedProducts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  priceAlerts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PriceAlert'
  }],
  isVerified: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password for login
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);

// services/productService.js - Service for product-related operations
const Product = require('../models/Product');
const PriceHistory = require('../models/PriceHistory');
const ApiError = require('../utils/ApiError');
const { scrapeSingleProduct } = require('./scraperService');
const redisClient = require('../config/redis');

/**
 * Get product by ID with caching
 */
const getProductById = async (productId) => {
  try {
    // Try to get from cache first
    const cachedProduct = await redisClient.get(`product:${productId}`);
    if (cachedProduct) {
      return JSON.parse(cachedProduct);
    }
    
    // If not in cache, fetch from database
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Store in cache for 1 hour
    await redisClient.set(
      `product:${productId}`,
      JSON.stringify(product),
      'EX',
      3600
    );
    
    return product;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error fetching product', error);
  }
};

/**
 * Get price history for a product
 */
const getPriceHistory = async (productId, timeRange = 30) => {
  try {
    const cacheKey = `priceHistory:${productId}:${timeRange}`;
    
    // Try to get from cache first
    const cachedHistory = await redisClient.get(cacheKey);
    if (cachedHistory) {
      return JSON.parse(cachedHistory);
    }
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - timeRange);
    
    // Fetch price history
    const priceHistory = await PriceHistory.findOne({ productId });
    
    if (!priceHistory) {
      return [];
    }
    
    // Filter price points by date range
    const filteredPricePoints = priceHistory.pricePoints.filter(point => {
      const pointDate = new Date(point.date);
      return pointDate >= startDate && pointDate <= endDate;
    });
    
    // Cache the result for 1 hour
    await redisClient.set(
      cacheKey,
      JSON.stringify(filteredPricePoints),
      'EX',
      3600
    );
    
    return filteredPricePoints;
  } catch (error) {
    throw new ApiError(500, 'Error fetching price history', error);
  }
};

/**
 * Search products with various filters
 */
const searchProducts = async (query) => {
  try {
    const {
      searchTerm,
      category,
      brand,
      retailer,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
      page = 1,
      limit = 20
    } = query;
    
    // Build search filter
    const filter = {};
    
    if (searchTerm) {
      filter.$text = { $search: searchTerm };
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (brand) {
      filter.brand = brand;
    }
    
    if (retailer) {
      filter.retailer = retailer;
    }
    
    if (minPrice || maxPrice) {
      filter.currentPrice = {};
      
      if (minPrice) {
        filter.currentPrice.$gte = parseFloat(minPrice);
      }
      
      if (maxPrice) {
        filter.currentPrice.$lte = parseFloat(maxPrice);
      }
    }
    
    // Build sort options
    const sort = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
      // Default sort by relevance if text search is used, otherwise by newest
      sort[searchTerm ? 'score' : 'createdAt'] = -1;
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Execute search query
    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('name brand retailer imageUrl currentPrice originalPrice ratings stock category');
    
    // Get total count for pagination
    const total = await Product.countDocuments(filter);
    
    return {
      products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw new ApiError(500, 'Error searching products', error);
  }
};

/**
 * Update product price and availability from retailer site
 */
const refreshProductData = async (productId) => {
  try {
    const product = await Product.findById(productId);
    
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Scrape latest data from retailer
    const freshData = await scrapeSingleProduct(product.retailer, product.url);
    
    if (!freshData) {
      throw new ApiError(500, 'Failed to refresh product data');
    }
    
    // Check if price has changed
    const priceChanged = product.currentPrice !== freshData.price;
    
    // Update product data
    product.currentPrice = freshData.price;
    product.stock = freshData.stock;
    product.metadata.lastUpdated = new Date();
    
    if (freshData.originalPrice) {
      product.originalPrice = freshData.originalPrice;
      product.discount = ((freshData.originalPrice - freshData.price) / freshData.originalPrice) * 100;
    }
    
    await product.save();
    
    // If price changed, update price history
    if (priceChanged) {
      let priceHistory = await PriceHistory.findOne({ productId });
      
      if (!priceHistory) {
        priceHistory = new PriceHistory({
          productId,
          externalId: product.externalId,
          pricePoints: []
        });
      }
      
      priceHistory.pricePoints.push({
        price: freshData.price,
        date: new Date(),
        retailer: product.retailer,
        isPromotion: freshData.isPromotion,
        promotionDetails: freshData.promotionDetails
      });
      
      await priceHistory.save();
      
      // Clear cache
      await redisClient.del(`product:${productId}`);
      await redisClient.del(`priceHistory:${productId}:*`);
    }
    
    return product;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'Error refreshing product data', error);
  }
};

module.exports = {
  getProductById,
  getPriceHistory,
  searchProducts,
  refreshProductData
};

// controllers/productController.js - Handler for product-related routes
const productService = require('../services/productService');
const catchAsync = require('../utils/catchAsync');

/**
 * Get a product by ID
 * @route GET /api/products/:id
 * @access Public
 */
const getProduct = catchAsync(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  res.json({ success: true, data: product });
});

/**
 * Get price history for a product
 * @route GET /api/products/:id/price-history
 * @access Public
 */
const getPriceHistory = catchAsync(async (req, res) => {
  const { timeRange } = req.query;
  const priceHistory = await productService.getPriceHistory(
    req.params.id,
    timeRange ? parseInt(timeRange) : 30
  );
  res.json({ success: true, data: priceHistory });
});

/**
 * Search for products
 * @route GET /api/products/search
 * @access Public
 */
const searchProducts = catchAsync(async (req, res) => {
  const result = await productService.searchProducts(req.query);
  res.json({ success: true, data: result });
});

/**
 * Refresh product data from retailer
 * @route POST /api/products/:id/refresh
 * @access Public
 */
const refreshProduct = catchAsync(async (req, res) => {
  const product = await productService.refreshProductData(req.params.id);
  res.json({ success: true, data: product });
});

module.exports = {
  getProduct,
  getPriceHistory,
  searchProducts,
  refreshProduct
};

// controllers/comparisonController.js - Handler for comparison-related routes
const Product = require('../models/Product');
const User = require('../models/User');
const productService = require('../services/productService');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

/**
 * Get comparison data for multiple products
 * @route GET /api/comparisons
 * @access Public
 */
const getComparisonData = catchAsync(async (req, res) => {
  const { productIds } = req.query;
  
  if (!productIds) {
    throw new ApiError(400, 'Product IDs are required');
  }
  
  const idArray = productIds.split(',');
  
  // Validate product IDs
  if (idArray.length < 2) {
    throw new ApiError(400, 'At least two products are required for comparison');
  }
  
  if (idArray.length > 5) {
    throw new ApiError(400, 'Maximum of 5 products can be compared at once');
  }
  
  // Fetch products in parallel
  const productPromises = idArray.map(id => productService.getProductById(id));
  const products = await Promise.all(productPromises);
  
  // Fetch price history in parallel
  const priceHistoryPromises = idArray.map(id => productService.getPriceHistory(id, 180));
  const priceHistories = await Promise.all(priceHistoryPromises);
  
  // Create a map of product ID to price history
  const priceHistoryMap = {};
  idArray.forEach((id, index) => {
    priceHistoryMap[id] = priceHistories[index];
  });
  
  // Extract unique specification keys across all products
  const specKeys = new Set();
  products.forEach(product => {
    if (product.specifications) {
      Object.keys(product.specifications).forEach(key => specKeys.add(key));
    }
  });
  
  res.json({
    success: true,
    data: {
      products,
      priceHistories: priceHistoryMap,
      specificationKeys: Array.from(specKeys)
    }
  });
});

/**
 * Save a comparison for a user
 * @route POST /api/comparisons/save
 * @access Private
 */
const saveComparison = catchAsync(async (req, res) => {
  const { productIds, title } = req.body;
  const userId = req.user.id;
  
  if (!productIds || productIds.length < 2) {
    throw new ApiError(400, 'At least two product IDs are required');
  }
  
  // Find user
  const user = await User.findById(userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Add new comparison
  user.savedComparisons.push({
    productIds,
    title: title || `Comparison ${user.savedComparisons.length + 1}`,
    createdAt: new Date()
  });
  
  await user.save();
  
  res.status(201).json({
    success: true,
    message: 'Comparison saved successfully',
    data: user.savedComparisons[user.savedComparisons.length - 1]
  });
});

/**
 * Get all saved comparisons for a user
 * @route GET /api/comparisons/saved
 * @access Private
 */
const getSavedComparisons = catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  const user = await User.findById(userId).select('savedComparisons');
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  res.json({
    success: true,
    data: user.savedComparisons
  });
});

/**
 * Delete a saved comparison
 * @route DELETE /api/comparisons/saved/:comparisonId
 * @access Private
 */
const deleteComparison = catchAsync(async (req, res) => {
  const { comparisonId } = req.params;
  const userId = req.user.id;
  
  const user = await User.findById(userId);
  
  if (!user) {
    throw new ApiError(404, 'User not found');
  }
  
  // Find the comparison index
  const comparisonIndex = user.savedComparisons.findIndex(
    comp => comp._id.toString() === comparisonId
  );
  
  if (comparisonIndex === -1) {
    throw new ApiError(404, 'Comparison not found');
  }
  
  // Remove the comparison
  user.savedComparisons.splice(comparisonIndex, 1);
  await user.save();
  
  res.json({
    success: true,
    message: 'Comparison deleted successfully'
  });
});

module.exports = {
  getComparisonData,
  saveComparison,
  getSavedComparisons,
  deleteComparison
};

// routes/productRoutes.js - Route definitions for product endpoints
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.get('/search', productController.searchProducts);
router.get('/:id', productController.getProduct);
router.get('/:id/price-history', productController.getPriceHistory);

// Protected routes (require authentication)
router.post('/:id/refresh', protect, productController.refreshProduct);

module.exports = router;

// routes/comparisonRoutes.js - Route definitions for comparison endpoints
const express = require('express');
const router = express.Router();
const comparisonController = require('../controllers/comparisonController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.get('/', comparisonController.getComparisonData);

// Protected routes (require authentication)
router.post('/save', protect, comparisonController.saveComparison);
router.get('/saved', protect, comparisonController.getSavedComparisons);
router.delete('/saved/:comparisonId', protect, comparisonController.deleteComparison);

module.exports = router;

// middleware/authMiddleware.js - Authentication middleware
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');

// Middleware to protect routes that require authentication
exports.protect = catchAsync(async (req, res, next) => {
  let token;
  
  // Check for token in headers
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }
  
  // Check if token exists
  if (!token) {
    throw new ApiError(401, 'Not authorized to access this route');
  }
  
  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID from token
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    throw new ApiError(401, 'Authentication failed');
  }
});

// utils/ApiError.js - Custom error class for API errors
class ApiError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;

// utils/catchAsync.js - Utility to handle async function errors
/**
 * Wraps an async function and forwards any errors to next()
 * @param {Function} fn - Async function to wrap
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;

// services/scraperService.js - Service for scraping product data from retailers
const puppeteer = require('puppeteer');
const axios = require('axios');
const cheerio = require('cheerio');
const ApiError = require('../utils/ApiError');

// Configuration for different retailers
const retailerConfig = {
  amazon: {
    selectors: {
      name: '#productTitle',
      price: '#priceblock_ourprice, .a-price .a-offscreen',
      originalPrice: '#priceblock_listprice, .a-text-strike',
      stock: '#availability',
      image: '#landingImage'
    }
  },
  walmart: {
    selectors: {
      name: '.prod-ProductTitle',
      price: '.price-characteristic',
      originalPrice: '.strike-through .visuallyhidden',
      stock: '.prod-ProductOffer-oosMsg',
      image: '.prod-hero-image img'
    }
  },
  target: {
    selectors: {
      name: '[data-test="product-title"]',
      price: '[data-test="product-price"]',
      originalPrice: '[data-test="product-regular-price"]',
      stock: '.h-text-orangeDark, .h-text-green',
      image: '[data-test="image-gallery-current-image"]'
    }
  }
};

/**
 * Scrape a single product from a retailer's website
 * @param {string} retailer - The retailer name (amazon, walmart, target)
 * @param {string} url - The product URL
 * @returns {Object} - Scraped product data
 */
const scrapeSingleProduct = async (retailer, url) => {
  try {
    if (!retailerConfig[retailer.toLowerCase()]) {
      throw new ApiError(400, `Unsupported retailer: ${retailer}`);
    }
    
    const config = retailerConfig[retailer.toLowerCase()];
    
    // For simple scraping, we use axios + cheerio
    // For complex sites that require JavaScript, we'd use puppeteer
    
    let html;
    if (retailer.toLowerCase() === 'amazon') {
      // Amazon often requires a more sophisticated approach
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      // Set user agent to avoid being blocked
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      await page.goto(url, { waitUntil: 'networkidle2' });
      html = await page.content();
      await browser.close();
    } else {
      // For other retailers, try simple HTTP request first
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      html = response.data;
    }
    
    const $ = cheerio.load(html);
    
    // Extract product details
    const name = $(config.selectors.name).text().trim();
    const priceText = $(config.selectors.price).text().trim();
    const originalPriceText = $(config.selectors.originalPrice).text().trim();
    const stockText = $(config.selectors.stock).text().trim();
    const imageUrl = $(config.selectors.image).attr('src');
    
    // Parse price (remove currency symbol and commas)
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    
    // Parse original price if available
    let originalPrice = null;
    if (originalPriceText) {
      originalPrice = parseFloat(originalPriceText.replace(/[^0-9.]/g, ''));
    }
    
    // Determine stock status
    let stockStatus = 'IN_STOCK';
    if (stockText.toLowerCase().includes('out of stock') || stockText.toLowerCase().includes('unavailable')) {
      stockStatus = 'OUT_OF_STOCK';
    } else if (stockText.toLowerCase().includes('few') || stockText.toLowerCase().includes('limited')) {
      stockStatus = 'LOW_STOCK';
    } else if (stockText.toLowerCase().includes('back order') || stockText.toLowerCase().includes('pre-order')) {
      stockStatus = 'BACK_ORDERED';
    }
    
    return {
      name,
      price,
      originalPrice,
      stock: {
        status: stockStatus,
        text: stockText
      },
      imageUrl,
      isPromotion: originalPrice !== null && originalPrice > price,
      promotionDetails: originalPrice !== null ? `Save ${((originalPrice - price) / originalPrice * 100).toFixed(0)}%` : null