const puppeteer = require("puppeteer");
const fs = require("fs");
const nodemailer = require("nodemailer");
const LinkedInEmailScraper = require("./combine");

class AutomationWorkflow {
  constructor() {
    this.baseURL = "https://www.linkedin.com";
    this.googleSearchURL = "https://www.google.com/search";
    this.nodeJobs = [];
    this.allCompanyResults = [];
    this.processedCompanies = new Set(); // Track processed companies
    this.companyProcessingPromises = new Map(); // Track ongoing company processing
    this.emailConfig = {
      service: "gmail",
      auth: {
        user: "jaylimbasiya93@gmail.com",
        pass: "mjsg ikgq yokl bmew",
      },
    };
    
    // Load configuration from file
    this.loadConfig();
  }

  /**
   * Load configuration from automation_config.json
   */
  loadConfig() {
    try {
      if (fs.existsSync("./automation_config.json")) {
        const config = JSON.parse(
          fs.readFileSync("./automation_config.json", "utf8")
        );
        
        // LinkedIn settings
        this.searchQuery = config.linkedin?.searchQuery || 
          '"software engineer" OR "software developer" OR "backend engineer" OR "backend developer" OR "application developer" OR "application engineer" OR "node" OR "full stack"';
        this.locations = config.linkedin?.locations || ["Bangalore", "Pune", "Mumbai", "Gurugram", "Ahmedabad"];
        this.experienceLevels = config.linkedin?.experienceLevels || ["2", "3"];
        this.datePosted = config.linkedin?.datePosted || "r86400";
        this.maxJobsPerLocation = config.linkedin?.maxJobsPerLocation || 500;
        this.delayBetweenJobs = config.linkedin?.delayBetweenJobs || 2000;
        this.navigationTimeout = config.linkedin?.navigationTimeout || 90000;
        this.excludeRemote = config.linkedin?.excludeRemote !== false; // Default true
        this.workplaceTypes = config.linkedin?.workplaceTypes || ["1"]; // 1=On-site, 2=Remote, 3=Hybrid
        
        // Email scraping settings
        this.maxNamesPerCompany = config.emailScraping?.maxNamesPerCompany || 50;
        this.searchRoles = config.emailScraping?.searchRoles || ["hr", "software engineer", "software developer"];
        
        // Parallel processing settings
        this.maxConcurrentCompanies = config.parallelProcessing?.maxConcurrentCompanies || 3;
        
        // Website finder settings
        this.useGoogleSearch = config.websiteFinder?.useGoogleSearch !== false; // Default true
        this.useLinkedIn = config.websiteFinder?.useLinkedIn !== false; // Default true
        this.googleSearchQuery = config.websiteFinder?.googleSearchQuery || "{companyName} official website";
        this.maxRetries = config.websiteFinder?.maxRetries || 2;
        
        console.log("✅ Configuration loaded from automation_config.json");
      } else {
        // Use defaults if config file doesn't exist
        console.log("⚠️  Config file not found, using defaults");
        this.setDefaultConfig();
      }
    } catch (error) {
      console.error("❌ Error loading config:", error.message);
      console.log("⚠️  Using default configuration");
      this.setDefaultConfig();
    }
  }

  /**
   * Set default configuration
   */
  setDefaultConfig() {
    this.searchQuery =
      '"software engineer" OR "software developer" OR "backend engineer" OR "backend developer" OR "application developer" OR "application engineer" OR "node" OR "full stack"';
    this.locations = ["Bangalore", "Pune", "Mumbai", "Gurugram", "Ahmedabad"];
    this.experienceLevels = ["2", "3"];
    this.datePosted = "r86400";
    this.maxJobsPerLocation = 500;
    this.delayBetweenJobs = 2000;
    this.navigationTimeout = 90000;
    this.excludeRemote = true;
    this.workplaceTypes = ["1"];
    this.maxNamesPerCompany = 50;
    this.searchRoles = ["hr", "software engineer", "software developer"];
    this.maxConcurrentCompanies = 3;
    this.useGoogleSearch = true;
    this.useLinkedIn = true;
    this.googleSearchQuery = "{companyName} official website";
    this.maxRetries = 2;
  }

  /**
   * Main automation function with parallel processing
   */
  async runAutomation() {
    console.log("🚀 STARTING COMPLETE AUTOMATION WORKFLOW (PARALLEL MODE)");
    console.log("=".repeat(70));
    console.log(`⏰ Started at: ${new Date().toLocaleString()}\n`);

    const startTime = Date.now();

    try {
      // Step 1: Scrape Node.js jobs and process companies in parallel
      console.log("📋 STEP 1: Scraping Node.js jobs and processing companies in parallel...");
      console.log("-".repeat(70));
      
      await this.scrapeNodeJsJobsAndProcessParallel();
      
      // Wait for all company processing to complete
      console.log("\n⏳ Waiting for all company processing to complete...");
      const allPromises = Array.from(this.companyProcessingPromises.values());
      await Promise.allSettled(allPromises);
      
      console.log(`✅ Found ${this.nodeJobs.length} Node.js jobs`);
      console.log(`✅ Processed ${this.allCompanyResults.length} companies\n`);

      // Step 2: Send comprehensive email report
      console.log("📧 STEP 2: Sending comprehensive email report...");
      console.log("-".repeat(70));
      await this.sendFinalEmailReport();

      const endTime = Date.now();
      const totalTime = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log("\n" + "=".repeat(70));
      console.log("🎉 AUTOMATION COMPLETE!");
      console.log("=".repeat(70));
      console.log(`⏱️  Total Time: ${totalTime} seconds`);
      console.log(`📋 Jobs Found: ${this.nodeJobs.length}`);
      console.log(`🏢 Companies Processed: ${this.allCompanyResults.length}`);
      console.log(`📧 Total Emails Found: ${this.getTotalEmailsCount()}`);
      console.log("=".repeat(70));

    } catch (error) {
      console.error("💥 Error in automation workflow:", error);
    }
  }

