// App.js - Main application component
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';

// Theme configuration
import theme from './theme';

// Core components
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import ErrorBoundary from './components/common/ErrorBoundary';

// Lazy-loaded page components for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const ProductComparison = lazy(() => import('./pages/ProductComparison'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PriceAlerts = lazy(() => import('./pages/PriceAlerts'));

// Loading component for suspense fallback
const PageLoader = () => (
  <div className="page-loader">
    <CircularProgress color="primary" />
    <p>Loading content...</p>
  </div>
);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPreferences, setUserPreferences] = useState(null);
  
  // Check for existing session on app load
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // Load user authentication status from localStorage or API
        const savedAuth = localStorage.getItem('auth');
        if (savedAuth) {
          const userData = JSON.parse(savedAuth);
          setIsAuthenticated(true);
          
          // Fetch user preferences if authenticated
          const preferences = await fetchUserPreferences(userData.userId);
          setUserPreferences(preferences);
        }
      } catch (error) {
        console.error('Authentication check failed:', error);
        // Clear potentially corrupted auth data
        localStorage.removeItem('auth');
      }
    };
    
    checkAuthStatus();
  }, []);
  
  // Mock function to fetch user preferences
  const fetchUserPreferences = async (userId) => {
    // In a real app, this would be an API call
    return {
      darkMode: false,
      savedComparisons: [],
      priceAlerts: [],
      favoriteCategories: []
    };
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ErrorBoundary>
        <Router>
          <Header isAuthenticated={isAuthenticated} />
          <main className="app-content">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/search" element={<SearchResults />} />
                <Route path="/compare/:productIds" element={<ProductComparison />} />
                <Route 
                  path="/dashboard" 
                  element={
                    isAuthenticated ? 
                    <Dashboard userPreferences={userPreferences} /> : 
                    <Navigate to="/login" />
                  } 
                />
                <Route 
                  path="/alerts" 
                  element={
                    isAuthenticated ? 
                    <PriceAlerts /> : 
                    <Navigate to="/login" />
                  } 
                />
                {/* Additional routes would be defined here */}
              </Routes>
            </Suspense>
          </main>
          <Footer />
        </Router>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;

// ProductComparison.js - Main comparison page component
import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Grid, 
  Paper, 
  Typography, 
  Button, 
  Tabs, 
  Tab, 
  CircularProgress, 
  Snackbar, 
  Alert
} from '@mui/material';
import CompareIcon from '@mui/icons-material/Compare';
import ShareIcon from '@mui/icons-material/Share';
import SaveIcon from '@mui/icons-material/Save';
import ProductCard from '../components/products/ProductCard';
import SpecificationTable from '../components/products/SpecificationTable';
import PriceHistoryChart from '../components/charts/PriceHistoryChart';
import ReviewSummary from '../components/products/ReviewSummary';
import { fetchProductDetails, fetchPriceHistory } from '../services/productService';

