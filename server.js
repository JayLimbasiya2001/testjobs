const express = require('express');
const path = require('path');
const LinkedInJobScraper = require('./linkdinJob');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Serve HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to start scraping
app.post('/api/start-scrape', async (req, res) => {
  try {
    console.log('🚀 Scraping request received');
    
    // Start scraping in the background (don't wait for it to complete)
    const scraper = new LinkedInJobScraper();
    
    // Run scraping asynchronously
    scraper.scrapeJobs()
      .then(results => {
        console.log('✅ Scraping completed:', results);
      })
      .catch(error => {
        console.error('❌ Scraping error:', error);
      });
    
    // Return immediately with a success response
    res.json({
      success: true,
      message: 'Scraping started successfully',
      status: 'Scraping is running in the background. Check the console for progress.'
    });
  } catch (error) {
    console.error('Error starting scraper:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Alternative endpoint that waits for completion (for testing)
app.post('/api/start-scrape-wait', async (req, res) => {
  try {
    console.log('🚀 Scraping request received (waiting for completion)');
    
    const scraper = new LinkedInJobScraper();
    const results = await scraper.scrapeJobs();
    
    res.json({
      success: true,
      totalJobs: results.totalJobs,
      nodeJobs: results.nodeJobs,
      locations: results.locations,
      totalTime: results.totalTime,
      message: 'Scraping completed successfully'
    });
  } catch (error) {
    console.error('Error during scraping:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📄 Open your browser and navigate to http://localhost:${PORT}`);
});