  /**
   * Scrape jobs and process companies in parallel as they are found
   */
  async scrapeNodeJsJobsAndProcessParallel() {
    let browser;
    let page;
    const processedJobIds = new Set();
    const companyMap = new Map(); // Track companies as jobs are found

    try {
      browser = await puppeteer.launch({
        headless: false,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
          "--window-size=1400,1000",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--disable-gpu",
        ],
      });

      page = await browser.newPage();
      await this.setStealthMode(page);
      page.setDefaultNavigationTimeout(this.navigationTimeout);
      page.setDefaultTimeout(this.navigationTimeout);

      // Login to LinkedIn
      console.log("🔐 Logging into LinkedIn...");
      const loginSuccess = await this.linkedinLogin(page);
      if (!loginSuccess) {
        console.log("❌ Login failed. Exiting...");
        return;
      }
      console.log("✅ Login successful!\n");

      // Navigate to Jobs section
      console.log("📋 Navigating to Jobs section...");
      await this.navigateToJobsSection(page);

      // Search jobs for each location
      for (const location of this.locations) {
        console.log(`\n📍 Searching jobs in: ${location}`);
        
        const searchSuccess = await this.performSearch(page, location);
        if (!searchSuccess) {
          console.log(`❌ Failed to search for jobs in ${location}`);
          continue;
        }

        await this.delay(5000);
        await this.applyFilters(page);

        // Get job list and scrape each job
        let scrapedCount = 0;
        let scrollAttempts = 0;
        const maxScrollAttempts = 50;

        while (
          scrapedCount < this.maxJobsPerLocation &&
          scrollAttempts < maxScrollAttempts
        ) {
          scrollAttempts++;
          const jobCards = await this.getJobCardsList(page);

          for (
            let i = 0;
            i < jobCards.length && scrapedCount < this.maxJobsPerLocation;
            i++
          ) {
            try {
              const jobData = await this.scrapeJobCard(
                page,
                i,
                location,
                processedJobIds
              );

              if (jobData && !processedJobIds.has(jobData.jobId)) {
                processedJobIds.add(jobData.jobId);
                
                // Filter out remote jobs if excludeRemote is enabled
                if (this.excludeRemote && this.isRemoteJob(jobData)) {
                  console.log(`  ⏭️  Skipping remote job: ${jobData.title} at ${jobData.company}`);
                  continue;
                }
                
                if (this.isNodeJob(jobData)) {
                  this.nodeJobs.push(jobData);
                  scrapedCount++;
                  console.log(
                    `  ✅ [${scrapedCount}] Node.js Job: ${jobData.title} at ${jobData.company}`
                  );

                  // Process company immediately in parallel (don't wait)
                  if (jobData.company && !this.processedCompanies.has(jobData.company)) {
                    // Add to company map
                    if (!companyMap.has(jobData.company)) {
                      companyMap.set(jobData.company, {
                        name: jobData.company,
                        jobs: [],
                      });
                    }
                    companyMap.get(jobData.company).jobs.push({
                      title: jobData.title,
                      location: jobData.jobLocation || jobData.location,
                      url: jobData.jobUrl,
                      postedTime: jobData.postedTime,
                    });

                    // Start processing company in parallel (fire and forget)
                    this.processCompanyInParallel(companyMap.get(jobData.company));
                  } else if (jobData.company && companyMap.has(jobData.company)) {
                    // Add job to existing company
                    companyMap.get(jobData.company).jobs.push({
                      title: jobData.title,
                      location: jobData.jobLocation || jobData.location,
                      url: jobData.jobUrl,
                      postedTime: jobData.postedTime,
                    });
                  }
                }
              }

              await this.delay(this.delayBetweenJobs);
            } catch (error) {
              console.error(`  ❌ Error scraping job ${i}:`, error.message);
            }
          }

          const hasMore = await this.scrollJobList(page);
          if (!hasMore) {
            console.log("  🚫 No more jobs to load");
            break;
          }

          await this.delay(3000);
        }

        console.log(`  ✅ Completed ${location}: ${scrapedCount} Node.js jobs found`);
        
        if (this.locations.indexOf(location) < this.locations.length - 1) {
          await this.delay(5000);
        }
      }

      await browser.close();
    } catch (error) {
      console.error("Error scraping jobs:", error);
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Process company in parallel (website, people, emails)
   */
  async processCompanyInParallel(company) {
    // Avoid duplicate processing
    if (this.processedCompanies.has(company.name)) {
      return;
    }

    // Mark as processing
    this.processedCompanies.add(company.name);
    
    const processingPromise = (async () => {
      try {
        console.log(`\n🏢 [PARALLEL] Starting processing: ${company.name}`);
        
        // Step 1: Find company website
        console.log(`  🌐 [${company.name}] Finding website...`);
        const website = await this.findCompanyWebsite(company.name);
        
        if (!website) {
          console.log(`  ⚠️  [${company.name}] Could not find website, skipping...`);
          this.processedCompanies.delete(company.name); // Allow retry
          return;
        }
        
        console.log(`  ✅ [${company.name}] Found website: ${website}`);

        // Step 2: Find people from company People tab
        console.log(`  👥 [${company.name}] Finding people from LinkedIn company page (People tab)...`);
        if (this.searchRoles.length > 0) {
          console.log(`  🎯 [${company.name}] Filtering by roles: ${this.searchRoles.join(", ")}`);
        } else {
          console.log(`  🎯 [${company.name}] No role filter - getting all people`);
        }
        
        const emailScraper = new LinkedInEmailScraper();
        
        // Get people from company page -> Navigate to People tab -> Extract names
        // This uses the previous logic: find company page -> click People tab -> scrape names
        const people = await emailScraper.getPeopleFromCompany(
          company.name,
          this.maxNamesPerCompany,
          this.searchRoles
        );
        
        if (!people || people.length === 0) {
          console.log(`  ⚠️  [${company.name}] No people found from People tab`);
          return;
        }

        console.log(`  ✅ [${company.name}] Found ${people.length} people from People tab, starting email discovery...`);
        
        // Step 3: Find emails for the people found

        // Find emails for all people (this will process in parallel batches internally)
        const emailResults = await emailScraper.findEmailsForNames(people, website);

        // Save results
        if (emailResults && emailResults.detailedResults) {
          this.allCompanyResults.push({
            company: company.name,
            website: website,
            jobs: company.jobs,
            linkedinNames: people,
            emailResults: emailResults,
          });
          
          console.log(`  ✅ [${company.name}] Complete: ${people.length} names, ${emailResults.emailArray.length} emails`);
        }

      } catch (error) {
        console.error(`  ❌ [${company.name}] Error:`, error.message);
        this.processedCompanies.delete(company.name); // Allow retry
      }
    })();

    // Store promise for tracking
    this.companyProcessingPromises.set(company.name, processingPromise);
    
    // Don't await - let it run in parallel
    return processingPromise;
  }

  /**
   * Find company website using multiple methods (Google + LinkedIn)
   */
  async findCompanyWebsite(companyName) {
    let website = null;
    
    // Try Google search first if enabled
    if (this.useGoogleSearch) {
      console.log(`  🔍 [${companyName}] Trying Google search...`);
      website = await this.findWebsiteViaGoogle(companyName);
      if (website) {
        console.log(`  ✅ [${companyName}] Found via Google: ${website}`);
        return website;
      }
    }
    
    // Try LinkedIn if enabled and Google didn't work
    if (this.useLinkedIn && !website) {
      console.log(`  🔍 [${companyName}] Trying LinkedIn...`);
      website = await this.findWebsiteViaLinkedIn(companyName);
      if (website) {
        console.log(`  ✅ [${companyName}] Found via LinkedIn: ${website}`);
        return website;
      }
    }
    
    // If still not found, try Google again with different query
    if (!website && this.useGoogleSearch) {
      console.log(`  🔍 [${companyName}] Trying Google with different query...`);
      website = await this.findWebsiteViaGoogle(companyName, true);
      if (website) {
        console.log(`  ✅ [${companyName}] Found via Google (retry): ${website}`);
        return website;
      }
    }
    
    console.log(`  ❌ [${companyName}] Website not found`);
    return null;
  }

  /**
   * Find company website via Google search
   */
  async findWebsiteViaGoogle(companyName, useAlternativeQuery = false) {
    let browser;
    let page;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      });