const ProductComparison = () => {
  const { productIds } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [products, setProducts] = useState([]);
  const [priceHistory, setPriceHistory] = useState({});
  const [activeTab, setActiveTab] = useState(0);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'info' });
  
  // Parse product IDs from URL parameter
  const parsedProductIds = useMemo(() => {
    return productIds ? productIds.split(',') : [];
  }, [productIds]);
  
  // Fetch product data when component mounts or productIds change
  useEffect(() => {
    const getProductData = async () => {
      try {
        setLoading(true);
        
        if (parsedProductIds.length === 0) {
          throw new Error('No products selected for comparison');
        }
        
        // Fetch details for each product
        const productDetailsPromises = parsedProductIds.map(id => fetchProductDetails(id));
        const productsData = await Promise.all(productDetailsPromises);
        setProducts(productsData);
        
        // Fetch price history data for each product
        const priceHistoryPromises = parsedProductIds.map(id => fetchPriceHistory(id));
        const priceHistoryData = await Promise.all(priceHistoryPromises);
        
        // Create a map of product ID to price history
        const priceHistoryMap = {};
        priceHistoryData.forEach((history, index) => {
          priceHistoryMap[parsedProductIds[index]] = history;
        });
        setPriceHistory(priceHistoryMap);
        
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch product comparison data:', error);
        setError(error.message || 'Failed to load comparison data');
        setLoading(false);
      }
    };
    
    getProductData();
  }, [parsedProductIds]);
  
  // Handle tab changes
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Handle saving comparison
  const handleSaveComparison = () => {
    // Save comparison to user's profile or localStorage
    const savedComparisons = JSON.parse(localStorage.getItem('savedComparisons') || '[]');
    
    const comparisonData = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      productIds: parsedProductIds,
      productNames: products.map(p => p.name)
    };
    
    savedComparisons.push(comparisonData);
    localStorage.setItem('savedComparisons', JSON.stringify(savedComparisons));
    
    // Show confirmation notification
    setNotification({
      open: true,
      message: 'Comparison saved successfully!',
      severity: 'success'
    });
  };
  
  // Handle sharing comparison
  const handleShareComparison = async () => {
    try {
      // Create shareable URL
      const shareUrl = window.location.href;
      
      // Use Web Share API if available
      if (navigator.share) {
        await navigator.share({
          title: 'ShopSmart Product Comparison',
          text: `Check out this comparison of ${products.map(p => p.name).join(' vs ')}`,
          url: shareUrl
        });
      } else {
        // Fallback to clipboard copy
        await navigator.clipboard.writeText(shareUrl);
        setNotification({
          open: true,
          message: 'Link copied to clipboard!',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      setNotification({
        open: true,
        message: 'Failed to share comparison',
        severity: 'error'
      });
    }
  };
  
  // Handle adding another product to comparison
  const handleAddProduct = () => {
    // Navigate to search with current comparison maintained
    navigate(`/search?compareWith=${parsedProductIds.join(',')}`);
  };
  
  // Handle notification close
  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };
  
  if (loading) {
    return (
      <Container className="comparison-loading">
        <CircularProgress size={60} />
        <Typography variant="h6" style={{ marginTop: 20 }}>
          Loading comparison data...
        </Typography>
      </Container>
    );
  }
  
  if (error) {
    return (
      <Container>
        <Alert severity="error" style={{ marginTop: 20 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => navigate('/search')}
          style={{ marginTop: 20 }}
        >
          Return to Search
        </Button>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="xl" className="comparison-container">
      {/* Header section */}
      <Grid container spacing={3} className="comparison-header">
        <Grid item xs={12}>
          <Typography variant="h4" component="h1" gutterBottom>
            Product Comparison
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph>
            Comparing {products.length} products across multiple retailers
          </Typography>
          
          {/* Action buttons */}
          <div className="comparison-actions">
            <Button 
              startIcon={<SaveIcon />} 
              variant="outlined" 
              onClick={handleSaveComparison}
            >
              Save Comparison
            </Button>
            <Button 
              startIcon={<ShareIcon />} 
              variant="outlined" 
              onClick={handleShareComparison}
            >
              Share
            </Button>
            <Button 
              startIcon={<CompareIcon />} 
              variant="contained" 
              color="primary" 
              onClick={handleAddProduct}
            >
              Add Another Product
            </Button>
          </div>
        </Grid>
      </Grid>
      
      {/* Product cards row */}
      <Grid container spacing={2} className="product-cards-container">
        {products.map(product => (
          <Grid item xs={12} sm={6} md={4} key={product.id}>
            <ProductCard product={product} />
          </Grid>
        ))}
      </Grid>
      
      {/* Tabs for different comparison views */}
      <Paper elevation={3} className="comparison-tabs-container">
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Specifications" />
          <Tab label="Price History" />
          <Tab label="Reviews" />
        </Tabs>
        
        {/* Tab content */}
        <div className="tab-content">
          {activeTab === 0 && (
            <SpecificationTable products={products} />
          )}
          
          {activeTab === 1 && (
            <PriceHistoryChart 
              products={products} 
              priceHistoryData={priceHistory} 
            />
          )}
          
          {activeTab === 2 && (
            <Grid container spacing={3}>
              {products.map(product => (
                <Grid item xs={12} md={6} key={`review-${product.id}`}>
                  <ReviewSummary product={product} />
                </Grid>
              ))}
            </Grid>
          )}
        </div>
      </Paper>
      
      {/* Notification snackbar */}
      <Snackbar 
        open={notification.open} 
        autoHideDuration={6000} 
        onClose={handleCloseNotification}
      >
        <Alert 
          onClose={handleCloseNotification} 
          severity={notification.severity}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ProductComparison;

// PriceHistoryChart.js - Component for visualizing historical prices
import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { Paper, Typography, FormControl, Select, MenuItem } from '@mui/material';
import { formatDate, formatCurrency } from '../../utils/formatters';

const PriceHistoryChart = ({ products, priceHistoryData }) => {
  const [timeRange, setTimeRange] = React.useState('30');  // Default 30 days
  
  // Process chart data based on selected time range
  const chartData = useMemo(() => {
    if (!products.length || !Object.keys(priceHistoryData).length) {
      return null;
    }
    
    // Calculate date range for filtering
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(timeRange, 10));
    
    // Prepare datasets for each product
    const datasets = products.map((product, index) => {
      const history = priceHistoryData[product.id] || [];
      
      // Filter data points within selected time range
      const filteredHistory = history.filter(point => {
        const pointDate = new Date(point.date);
        return pointDate >= startDate && pointDate <= endDate;
      });
      
      // Generate chart colors based on product index
      const colors = [
        { border: 'rgba(75, 192, 192, 1)', background: 'rgba(75, 192, 192, 0.2)' },
        { border: 'rgba(153, 102, 255, 1)', background: 'rgba(153, 102, 255, 0.2)' },
        { border: 'rgba(255, 159, 64, 1)', background: 'rgba(255, 159, 64, 0.2)' },
        { border: 'rgba(54, 162, 235, 1)', background: 'rgba(54, 162, 235, 0.2)' }
      ];
      
      const colorIndex = index % colors.length;
      
      return {
        label: `${product.name} - ${product.retailer}`,
        data: filteredHistory.map(point => ({ 
          x: new Date(point.date), 
          y: point.price 
        })),
        borderColor: colors[colorIndex].border,
        backgroundColor: colors[colorIndex].background,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.1
      };
    });
    
    return {
      datasets
    };
  }, [products, priceHistoryData, timeRange]);
  
  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeRange <= 14 ? 'day' : 'week',
          tooltipFormat: 'MMM d, yyyy',
          displayFormats: {
            day: 'MMM d',
            week: 'MMM d'
          }
        },
        title: {
          display: true,
          text: 'Date'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Price ($)'
        },
        beginAtZero: false,
        ticks: {
          callback: (value) => formatCurrency(value)
        }
      }
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context) => {
            const product = products[context.datasetIndex];
            const price = context.raw.y;
            return `${product.name}: ${formatCurrency(price)}`;
          }
        }
      },
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Price History Comparison'
      }
    }
  };
  
  // Handle time range change
  const handleTimeRangeChange = (event) => {
    setTimeRange(event.target.value);
  };
  
  if (!chartData) {
    return (
      <Typography variant="body1" color="textSecondary" align="center">
        No price history data available for the selected products.
      </Typography>
    );
  }
  
  return (
    <Paper elevation={0} className="price-history-container">
      <div className="chart-controls">
        <Typography variant="subtitle1">Time Range:</Typography>
        <FormControl variant="outlined" size="small">
          <Select
            value={timeRange}
            onChange={handleTimeRangeChange}
            className="time-range-select"
          >
            <MenuItem value="7">7 Days</MenuItem>
            <MenuItem value="30">30 Days</MenuItem>
            <MenuItem value="90">3 Months</MenuItem>
            <MenuItem value="180">6 Months</MenuItem>
            <MenuItem value="365">1 Year</MenuItem>
          </Select>
        </FormControl>
      </div>
      
      <div className="chart-wrapper" style={{ height: '400px' }}>
        <Line data={chartData} options={chartOptions} />
      </div>
      
      <div className="price-insights">
        {products.map(product => {
          const history = priceHistoryData[product.id] || [];
          if (history.length === 0) return null;
          
          // Calculate price insights
          const filteredHistory = history.filter(point => {
            const pointDate = new Date(point.date);
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - parseInt(timeRange, 10));
            return pointDate >= startDate;
          });
          
          const currentPrice = filteredHistory[filteredHistory.length - 1]?.price || 0;
          const lowestPrice = Math.min(...filteredHistory.map(point => point.price));
          const highestPrice = Math.max(...filteredHistory.map(point => point.price));
          const avgPrice = filteredHistory.reduce((sum, point) => sum + point.price, 0) / filteredHistory.length;
          
          return (
            <div key={`insights-${product.id}`} className="product-price-insights">
              <Typography variant="subtitle2">{product.name} Price Insights:</Typography>
              <Typography variant="body2">
                Current: {formatCurrency(currentPrice)} | 
                Low: {formatCurrency(lowestPrice)} | 
                High: {formatCurrency(highestPrice)} | 
                Avg: {formatCurrency(avgPrice)}
              </Typography>
            </div>
          );
        })}
      </div>
    </Paper>
  );
};

export default PriceHistoryChart;