      page = await browser.newPage();
      await this.setStealthMode(page);

      // Build search query
      let searchQuery = useAlternativeQuery 
        ? `${companyName} company website` 
        : this.googleSearchQuery.replace("{companyName}", companyName);
      
      const searchUrl = `${this.googleSearchURL}?q=${encodeURIComponent(searchQuery)}`;
      
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await this.delay(3000);

      // Extract website from Google search results
      const website = await page.evaluate(() => {
        // Strategy 1: Look for official website in search results
        const resultLinks = document.querySelectorAll('div[data-ved] a[href^="http"]');
        
        for (const link of resultLinks) {
          const href = link.getAttribute("href") || "";
          const text = link.textContent?.toLowerCase() || "";
          const parentText = link.closest("div")?.textContent?.toLowerCase() || "";
          
          // Skip Google and other known sites
          if (
            href.includes("google.com") ||
            href.includes("linkedin.com") ||
            href.includes("facebook.com") ||
            href.includes("twitter.com") ||
            href.includes("youtube.com") ||
            href.includes("instagram.com") ||
            href.includes("wikipedia.org") ||
            href.includes("crunchbase.com")
          ) {
            continue;
          }
          
          // Look for official website indicators
          if (
            href.startsWith("http") &&
            (text.includes("official") || 
             text.includes("website") || 
             parentText.includes("official website") ||
             parentText.includes("www.") ||
             href.match(/^https?:\/\/(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/))
          ) {
            // Extract clean URL
            let cleanUrl = href;
            
            // Handle Google redirect URLs
            if (href.includes("/url?q=")) {
              const urlMatch = href.match(/\/url\?q=([^&]+)/);
              if (urlMatch) {
                cleanUrl = decodeURIComponent(urlMatch[1]);
              }
            }
            
            // Validate URL format
            if (cleanUrl.match(/^https?:\/\/(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)) {
              return cleanUrl;
            }
          }
        }
        
        // Strategy 2: Look in "About" section or featured snippet
        const aboutSection = document.querySelector('[data-ved] h3, .g h3, .yuRUbf a');
        if (aboutSection) {
          const links = aboutSection.closest("div")?.querySelectorAll('a[href^="http"]') || [];
          for (const link of links) {
            const href = link.getAttribute("href") || "";
            if (
              href.startsWith("http") &&
              !href.includes("google.com") &&
              !href.includes("linkedin.com") &&
              href.match(/^https?:\/\/(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)
            ) {
              let cleanUrl = href;
              if (href.includes("/url?q=")) {
                const urlMatch = href.match(/\/url\?q=([^&]+)/);
                if (urlMatch) {
                  cleanUrl = decodeURIComponent(urlMatch[1]);
                }
              }
              return cleanUrl;
            }
          }
        }
        
        // Strategy 3: Get first valid result that's not a known site
        const allResultLinks = document.querySelectorAll('div[data-ved] a[href^="http"]');
        for (const link of allResultLinks) {
          const href = link.getAttribute("href") || "";
          if (
            href.startsWith("http") &&
            !href.includes("google.com") &&
            !href.includes("linkedin.com") &&
            !href.includes("facebook.com") &&
            !href.includes("twitter.com") &&
            !href.includes("youtube.com") &&
            !href.includes("wikipedia.org") &&
            href.match(/^https?:\/\/(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)
          ) {
            let cleanUrl = href;
            if (href.includes("/url?q=")) {
              const urlMatch = href.match(/\/url\?q=([^&]+)/);
              if (urlMatch) {
                cleanUrl = decodeURIComponent(urlMatch[1]);
              }
            }
            return cleanUrl;
          }
        }
        
        return null;
      });

      await browser.close();

      if (website) {
        // Clean up website URL
        let cleanWebsite = website.replace(/\/$/, ""); // Remove trailing slash
        if (!cleanWebsite.startsWith("http")) {
          cleanWebsite = `https://${cleanWebsite}`;
        }
        return cleanWebsite;
      }

      return null;
    } catch (error) {
      console.error(`Error finding website via Google for ${companyName}:`, error.message);
      if (browser) {
        await browser.close();
      }
      return null;
    }
  }

  /**
   * Find company website via LinkedIn (improved version)
   */
  async findWebsiteViaLinkedIn(companyName) {
    let browser;
    let page;

    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      });

      page = await browser.newPage();
      await this.setStealthMode(page);

      // Login to LinkedIn
      await this.linkedinLogin(page);

      // Search for company
      const searchUrl = `${this.baseURL}/search/results/all/?keywords=${encodeURIComponent(companyName)}`;
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await this.delay(5000);

      // Click on first company result
      const companyClicked = await page.evaluate(() => {
        const companySelectors = [
          'a[href*="/company/"]',
          ".reusable-search__result-container a",
          ".search-result__result-link",
        ];

        for (const selector of companySelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const href = element.getAttribute("href") || "";
            const text = element.textContent?.toLowerCase() || "";
            
            if (
              href.includes("/company/") && 
              !href.includes("/search/") &&
              !text.includes("see all")
            ) {
              element.scrollIntoView({ behavior: "smooth", block: "center" });
              element.click();
              return true;
            }
          }
        }
        return false;
      });

      if (!companyClicked) {
        await browser.close();
        return null;
      }

      await this.delay(8000); // Wait for page to load

      // Improved website extraction with multiple strategies
      const website = await page.evaluate(() => {
        // Strategy 1: Look for website in org-top-card section (most common)
        const orgTopCard = document.querySelector(".org-top-card-summary-info-list");
        if (orgTopCard) {
          const links = orgTopCard.querySelectorAll('a[href^="http"]');
          for (const link of links) {
            const href = link.getAttribute("href") || "";
            if (
              href.startsWith("http") &&
              !href.includes("linkedin.com") &&
              !href.includes("facebook.com") &&
              !href.includes("twitter.com") &&
              !href.includes("instagram.com") &&
              !href.includes("youtube.com")
            ) {
              return href;
            }
          }
        }

        // Strategy 2: Look for website in org-about-us-organization-description
        const aboutSection = document.querySelector(".org-about-us-organization-description");
        if (aboutSection) {
          const links = aboutSection.querySelectorAll('a[href^="http"]');
          for (const link of links) {
            const href = link.getAttribute("href") || "";
            if (
              href.startsWith("http") &&
              !href.includes("linkedin.com") &&
              !href.includes("facebook.com") &&
              !href.includes("twitter.com") &&
              !href.includes("instagram.com") &&
              !href.includes("youtube.com") &&
              (href.match(/^https?:\/\/(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/))
            ) {
              return href;
            }
          }
        }

        // Strategy 3: Look in org-page-details section
        const detailsSection = document.querySelector(".org-page-details__definition-text");
        if (detailsSection) {
          const links = detailsSection.querySelectorAll('a[href^="http"]');
          for (const link of links) {
            const href = link.getAttribute("href") || "";
            const text = link.textContent?.toLowerCase() || "";
            if (
              href.startsWith("http") &&
              !href.includes("linkedin.com") &&
              !href.includes("facebook.com") &&
              !href.includes("twitter.com") &&
              (text.includes("website") || text.includes("www") || href.includes("www"))
            ) {
              return href;
            }
          }
        }

        // Strategy 4: Look for website button/link in top card
        const websiteButton = document.querySelector('a[data-control-name="topcard_website"]');
        if (websiteButton) {
          const href = websiteButton.getAttribute("href") || "";
          if (href.startsWith("http") && !href.includes("linkedin.com")) {
            return href;
          }
        }

        // Strategy 5: Search all external links on the page (more comprehensive)
        const allExternalLinks = document.querySelectorAll('a[href^="http"]');
        const websiteCandidates = [];
        
        for (const link of allExternalLinks) {
          const href = link.getAttribute("href") || "";
          const text = link.textContent?.toLowerCase().trim() || "";
          const ariaLabel = link.getAttribute("aria-label")?.toLowerCase() || "";
          
          if (
            href.startsWith("http") &&
            !href.includes("linkedin.com") &&
            !href.includes("facebook.com") &&
            !href.includes("twitter.com") &&
            !href.includes("instagram.com") &&
            !href.includes("youtube.com") &&
            !href.includes("pinterest.com") &&
            !href.includes("tumblr.com") &&
            href.match(/^https?:\/\/(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)
          ) {
            // Prioritize links with "website" or "www" in text
            const priority = 
              (text.includes("website") || ariaLabel.includes("website")) ? 3 :
              (text.includes("www") || href.includes("www")) ? 2 :
              (text.length < 30) ? 1 : 0;
            
            websiteCandidates.push({ href, priority });
          }
        }

        // Sort by priority and return the best match
        if (websiteCandidates.length > 0) {
          websiteCandidates.sort((a, b) => b.priority - a.priority);
          return websiteCandidates[0].href;
        }

        return null;
      });

      await browser.close();

      if (website) {
        // Clean up website URL
        let cleanWebsite = website.replace(/\/$/, ""); // Remove trailing slash
        if (!cleanWebsite.startsWith("http")) {
          cleanWebsite = `https://${cleanWebsite}`;
        }
        // Remove LinkedIn redirect if present
        cleanWebsite = cleanWebsite.replace(/^https?:\/\/www\.linkedin\.com\/redirect\/\?url=/, "");
        cleanWebsite = decodeURIComponent(cleanWebsite.split("&")[0]);
        return cleanWebsite;
      }

      return null;
    } catch (error) {
      console.error(`Error finding website via LinkedIn for ${companyName}:`, error.message);
      if (browser) {
        await browser.close();
      }
      return null;
    }
  }

  /**
   * Send final comprehensive email report
   */
  async sendFinalEmailReport() {
    try {
      const transporter = nodemailer.createTransport(this.emailConfig);

      const emailHtml = this.generateEmailHtml();
      const emailText = this.generateEmailText();

      const mailOptions = {
        from: this.emailConfig.auth.user,
        to: "jaylimbasiya93@gmail.com",
        subject: `Complete Automation Report - ${new Date().toLocaleDateString()} (${this.nodeJobs.length} jobs, ${this.allCompanyResults.length} companies)`,
        html: emailHtml,
        text: emailText,
        attachments: [
          {
            filename: `automation_report_${new Date().getTime()}.json`,
            content: JSON.stringify(this.getAllResults(), null, 2),
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      console.log("✅ Email report sent successfully to jaylimbasiya93@gmail.com");
    } catch (error) {
      console.error("❌ Error sending email:", error.message);
    }
  }

  /**
   * Generate HTML email content
   */
  generateEmailHtml() {
    const totalJobs = this.nodeJobs.length;
    const totalCompanies = this.allCompanyResults.length;
    const totalEmails = this.getTotalEmailsCount();
    const timestamp = new Date().toLocaleString();

    let companiesHtml = "";

    this.allCompanyResults.forEach((companyResult, index) => {
      const emailsFound = companyResult.emailResults.emailArray.length;
      const namesFound = companyResult.linkedinNames.length;
      const jobsCount = companyResult.jobs.length;

      companiesHtml += `
        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; background: #f9f9f9;">
          <h3 style="margin: 0 0 10px 0; color: #0073b1;">${index + 1}. ${companyResult.company}</h3>
          <p style="margin: 5px 0;"><strong>Website:</strong> <a href="${companyResult.website}" target="_blank">${companyResult.website}</a></p>
          <p style="margin: 5px 0;"><strong>Jobs Found:</strong> ${jobsCount}</p>
          <p style="margin: 5px 0;"><strong>People Found:</strong> ${namesFound}</p>
          <p style="margin: 5px 0;"><strong>Emails Found:</strong> ${emailsFound}</p>
          
          ${emailsFound > 0 ? `
            <div style="margin-top: 10px; padding: 10px; background: #e7f3ff; border-radius: 3px;">
              <strong>Emails:</strong>
              <ul style="margin: 5px 0; padding-left: 20px;">
                ${companyResult.emailResults.emailArray.map(email => `<li>${email}</li>`).join("")}
              </ul>
            </div>
          ` : ""}
          
          <div style="margin-top: 10px;">
            <strong>Job Listings:</strong>
            <ul style="margin: 5px 0; padding-left: 20px;">
              ${companyResult.jobs.map(job => `<li><a href="${job.url}" target="_blank">${job.title}</a> - ${job.location}</li>`).join("")}
            </ul>
          </div>
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .header { background: #0073b1; color: white; padding: 20px; border-radius: 5px; }
          .stats { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚀 Complete Automation Report</h1>
          <p>LinkedIn Jobs → Company Websites → People → Emails (Parallel Processing)</p>
        </div>
        
        <div class="stats">
          <h2>📊 Summary</h2>
          <p><strong>Total Node.js Jobs Found:</strong> ${totalJobs}</p>
          <p><strong>Companies Processed:</strong> ${totalCompanies}</p>
          <p><strong>Total Emails Found:</strong> ${totalEmails}</p>
          <p><strong>Report Generated:</strong> ${timestamp}</p>
        </div>

        <div>
          <h2>🏢 Company Results (${totalCompanies})</h2>
          ${companiesHtml}
        </div>

        <footer style="margin-top: 30px; padding: 15px; text-align: center; color: #666; border-top: 1px solid #ddd;">
          <p>Generated by Automation Workflow • ${timestamp}</p>
        </footer>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text email content
   */
  generateEmailText() {
    let text = `COMPLETE AUTOMATION REPORT\n`;
    text += `========================\n\n`;
    text += `Total Node.js Jobs Found: ${this.nodeJobs.length}\n`;
    text += `Companies Processed: ${this.allCompanyResults.length}\n`;
    text += `Total Emails Found: ${this.getTotalEmailsCount()}\n`;
    text += `Generated: ${new Date().toLocaleString()}\n\n`;

    text += `COMPANY RESULTS:\n`;
    text += `================\n\n`;

    this.allCompanyResults.forEach((companyResult, index) => {
      text += `${index + 1}. ${companyResult.company}\n`;
      text += `   Website: ${companyResult.website}\n`;
      text += `   Jobs Found: ${companyResult.jobs.length}\n`;
      text += `   People Found: ${companyResult.linkedinNames.length}\n`;
      text += `   Emails Found: ${companyResult.emailResults.emailArray.length}\n`;
      
      if (companyResult.emailResults.emailArray.length > 0) {
        text += `   Emails:\n`;
        companyResult.emailResults.emailArray.forEach(email => {
          text += `     - ${email}\n`;
        });
      }
      
      text += `\n`;
    });

    return text;
  }

  /**
   * Get total emails count
   */
  getTotalEmailsCount() {
    return this.allCompanyResults.reduce((total, company) => {
      return total + (company.emailResults?.emailArray?.length || 0);
    }, 0);
  }

  /**
   * Get all results as JSON
   */
  getAllResults() {
    return {
      summary: {
        totalJobs: this.nodeJobs.length,
        totalCompanies: this.allCompanyResults.length,
        totalEmails: this.getTotalEmailsCount(),
        generatedAt: new Date().toISOString(),
      },
      jobs: this.nodeJobs,
      companyResults: this.allCompanyResults,
    };
  }

  // Helper methods from lkd1.js
  async linkedinLogin(page) {
    try {
      const credentials = this.getLinkedInCredentials();
      if (!credentials.email || !credentials.password) {
        console.log("⚠️  No LinkedIn credentials provided");
        return false;
      }

      await page.goto(`${this.baseURL}/login`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await this.delay(3000);

      await page.waitForSelector("#username, [name='session_key']", {
        timeout: 15000,
      });

      const usernameField =
        (await page.$("#username")) || (await page.$("[name='session_key']"));
      const passwordField =
        (await page.$("#password")) ||
        (await page.$("[name='session_password']"));

      if (usernameField && passwordField) {
        await usernameField.type(credentials.email, { delay: 100 });
        await this.delay(500);
        await passwordField.type(credentials.password, { delay: 100 });
        await this.delay(500);

        const submitButton = await page.$("button[type='submit']");
        if (submitButton) {
          await submitButton.click();
          await this.delay(8000);

          const isLoggedIn = await page.evaluate(() => {
            return (
              document.querySelector(".global-nav, .feed-identity-module") !==
              null
            );
          });

          if (isLoggedIn) {
            await this.delay(3000);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error("❌ Login failed:", error.message);
      return false;
    }
  }

  async setStealthMode(page) {
    await page.setViewport({ width: 1400, height: 1000 });
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
    });
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
    });
  }

  getLinkedInCredentials() {
    if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD) {
      return {
        email: process.env.LINKEDIN_EMAIL,
        password: process.env.LINKEDIN_PASSWORD,
      };
    }

    try {
      if (fs.existsSync("./linkedin_config.json")) {
        const config = JSON.parse(
          fs.readFileSync("./linkedin_config.json", "utf8")
        );
        return {
          email: config.email || "",
          password: config.password || "",
        };
      }
    } catch (error) {
      console.error("Error reading config file:", error.message);
    }

    return { email: "", password: "" };
  }

  async navigateToJobsSection(page) {
    try {
      await page.goto(`${this.baseURL}/jobs/`, {
        waitUntil: "domcontentloaded",
        timeout: this.navigationTimeout,
      });
      await this.delay(5000);
    } catch (error) {
      try {
        await page.goto(`${this.baseURL}/jobs/search/`, {
          waitUntil: "domcontentloaded",
          timeout: this.navigationTimeout,
        });
        await this.delay(5000);
      } catch (e) {
        console.error("Failed to navigate to jobs:", e.message);
      }
    }
  }

  async performSearch(page, location) {
    try {
      const searchSuccess = await page.evaluate(
        (query, loc) => {
          const keywordInputs = document.querySelectorAll(
            'input[aria-label*="Search by title"], input[placeholder*="Search by title"], input.jobs-search-box__text-input'
          );
          const locationInputs = document.querySelectorAll(
            'input[aria-label*="City"], input[placeholder*="City"], input.jobs-search-box__input--location'
          );

          if (keywordInputs.length > 0 && locationInputs.length > 0) {
            const keywordInput = keywordInputs[0];
            keywordInput.value = "";
            keywordInput.focus();
            const inputEvent = new Event("input", { bubbles: true });
            keywordInput.value = query;
            keywordInput.dispatchEvent(inputEvent);

            const locationInput = locationInputs[0];
            locationInput.value = "";
            locationInput.focus();
            locationInput.value = loc;
            locationInput.dispatchEvent(inputEvent);
            return true;
          }
          return false;
        },
        this.searchQuery,
        location
      );

      if (searchSuccess) {
        await this.delay(2000);
        await page.evaluate(() => {
          const searchButtons = document.querySelectorAll(
            'button.jobs-search-box__submit-button, button[aria-label*="Search"]'
          );
          if (searchButtons.length > 0) {
            searchButtons[0].click();
          }
        });
        await this.delay(8000);
        return true;
      }

      const searchUrl = this.buildSearchUrl(location);
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await this.delay(5000);
      return true;
    } catch (error) {
      console.error("Error performing search:", error.message);
      return false;
    }
  }

  buildSearchUrl(location) {
    const params = new URLSearchParams({
      keywords: this.searchQuery,
      location: location,
      f_E: this.experienceLevels.join(","),
      f_TPR: this.datePosted,
      sortBy: "DD",
    });
    
    // Add workplace type filter (exclude remote jobs)
    if (this.excludeRemote && this.workplaceTypes.length > 0) {
      params.append("f_WT", this.workplaceTypes.join(","));
    }
    
    return `${this.baseURL}/jobs/search/?${params.toString()}`;
  }

  async applyFilters(page) {
    try {
      await this.delay(3000);
      
      // Apply workplace type filter if needed (exclude remote)
      if (this.excludeRemote) {
        await page.evaluate(() => {
          // Look for workplace type filter button
          const workplaceButtons = document.querySelectorAll(
            'button[aria-label*="Workplace type"], button[aria-label*="Workplace Type"], button[data-control-name*="workplace_type"]'
          );
          
          for (const button of workplaceButtons) {
            const text = button.textContent?.toLowerCase() || "";
            if (text.includes("workplace") || text.includes("remote")) {
              button.click();
              return true;
            }
          }
          return false;
        });
        
        await this.delay(2000);
        
        // Select On-site only (exclude Remote)
        await page.evaluate((workplaceTypes) => {
          // Look for checkboxes or options
          const checkboxes = document.querySelectorAll('input[type="checkbox"]');
          const labels = document.querySelectorAll("label, li, span");
          
          for (const checkbox of checkboxes) {
            const label = checkbox.closest("label")?.textContent?.toLowerCase() || "";
            const ariaLabel = checkbox.getAttribute("aria-label")?.toLowerCase() || "";
            
            // Uncheck Remote
            if ((label.includes("remote") || ariaLabel.includes("remote")) && checkbox.checked) {
              checkbox.click();
            }
            
            // Check On-site
            if ((label.includes("on-site") || label.includes("onsite") || ariaLabel.includes("on-site")) && !checkbox.checked && workplaceTypes.includes("1")) {
              checkbox.click();
            }
          }
        }, this.workplaceTypes);
        
        await this.delay(2000);
        
        // Click show results or apply button
        await page.evaluate(() => {
          const applyButtons = document.querySelectorAll(
            'button[aria-label*="Show results"], button[aria-label*="Apply"], button[data-control-name*="apply"]'
          );
          if (applyButtons.length > 0) {
            applyButtons[0].click();
          }
        });
        
        await this.delay(3000);
      }
      
      console.log("✅ Filters applied (Remote jobs excluded: " + this.excludeRemote + ")");
    } catch (error) {
      console.error("Error applying filters:", error.message);
    }
  }

  async getJobCardsList(page) {
    return await page.evaluate(() => {
      const cards = document.querySelectorAll(
        ".jobs-search-results__list-item, .job-card-container, .scaffold-layout__list-item, [data-job-id]"
      );
      return Array.from(cards).map((card, index) => index);
    });
  }

  async scrapeJobCard(page, index, location, processedJobIds) {
    try {
      const clicked = await page.evaluate((idx) => {
        const cards = document.querySelectorAll(
          ".jobs-search-results__list-item, .job-card-container, .scaffold-layout__list-item, [data-job-id]"
        );

        if (cards[idx]) {
          cards[idx].scrollIntoView({ behavior: "smooth", block: "center" });
          const clickableElements = [
            cards[idx].querySelector("a"),
            cards[idx].querySelector(".job-card-list__title"),
            cards[idx],
          ];

          for (const element of clickableElements) {
            if (element) {
              element.click();
              return true;
            }
          }
        }
        return false;
      }, index);

      if (!clicked) {
        return null;
      }

      await this.delay(4000);

      const jobData = await page.evaluate((loc) => {
        const data = {
          location: loc,
          scrapedAt: new Date().toISOString(),
        };

        const titleSelectors = [
          ".job-details-jobs-unified-top-card__job-title",
          ".jobs-unified-top-card__job-title",
          "h1.t-24",
          ".jobs-details-top-card__job-title",
        ];
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.title = element.textContent.trim();
            break;
          }
        }

        const companySelectors = [
          ".job-details-jobs-unified-top-card__company-name",
          ".jobs-unified-top-card__company-name",
          ".jobs-details-top-card__company-url",
          "a.ember-view.t-black",
        ];
        for (const selector of companySelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.company = element.textContent.trim();
            break;
          }
        }

        const locationSelectors = [
          ".job-details-jobs-unified-top-card__bullet",
          ".jobs-unified-top-card__bullet",
        ];
        for (const selector of locationSelectors) {
          const elements = document.querySelectorAll(selector);
          for (const element of elements) {
            const text = element.textContent.trim();
            if (text && (text.includes(",") || text.includes("India"))) {
              data.jobLocation = text;
              break;
            }
          }
          if (data.jobLocation) break;
        }

        const postedSelectors = [
          ".jobs-unified-top-card__posted-date",
          ".job-details-jobs-unified-top-card__posted-date",
        ];
        for (const selector of postedSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            data.postedTime = element.textContent.trim();
            break;
          }
        }

        // Workplace Type (Remote, On-site, Hybrid)
        const workplaceSelectors = [
          ".jobs-unified-top-card__workplace-type",
          ".job-details-jobs-unified-top-card__workplace-type",
          '[data-test-id="workplace-type"]',
        ];
        for (const selector of workplaceSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.workplaceType = element.textContent.trim();
            break;
          }
        }

        const currentUrl = window.location.href;
        const jobIdMatch =
          currentUrl.match(/currentJobId=(\d+)/) ||
          currentUrl.match(/jobs\/view\/(\d+)/);
        if (jobIdMatch) {
          data.jobId = jobIdMatch[1];
          data.jobUrl = `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}`;
        }

        const descriptionSelectors = [
          ".jobs-description__content",
          ".jobs-box__html-content",
          "#job-details",
        ];
        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            data.description = element.textContent.trim().substring(0, 3000);
            break;
          }
        }

        return data;
      }, location);

      if (jobData.title && jobData.company && jobData.jobId) {
        if (!processedJobIds.has(jobData.jobId)) {
          return jobData;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  isNodeJob(jobData) {
    if (!jobData) return false;

    const searchText = `${jobData.title || ""} ${jobData.description || ""}`.toLowerCase();

    const nodeKeywords = [
      "node.js",
      "nodejs",
      "node js",
      "express.js",
      "expressjs",
      "nestjs",
      "nest.js",
      "fastify",
      "javascript backend",
      "js backend",
      "backend javascript",
    ];

    return nodeKeywords.some((keyword) => searchText.includes(keyword));
  }

  /**
   * Check if job is remote
   */
  isRemoteJob(jobData) {
    if (!jobData) return false;

    const workplaceType = (jobData.workplaceType || "").toLowerCase();
    const location = (jobData.jobLocation || jobData.location || "").toLowerCase();
    const description = (jobData.description || "").toLowerCase();
    const title = (jobData.title || "").toLowerCase();

    // Check workplace type
    if (workplaceType.includes("remote") || workplaceType === "remote") {
      return true;
    }

    // Check location
    if (location.includes("remote") || location === "remote") {
      return true;
    }

    // Check description for remote keywords
    const remoteKeywords = [
      "remote work",
      "work remotely",
      "remote position",
      "work from home",
      "wfh",
      "fully remote",
      "100% remote",
    ];

    if (remoteKeywords.some((keyword) => description.includes(keyword) || title.includes(keyword))) {
      return true;
    }

    return false;
  }

  async scrollJobList(page) {
    return await page.evaluate(async () => {
      const jobList = document.querySelector(
        ".jobs-search-results-list, .scaffold-layout__list, .scaffold-layout__list-container"
      );

      if (!jobList) return false;

      const beforeHeight = jobList.scrollHeight;
      jobList.scrollTo(0, jobList.scrollHeight);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const afterHeight = jobList.scrollHeight;

      return afterHeight > beforeHeight;
    });
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Run automation
(async () => {
  const automation = new AutomationWorkflow();
  await automation.runAutomation();
})();
