require("dotenv").config();
const fs = require("fs");
const nodemailer = require("nodemailer");

// Conditional imports for Vercel compatibility
let puppeteer, puppeteerCore, chromium;

// Try to import puppeteer (for local development)
try {
  puppeteer = require("puppeteer");
} catch (e) {
  console.log("puppeteer not available, will use puppeteer-core");
}

// Try to import puppeteer-core (for production/Vercel)
try {
  puppeteerCore = require("puppeteer-core");
} catch (e) {
  console.log("puppeteer-core not available");
}

// Try to import chromium-min (for Vercel)
try {
  chromium = require("@sparticuz/chromium-min");
} catch (e) {
  console.log("@sparticuz/chromium-min not available");
}

class LinkedInJobScraper {
  constructor() {
    this.baseURL = "https://www.linkedin.com";
    this.delayBetweenJobs = 2000;
    this.delayBetweenLocations = 5000;
    this.maxJobsPerLocation = 500;
    this.navigationTimeout = 90000;

    // Search parameters
    this.searchQuery =
      '"software engineer" OR "software developer" OR "backend engineer" OR "backend developer" OR "application developer" OR "application engineer" OR "node" OR "full stack"';
    this.locations = ["Bangalore", "Pune", "Mumbai", "Gurugram", "Ahmedabad"];
    this.experienceLevels = ["2", "3"]; // Entry level, Associate, Mid-Senior
    this.datePosted = "r86400"; // Past 24 hours
    this.workplaceTypes = ["1"]; // 1=On-site, 2=Remote, 3=Hybrid

    this.allJobs = [];
    this.nodeJobs = [];

    // Email configuration
    this.emailConfig = {
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER || "jaylimbasiya93@gmail.com",
        pass: process.env.EMAIL_PASS || "mjsg ikgq yokl bmew",
      },
    };

    // Check if running in production (Vercel)
    this.isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.VERCEL_ENV === "production";
  }

  /**
   * Launch browser with Vercel compatibility
   */
  /**
   * Launch browser with Vercel compatibility - IMPROVED
   */
  async launchBrowser() {
    if (this.isProduction && puppeteerCore && chromium) {
      // Production/Vercel: Use puppeteer-core with chromium-min
      console.log("🚀 Launching browser for production (Vercel)...");

      try {
        const executablePath = await chromium.executablePath(
          "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
        );

        return await puppeteerCore.launch({
          executablePath,
          args: [
            ...chromium.args,
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--disable-gpu",
            "--window-size=1400,1000",
          ],
          headless: chromium.headless,
          defaultViewport: chromium.defaultViewport,
          ignoreHTTPSErrors: true,
        });
      } catch (error) {
        console.error("❌ Chromium launch failed:", error.message);
        throw error;
      }
    } else if (puppeteer) {
      // Development: Use regular puppeteer
      console.log("🚀 Launching browser for development...");
      return await puppeteer.launch({
        headless: false, // Keep false for debugging
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
    } else if (puppeteerCore) {
      // Fallback: Use puppeteer-core without chromium
      console.log("⚠️ Using puppeteer-core without chromium");
      return await puppeteerCore.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--window-size=1400,1000",
        ],
      });
    } else {
      throw new Error(
        "No Puppeteer installation found. Please install puppeteer or puppeteer-core with @sparticuz/chromium-min"
      );
    }
  }
  /**
   * Main function to scrape jobs
   */
  async scrapeJobs() {
    let browser;
    let page;

    try {
      console.log("🚀 STARTING LINKEDIN JOB SCRAPER");
      console.log("=".repeat(70));
      console.log(`📝 Search Query: Software Engineer/Developer/Node.js roles`);
      console.log(`📍 Locations: ${this.locations.join(", ")}`);
      console.log(`⏰ Started at: ${new Date().toLocaleString()}`);
      console.log(
        `🌍 Environment: ${
          this.isProduction ? "Production (Vercel)" : "Development"
        }\n`
      );

      const startTime = Date.now();

      // Launch browser with Vercel compatibility
      browser = await this.launchBrowser();

      page = await browser.newPage();
      await this.setStealthMode(page);

      // Increase default timeout
      page.setDefaultNavigationTimeout(this.navigationTimeout);
      page.setDefaultTimeout(this.navigationTimeout);

      // Step 1: Login to LinkedIn
      console.log("🔐 Step 1: Logging into LinkedIn...");
      const loginSuccess = await this.linkedinLogin(page);

      if (!loginSuccess) {
        console.log("❌ Login failed. Exiting...");
        await browser.close();
        return { error: "Login failed", jobs: [], nodeJobs: [] };
      }

      console.log("✅ Login successful!\n");

      // Step 2: Navigate to Jobs section first
      console.log("📋 Step 2: Navigating to Jobs section...");
      await this.navigateToJobsSection(page);

      // Step 3: Search jobs for each location
      for (const location of this.locations) {
        console.log(`\n${"=".repeat(70)}`);
        console.log(`📍 SEARCHING JOBS IN: ${location.toUpperCase()}`);
        console.log(`${"=".repeat(70)}\n`);

        await this.searchJobsForLocation(page, location);

        // Delay between locations
        if (this.locations.indexOf(location) < this.locations.length - 1) {
          console.log(`\n⏳ Waiting before next location...`);
          await this.delay(this.delayBetweenLocations);
        }
      }

      // Step 4: Save results (only in development, or return in production)
      const endTime = Date.now();
      const totalTime = ((endTime - startTime) / 1000).toFixed(2);

      const results = {
        totalJobs: this.allJobs.length,
        nodeJobs: this.nodeJobs.length,
        locations: this.locations,
        searchQuery: this.searchQuery,
        scrapedAt: new Date().toISOString(),
        totalTime: totalTime,
        allJobs: this.allJobs,
        nodeJobs: this.nodeJobs,
      };

      // Save files only in development (file system available)
      if (!this.isProduction) {
        this.saveResults();
      }

      this.displaySummary(totalTime);

      // Step 5: Send Node.js jobs via email
      console.log("\n📧 Step 5: Sending Node.js jobs via email...");
      await this.sendNodeJsJobsEmail();

      await browser.close();

      return results;
    } catch (error) {
      console.error("💥 Error in job scraping:", error);
      if (browser) {
        await browser.close();
      }
      throw error;
    }
  }

  /**
   * Send Node.js jobs via email
   */
  async sendNodeJsJobsEmail() {
    try {
      if (this.nodeJobs.length === 0) {
        console.log("❌ No Node.js jobs found to send via email");
        return;
      }

      console.log(
        `📨 Preparing to send ${this.nodeJobs.length} Node.js jobs via email...`
      );

      const transporter = nodemailer.createTransport(this.emailConfig);

      const emailHtml = this.generateNodeJsJobsEmailHtml();
      const emailText = this.generateNodeJsJobsEmailText();

      const mailOptions = {
        from: this.emailConfig.auth.user,
        to: this.emailConfig.auth.user,
        subject: `Node.js Jobs Report - ${new Date().toLocaleDateString()} (${
          this.nodeJobs.length
        } jobs found)`,
        html: emailHtml,
        text: emailText,
        attachments: [
          {
            filename: `nodejs_jobs_${new Date().getTime()}.json`,
            content: JSON.stringify(this.nodeJobs, null, 2),
          },
          {
            filename: `nodejs_jobs_${new Date().getTime()}.csv`,
            content: this.generateNodeJsJobsCsv(),
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      console.log(
        `✅ Node.js jobs report sent successfully to ${this.emailConfig.auth.user}`
      );
    } catch (error) {
      console.error("❌ Error sending email:", error.message);
    }
  }

  /**
   * Generate HTML email content for Node.js jobs
   */
  generateNodeJsJobsEmailHtml() {
    const totalJobs = this.nodeJobs.length;
    const locations = this.locations.join(", ");
    const timestamp = new Date().toLocaleString();

    let jobsHtml = "";

    this.nodeJobs.forEach((job, index) => {
      jobsHtml += `
        <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; background: #f9f9f9;">
          <h3 style="margin: 0 0 10px 0; color: #0073b1;">${index + 1}. ${
        job.title || "N/A"
      }</h3>
          <p style="margin: 5px 0;"><strong>Company:</strong> ${
            job.company || "N/A"
          }</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${
            job.jobLocation || job.location || "N/A"
          }</p>
          <p style="margin: 5px 0;"><strong>Posted:</strong> ${
            job.postedTime || "N/A"
          }</p>
          <p style="margin: 5px 0;"><strong>Applicants:</strong> ${
            job.applicants || "N/A"
          }</p>
          <p style="margin: 5px 0;"><strong>Seniority:</strong> ${
            job.seniorityLevel || "N/A"
          }</p>
          <p style="margin: 5px 0;"><strong>Employment Type:</strong> ${
            job.employmentType || "N/A"
          }</p>
          <p style="margin: 10px 0;">
            <a href="${
              job.jobUrl || "#"
            }" style="color: #0073b1; text-decoration: none; font-weight: bold;">
              🔗 View Job on LinkedIn
            </a>
          </p>
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
          <h1>🚀 Node.js Jobs Report</h1>
          <p>Latest Node.js/Backend Developer Opportunities</p>
        </div>
        
        <div class="stats">
          <h2>📊 Summary</h2>
          <p><strong>Total Node.js Jobs Found:</strong> ${totalJobs}</p>
          <p><strong>Locations Searched:</strong> ${locations}</p>
          <p><strong>Report Generated:</strong> ${timestamp}</p>
          <p><strong>Search Query:</strong> ${this.searchQuery}</p>
        </div>

        <div>
          <h2>🎯 Job Opportunities (${totalJobs})</h2>
          ${jobsHtml}
        </div>

        <div style="margin-top: 30px; padding: 15px; background: #e7f3ff; border-radius: 5px;">
          <p><strong>💡 Note:</strong></p>
          <p>• This report contains ${totalJobs} Node.js/Backend developer jobs</p>
          <p>• Jobs are filtered for experience levels: Entry level, Associate, Mid-Senior</p>
          <p>• All jobs were posted in the last 24 hours</p>
          <p>• JSON and CSV attachments are included for further analysis</p>
        </div>

        <footer style="margin-top: 30px; padding: 15px; text-align: center; color: #666; border-top: 1px solid #ddd;">
          <p>Generated by LinkedIn Job Scraper • ${timestamp}</p>
        </footer>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text email content for Node.js jobs
   */
  generateNodeJsJobsEmailText() {
    let text = `NODE.JS JOBS REPORT\n`;
    text += `==================\n\n`;
    text += `Total Jobs Found: ${this.nodeJobs.length}\n`;
    text += `Locations: ${this.locations.join(", ")}\n`;
    text += `Generated: ${new Date().toLocaleString()}\n\n`;

    text += `JOB OPPORTUNITIES:\n`;
    text += `=================\n\n`;

    this.nodeJobs.forEach((job, index) => {
      text += `${index + 1}. ${job.title || "N/A"}\n`;
      text += `   Company: ${job.company || "N/A"}\n`;
      text += `   Location: ${job.jobLocation || job.location || "N/A"}\n`;
      text += `   Posted: ${job.postedTime || "N/A"}\n`;
      text += `   Applicants: ${job.applicants || "N/A"}\n`;
      text += `   Seniority: ${job.seniorityLevel || "N/A"}\n`;
      text += `   Employment Type: ${job.employmentType || "N/A"}\n`;
      text += `   Job URL: ${job.jobUrl || "N/A"}\n`;
      text += `   ---\n\n`;
    });

    return text;
  }

  /**
   * Generate CSV content for Node.js jobs
   */
  generateNodeJsJobsCsv() {
    const header =
      "Title,Company,Location,Job Location,Posted,Applicants,Seniority,Employment Type,Job URL\n";

    const rows = this.nodeJobs
      .map(
        (job) =>
          `"${(job.title || "").replace(/"/g, '""')}","${(
            job.company || ""
          ).replace(/"/g, '""')}","${job.location || ""}","${(
            job.jobLocation || ""
          ).replace(/"/g, '""')}","${job.postedTime || ""}","${
            job.applicants || ""
          }","${job.seniorityLevel || ""}","${job.employmentType || ""}","${
            job.jobUrl || ""
          }"`
      )
      .join("\n");

    return header + rows;
  }

  /**
   * Navigate to Jobs section
   */
  async navigateToJobsSection(page) {
    try {
      console.log("🔗 Going to LinkedIn Jobs page...");

      await page.goto(`${this.baseURL}/jobs/`, {
        waitUntil: "domcontentloaded",
        timeout: this.navigationTimeout,
      });

      await this.delay(5000);
      console.log("✅ Successfully navigated to Jobs section");
    } catch (error) {
      console.error("Error navigating to Jobs section:", error.message);
      // Try alternative approach
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

  /**
   * Search jobs for a specific location - IMPROVED VERSION
   */
  async searchJobsForLocation(page, location) {
    try {
      console.log(`🔍 Searching for jobs in ${location}...`);

      // Use the better search method from the second file
      const searchSuccess = await this.performSearch(page, location);

      if (!searchSuccess) {
        console.log(`❌ Failed to search for jobs in ${location}`);
        return;
      }

      await this.delay(5000);

      // Apply filters
      await this.applyFilters(page);

      // Get job list and scrape each job
      let scrapedCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 50;
      const processedJobIds = new Set();

      while (
        scrapedCount < this.maxJobsPerLocation &&
        scrollAttempts < maxScrollAttempts
      ) {
        scrollAttempts++;
        console.log(`\n🔄 Scroll attempt ${scrollAttempts} for ${location}...`);

        // Get all job cards on current page - IMPROVED METHOD
        const jobCards = await this.getJobCardsList(page);
        console.log(`📋 Found ${jobCards.length} job cards on page`);

        // Scrape each job card
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
              this.allJobs.push(jobData);
              scrapedCount++;

              // Check if it's a Node.js job
              if (this.isNodeJob(jobData)) {
                this.nodeJobs.push(jobData);
                console.log(
                  `✅ [${scrapedCount}] Node.js Job: ${jobData.title} at ${jobData.company}`
                );
              } else {
                console.log(
                  `📝 [${scrapedCount}] Job: ${jobData.title} at ${jobData.company}`
                );
              }
            }

            await this.delay(this.delayBetweenJobs);
          } catch (error) {
            console.error(`Error scraping job ${i}:`, error.message);
          }
        }

        // Scroll to load more jobs
        const hasMore = await this.scrollJobList(page);

        if (!hasMore) {
          console.log("🚫 No more jobs to load");
          break;
        }

        await this.delay(3000);
      }

      console.log(`\n✅ Completed ${location}: ${scrapedCount} jobs scraped`);
    } catch (error) {
      console.error(`Error searching jobs in ${location}:`, error.message);
    }
  }

  /**
   * Perform search using the search form - IMPROVED VERSION
   */
  async performSearch(page, location) {
    try {
      // Method 1: Use search inputs on the page (from working file)
      const searchSuccess = await page.evaluate(
        (query, loc) => {
          // Find keyword search box
          const keywordInputs = document.querySelectorAll(
            'input[aria-label*="Search by title"], input[placeholder*="Search by title"], input.jobs-search-box__text-input'
          );

          // Find location search box
          const locationInputs = document.querySelectorAll(
            'input[aria-label*="City"], input[placeholder*="City"], input.jobs-search-box__input--location'
          );

          if (keywordInputs.length > 0 && locationInputs.length > 0) {
            // Clear and type in keyword
            const keywordInput = keywordInputs[0];
            keywordInput.value = "";
            keywordInput.focus();

            // Create and dispatch input events
            const inputEvent = new Event("input", { bubbles: true });
            keywordInput.value = query;
            keywordInput.dispatchEvent(inputEvent);

            // Clear and type in location
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

        // Click search button
        await page.evaluate(() => {
          const searchButtons = document.querySelectorAll(
            'button.jobs-search-box__submit-button, button[aria-label*="Search"]'
          );
          if (searchButtons.length > 0) {
            searchButtons[0].click();
          }
        });

        await this.delay(8000); // Wait for results to load
        console.log("✅ Search performed successfully");
        return true;
      }

      // Method 2: If form method fails, try URL approach with better error handling
      console.log("⚠️ Form method failed, trying URL navigation...");
      const searchUrl = this.buildSearchUrl(location);

      try {
        await page.goto(searchUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        await this.delay(5000);
        console.log("✅ URL navigation successful");
        return true;
      } catch (navError) {
        console.error("URL navigation failed:", navError.message);

        // Method 3: Try simplified search
        console.log("⚠️ Trying simplified search...");
        const simpleUrl = `${
          this.baseURL
        }/jobs/search/?keywords=software+engineer&location=${encodeURIComponent(
          location
        )}`;

        await page.goto(simpleUrl, {
          waitUntil: "domcontentloaded",
          timeout: 60000,
        });

        await this.delay(5000);
        return true;
      }
    } catch (error) {
      console.error("Error performing search:", error.message);
      return false;
    }
  }

  /**
   * Build search URL with filters
   */
  buildSearchUrl(location) {
    const params = new URLSearchParams({
      keywords: this.searchQuery,
      location: location,
      f_E: this.experienceLevels.join(","),
      f_WT: this.workplaceTypes.join(","),
      f_TPR: this.datePosted,
      sortBy: "DD",
    });

    return `${this.baseURL}/jobs/search/?${params.toString()}`;
  }

  /**
   * Apply additional filters on the page - IMPROVED VERSION
   */
  async applyFilters(page) {
    try {
      console.log("🎯 Applying filters...");

      await this.delay(3000);

      // Click Experience level filter
      const expFilterApplied = await page.evaluate((levels) => {
        const expButtons = document.querySelectorAll(
          'button[aria-label*="Experience level"], button[aria-label*="Experience Level"]'
        );
        for (const button of expButtons) {
          button.click();
          return true;
        }
        return false;
      }, this.experienceLevels);

      if (expFilterApplied) {
        await this.delay(2000);

        // Select Entry level, Associate, Mid-Senior
        await page.evaluate(() => {
          const checkboxes = document.querySelectorAll(
            'input[type="checkbox"]'
          );
          for (const checkbox of checkboxes) {
            const label =
              checkbox.closest("label")?.textContent?.toLowerCase() || "";
            if (
              label.includes("entry") ||
              label.includes("associate") ||
              label.includes("mid-senior")
            ) {
              if (!checkbox.checked) {
                checkbox.click();
              }
            }
          }
        });

        await this.delay(2000);
        console.log("✅ Experience level filters applied");
      }

      // Apply Workplace Type filter
      const wpFilterApplied = await page.evaluate((types) => {
        const wpButtons = document.querySelectorAll(
          'button[aria-label*="Workplace type"], button[aria-label*="Workplace Type"]'
        );
        for (const button of wpButtons) {
          button.click();
          return true;
        }
        return false;
      });
      if (wpFilterApplied) {
        await this.delay(2000);
        // Select On-site, Remote, Hybrid
        await page.evaluate((types) => {
          const checkboxes = document.querySelectorAll(
            'input[type="checkbox"]'
          );
          for (const checkbox of checkboxes) {
            const label =
              checkbox.closest("label")?.textContent?.toLowerCase() || "";
            if (types.includes(label)) {
              checkbox.click();
            }
          }
        }, this.workplaceTypes);
        await this.delay(2000);
        console.log("✅ Workplace type filters applied");
      }

      // Apply Date Posted filter
      const dateFilterApplied = await page.evaluate(() => {
        const dateButtons = document.querySelectorAll(
          'button[aria-label*="Date posted"], button[aria-label*="Date Posted"]'
        );
        for (const button of dateButtons) {
          button.click();
          return true;
        }
        return false;
      });

      if (dateFilterApplied) {
        await this.delay(2000);

        // Select Past 24 hours
        await page.evaluate(() => {
          const options = document.querySelectorAll("label, li");
          for (const option of options) {
            const text = option.textContent?.toLowerCase() || "";
            if (text.includes("past 24 hours") || text.includes("past day")) {
              option.click();
              break;
            }
          }
        });

        await this.delay(2000);
        console.log("✅ Date posted filter applied");
      }

      // Apply Most Recent sort
      const sortApplied = await page.evaluate(() => {
        const sortButtons = document.querySelectorAll(
          'button[aria-label*="Sort by"], select'
        );
        for (const button of sortButtons) {
          const text = button.textContent?.toLowerCase() || "";
          if (text.includes("sort") || text.includes("most recent")) {
            button.click();
            return true;
          }
        }
        return false;
      });

      if (sortApplied) {
        await this.delay(2000);

        await page.evaluate(() => {
          const options = document.querySelectorAll("li, option");
          for (const option of options) {
            const text = option.textContent?.toLowerCase() || "";
            if (text.includes("most recent") || text.includes("date")) {
              option.click();
              break;
            }
          }
        });

        console.log("✅ Sort by Most Recent applied");
      }

      await this.delay(3000);
      console.log("✅ All filters applied");
    } catch (error) {
      console.error("Error applying filters:", error.message);
    }
  }

  /**
   * Get list of job cards - IMPROVED VERSION
   */
  async getJobCardsList(page) {
    return await page.evaluate(() => {
      const cards = document.querySelectorAll(
        ".jobs-search-results__list-item, .job-card-container, .scaffold-layout__list-item, [data-job-id]"
      );
      return Array.from(cards).map((card, index) => index);
    });
  }

  /**
   * Scrape individual job card - IMPROVED VERSION
   */

  /**
   * Check if job is Node.js related
   */
  isNodeJob(jobData) {
    if (!jobData) return false;

    const searchText = `${jobData.title || ""} ${jobData.description || ""} ${(
      jobData.skills || []
    ).join(" ")}`.toLowerCase();

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
   * Scroll job list to load more
   */
  /**
   * Search jobs for a specific location - IMPROVED for production
   */
  async searchJobsForLocation(page, location) {
    try {
      console.log(`🔍 Searching for jobs in ${location}...`);

      // Use URL navigation directly (more reliable in production)
      const searchUrl = this.buildSearchUrl(location);
      console.log(`🔗 Navigating to: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      console.log("⏳ Waiting for search results to load...");
      await this.delay(8000);

      // Check if we're on the right page and content loaded
      const pageStatus = await page.evaluate(() => {
        const bodyText = document.body.textContent.toLowerCase();
        return {
          hasJobs: bodyText.includes("job") || bodyText.includes("apply"),
          hasResults:
            bodyText.includes("results") || bodyText.includes("found"),
          hasNoResults:
            bodyText.includes("no jobs found") ||
            bodyText.includes("we couldn't find"),
          currentUrl: window.location.href,
          title: document.title,
        };
      });

      console.log("📊 Page status:", pageStatus);

      if (pageStatus.hasNoResults) {
        console.log("⚠️ No jobs found for this search");
        return;
      }

      // Apply filters with better waiting
      await this.applyFilters(page);

      // Additional wait after filters
      await this.delay(5000);

      // Get job list and scrape each job
      let scrapedCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 10; // Reduced for production
      const processedJobIds = new Set();

      while (
        scrapedCount < this.maxJobsPerLocation &&
        scrollAttempts < maxScrollAttempts
      ) {
        scrollAttempts++;
        console.log(`\n🔄 Scroll attempt ${scrollAttempts} for ${location}...`);

        // Get all job cards on current page with improved detection
        const jobCards = await this.getJobCardsList(page);
        console.log(`📋 Found ${jobCards.length} job cards on page`);

        // If no cards found, try alternative approach
        if (jobCards.length === 0 && scrollAttempts === 1) {
          console.log(
            "⚠️ No job cards found on first attempt. Trying alternative approach..."
          );

          // Try clicking on the first job-like element we can find
          const clicked = await page.evaluate(() => {
            const clickableElements = document.querySelectorAll(
              'a, button, [role="button"], .job-card-list__title'
            );

            for (const element of clickableElements) {
              const text = element.textContent || "";
              if (
                text.includes("Apply") ||
                text.includes("View") ||
                text.includes("job")
              ) {
                element.click();
                return true;
              }
            }
            return false;
          });

          if (clicked) {
            await this.delay(3000);
            // Try getting cards again
            const jobCardsRetry = await this.getJobCardsList(page);
            console.log(
              `📋 Found ${jobCardsRetry.length} job cards after click`
            );
          }
        }

        // Scrape each job card
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
              this.allJobs.push(jobData);
              scrapedCount++;

              // Check if it's a Node.js job
              if (this.isNodeJob(jobData)) {
                this.nodeJobs.push(jobData);
                console.log(
                  `✅ [${scrapedCount}] Node.js Job: ${jobData.title} at ${jobData.company}`
                );
              } else {
                console.log(
                  `📝 [${scrapedCount}] Job: ${jobData.title} at ${jobData.company}`
                );
              }
            }

            await this.delay(this.delayBetweenJobs);
          } catch (error) {
            console.error(`Error scraping job ${i}:`, error.message);
          }
        }

        // Scroll to load more jobs
        const hasMore = await this.scrollJobList(page);

        if (!hasMore || jobCards.length === 0) {
          console.log("🚫 No more jobs to load or no jobs found");
          break;
        }

        await this.delay(3000);
      }

      console.log(`\n✅ Completed ${location}: ${scrapedCount} jobs scraped`);
    } catch (error) {
      console.error(`Error searching jobs in ${location}:`, error.message);
    }
  }

  /**
   * Scroll job list to load more - IMPROVED
   */
  async scrollJobList(page) {
    try {
      return await page.evaluate(async () => {
        // Multiple selectors for job list container
        const jobListSelectors = [
          ".jobs-search-results-list",
          ".scaffold-layout__list",
          ".scaffold-layout__list-container",
          ".jobs-search-results",
          "[role='list']",
          ".scaffold-layout__main",
        ];

        let jobList = null;
        for (const selector of jobListSelectors) {
          jobList = document.querySelector(selector);
          if (jobList) break;
        }

        if (!jobList) {
          console.log("❌ No job list container found");
          return false;
        }

        const beforeHeight =
          jobList.scrollHeight || document.documentElement.scrollHeight;
        const beforeScroll = jobList.scrollTop || window.scrollY;

        // Scroll the page or container
        if (jobList.scrollHeight > jobList.clientHeight) {
          jobList.scrollTo(0, jobList.scrollHeight);
        } else {
          window.scrollTo(0, document.body.scrollHeight);
        }

        // Wait for new content
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const afterHeight =
          jobList.scrollHeight || document.documentElement.scrollHeight;
        const afterScroll = jobList.scrollTop || window.scrollY;

        const hasNewContent =
          afterHeight > beforeHeight || afterScroll > beforeScroll;

        if (!hasNewContent) {
          console.log("📏 No new content after scrolling");
        }

        return hasNewContent;
      });
    } catch (error) {
      console.error("Error scrolling job list:", error.message);
      return false;
    }
  }

  /**
   * LinkedIn login - IMPROVED VERSION
   */
  /**
   * LinkedIn login - IMPROVED VERSION for production
   */
  async linkedinLogin(page) {
    try {
      const credentials = this.getLinkedInCredentials();

      if (!credentials.email || !credentials.password) {
        console.log("⚠️  No LinkedIn credentials provided");
        console.log(
          "💡 Set LINKEDIN_EMAIL and LINKEDIN_PASSWORD environment variables"
        );
        return false;
      }

      console.log("🌐 Navigating to LinkedIn login page...");

      // Navigate to login page with better wait strategy
      await page.goto(`${this.baseURL}/login`, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      console.log("⏳ Waiting for page to fully load...");
      await this.delay(5000);

      // Check if already logged in
      const currentUrl = page.url();
      if (
        !currentUrl.includes("/login") &&
        !currentUrl.includes("/uas/login")
      ) {
        console.log("✅ Already logged in to LinkedIn");
        return true;
      }

      console.log("🔍 Looking for login form fields...");

      // Multiple strategies to find login fields
      const usernameSelectors = [
        "#username",
        "input[name='session_key']",
        "input[type='text'][autocomplete='username']",
        "input[autocomplete='username']",
        "input[id*='username']",
        "input[name*='username']",
        "input[type='email']",
      ];

      const passwordSelectors = [
        "#password",
        "input[name='session_password']",
        "input[type='password']",
        "input[autocomplete='current-password']",
      ];

      let usernameField = null;
      let passwordField = null;

      // Strategy 1: Try each selector individually
      for (const selector of usernameSelectors) {
        try {
          usernameField = await page.$(selector);
          if (usernameField) {
            console.log(`✅ Found username field with: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      for (const selector of passwordSelectors) {
        try {
          passwordField = await page.$(selector);
          if (passwordField) {
            console.log(`✅ Found password field with: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      // Strategy 2: If selectors didn't work, try finding by form context
      if (!usernameField || !passwordField) {
        console.log("⚠️ Standard selectors failed, trying form context...");

        const fields = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll("input"));
          let username = null;
          let password = null;

          for (const input of inputs) {
            const type = input.type.toLowerCase();
            const name = (input.name || "").toLowerCase();
            const id = (input.id || "").toLowerCase();
            const placeholder = (input.placeholder || "").toLowerCase();

            // Check for username/email field
            if (
              type === "text" ||
              type === "email" ||
              name.includes("session_key") ||
              name.includes("username") ||
              name.includes("email") ||
              id.includes("username") ||
              id.includes("email") ||
              placeholder.includes("email") ||
              placeholder.includes("phone")
            ) {
              username = input;
            }

            // Check for password field
            if (
              type === "password" ||
              name.includes("session_password") ||
              name.includes("password") ||
              id.includes("password") ||
              placeholder.includes("password")
            ) {
              password = input;
            }
          }

          return {
            username: username ? true : false,
            password: password ? true : false,
          };
        });

        if (fields.username && fields.password) {
          console.log("✅ Found fields using form context analysis");
          // Use page.evaluate to fill the form
          await page.evaluate(
            (email, password) => {
              const inputs = Array.from(document.querySelectorAll("input"));
              let usernameField = null;
              let passwordField = null;

              for (const input of inputs) {
                const type = input.type.toLowerCase();
                const name = (input.name || "").toLowerCase();

                if (
                  type === "text" ||
                  type === "email" ||
                  name.includes("session_key") ||
                  name.includes("username")
                ) {
                  usernameField = input;
                }

                if (type === "password" || name.includes("session_password")) {
                  passwordField = input;
                }
              }

              if (usernameField) {
                usernameField.value = email;
                usernameField.dispatchEvent(
                  new Event("input", { bubbles: true })
                );
                usernameField.dispatchEvent(
                  new Event("change", { bubbles: true })
                );
              }

              if (passwordField) {
                passwordField.value = password;
                passwordField.dispatchEvent(
                  new Event("input", { bubbles: true })
                );
                passwordField.dispatchEvent(
                  new Event("change", { bubbles: true })
                );
              }
            },
            credentials.email,
            credentials.password
          );

          await this.delay(1000);
        }
      } else {
        // Strategy 3: Use the found fields normally
        console.log("📝 Filling login form...");

        await usernameField.click({ clickCount: 3 });
        await usernameField.type(credentials.email, { delay: 100 });
        await this.delay(1000);

        await passwordField.click({ clickCount: 3 });
        await passwordField.type(credentials.password, { delay: 100 });
        await this.delay(1000);
      }

      // Find and click submit button with multiple strategies
      console.log("🔘 Looking for submit button...");

      let submitButton = null;
      const submitSelectors = [
        "button[type='submit']",
        "button.sign-in-form__submit-button",
        "input[type='submit']",
        "button[data-tracking-control-name='homepage-basic_signin-form_submit-button']",
      ];

      for (const selector of submitSelectors) {
        submitButton = await page.$(selector);
        if (submitButton) {
          console.log(`✅ Found submit button with: ${selector}`);
          break;
        }
      }

      // If no button found by selector, try to find by text
      if (!submitButton) {
        submitButton = await page
          .evaluateHandle(() => {
            const buttons = Array.from(document.querySelectorAll("button"));
            return buttons.find((btn) => {
              const text = (btn.textContent || "").toLowerCase();
              return (
                text.includes("sign in") ||
                text.includes("signin") ||
                btn.type === "submit"
              );
            });
          })
          .catch(() => null);
      }

      if (submitButton) {
        console.log("🔘 Clicking submit button...");
        await submitButton.click();

        // Wait for login to complete with multiple checks
        console.log("⏳ Waiting for login to complete...");
        await this.delay(8000);

        // Check if login was successful with multiple methods
        const isLoggedIn = await page.evaluate(() => {
          // Method 1: Check for navigation elements
          const hasNav = document.querySelector(
            '.global-nav, .feed-identity-module, [data-control-name="nav.settings"]'
          );

          // Method 2: Check URL
          const url = window.location.href;
          const isNotLoginPage =
            !url.includes("/login") && !url.includes("/uas/login");

          // Method 3: Check for feed content
          const hasFeed = document.querySelector(
            ".scaffold-layout, .feed-shared-update-v2"
          );

          return hasNav || isNotLoginPage || hasFeed;
        });

        if (isLoggedIn) {
          console.log("✅ Successfully logged into LinkedIn");
          await this.delay(3000);
          return true;
        } else {
          console.log(
            "⚠️ Login may have failed or requires additional verification"
          );

          // Check for security challenges
          const hasChallenge = await page.evaluate(() => {
            const bodyText = document.body.textContent.toLowerCase();
            return (
              bodyText.includes("captcha") ||
              bodyText.includes("verify") ||
              bodyText.includes("security check") ||
              bodyText.includes("challenge")
            );
          });

          if (hasChallenge) {
            console.log(
              "🔐 LinkedIn requires manual verification (CAPTCHA/2FA)"
            );
            console.log(
              "💡 You may need to manually complete the security check"
            );
          }

          // Take screenshot for debugging
          try {
            if (this.isProduction) {
              console.log("📸 Login page screenshot saved for debugging");
              // In production, we can't save files but we can log the page content
              const pageContent = await page.content();
              console.log(
                "📄 Page content snippet:",
                pageContent.substring(0, 500)
              );
            }
          } catch (e) {
            console.log("⚠️ Could not capture page content");
          }
        }
      } else {
        console.log("❌ Could not find submit button");
      }

      return false;
    } catch (error) {
      console.error("❌ Login failed:", error.message);

      // Additional debug info for production
      if (this.isProduction) {
        console.log("🔧 Production debug info:");
        console.log("- Current URL:", await page.url());
        console.log("- Page title:", await page.title());

        try {
          const pageText = await page.evaluate(() => document.body.textContent);
          console.log("- Page text snippet:", pageText.substring(0, 200));
        } catch (e) {
          console.log("- Could not extract page text");
        }
      }

      return false;
    }
  }

  /**
   * Set stealth mode
   */
  /**
   * Set stealth mode - IMPROVED
   */
  async setStealthMode(page) {
    await page.setViewport({ width: 1400, height: 1000 });

    // Randomize user agent
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ];

    const randomUserAgent =
      userAgents[Math.floor(Math.random() * userAgents.length)];
    await page.setUserAgent(randomUserAgent);

    await page.evaluateOnNewDocument(() => {
      // Override webdriver property
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Override plugins
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });

      // Override languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);

      // Mock Chrome runtime
      window.chrome = {
        runtime: {},
      };
    });

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
    });

    // Block images and stylesheets to speed up loading
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      if (["image", "stylesheet", "font"].includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  /**
   * Get LinkedIn credentials
   */
  getLinkedInCredentials() {
    // Priority: Environment variables > Config file
    if (process.env.LINKEDIN_EMAIL && process.env.LINKEDIN_PASSWORD) {
      return {
        email: process.env.LINKEDIN_EMAIL,
        password: process.env.LINKEDIN_PASSWORD,
      };
    }

    // Try to read from config file (only works in development)
    if (!this.isProduction) {
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
    }

    return { email: "", password: "" };
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Save results to files (only in development)
   */
  saveResults() {
    if (this.isProduction) {
      console.log("⚠️ File saving skipped in production (Vercel)");
      return;
    }

    const timestamp = new Date().getTime();

    // Save all jobs
    const allJobsFilename = `all_jobs_${timestamp}.json`;
    fs.writeFileSync(
      allJobsFilename,
      JSON.stringify(
        {
          totalJobs: this.allJobs.length,
          locations: this.locations,
          searchQuery: this.searchQuery,
          scrapedAt: new Date().toISOString(),
          jobs: this.allJobs,
        },
        null,
        2
      )
    );
    console.log(`\n✅ All jobs saved to: ${allJobsFilename}`);

    // Save Node.js jobs
    const nodeJobsFilename = `nodejs_jobs_${timestamp}.json`;
    fs.writeFileSync(
      nodeJobsFilename,
      JSON.stringify(
        {
          totalNodeJobs: this.nodeJobs.length,
          locations: this.locations,
          scrapedAt: new Date().toISOString(),
          jobs: this.nodeJobs,
        },
        null,
        2
      )
    );
    console.log(`✅ Node.js jobs saved to: ${nodeJobsFilename}`);

    // Save summary CSV for all jobs
    if (this.allJobs.length > 0) {
      const allCsvFilename = `all_jobs_${timestamp}.csv`;
      const csvHeader =
        "Title,Company,Location,Job Location,Posted,Applicants,Seniority,Employment Type,Job URL\n";
      const csvRows = this.allJobs
        .map(
          (job) =>
            `"${(job.title || "").replace(/"/g, '""')}","${(
              job.company || ""
            ).replace(/"/g, '""')}","${job.location || ""}","${(
              job.jobLocation || ""
            ).replace(/"/g, '""')}","${job.postedTime || ""}","${
              job.applicants || ""
            }","${job.seniorityLevel || ""}","${job.employmentType || ""}","${
              job.jobUrl || ""
            }"`
        )
        .join("\n");

      fs.writeFileSync(allCsvFilename, csvHeader + csvRows);
      console.log(`✅ All jobs CSV saved to: ${allCsvFilename}`);
    }

    // Save CSV for Node.js jobs
    if (this.nodeJobs.length > 0) {
      const nodeCsvFilename = `nodejs_jobs_${timestamp}.csv`;
      const csvHeader =
        "Title,Company,Location,Job Location,Posted,Applicants,Seniority,Employment Type,Job URL\n";
      const csvRows = this.nodeJobs
        .map(
          (job) =>
            `"${(job.title || "").replace(/"/g, '""')}","${(
              job.company || ""
            ).replace(/"/g, '""')}","${job.location || ""}","${(
              job.jobLocation || ""
            ).replace(/"/g, '""')}","${job.postedTime || ""}","${
              job.applicants || ""
            }","${job.seniorityLevel || ""}","${job.employmentType || ""}","${
              job.jobUrl || ""
            }"`
        )
        .join("\n");

      fs.writeFileSync(nodeCsvFilename, csvHeader + csvRows);
      console.log(`✅ Node.js jobs CSV saved to: ${nodeCsvFilename}`);
    }
  }

  /**
   * Display final summary
   */
  displaySummary(totalTime) {
    console.log("\n" + "=".repeat(70));
    console.log("🎉 JOB SCRAPING COMPLETE - SUMMARY");
    console.log("=".repeat(70));
    console.log(`⏱️  Total Time: ${totalTime} seconds`);
    console.log(`📍 Locations Searched: ${this.locations.join(", ")}`);
    console.log(`📋 Total Jobs Scraped: ${this.allJobs.length}`);
    console.log(`🟢 Node.js Jobs Found: ${this.nodeJobs.length}`);

    if (this.allJobs.length > 0) {
      console.log(
        `📊 Node.js Jobs Percentage: ${(
          (this.nodeJobs.length / this.allJobs.length) *
          100
        ).toFixed(1)}%`
      );
    }

    console.log("=".repeat(70) + "\n");
  }
}

// Export the class for use in other files (e.g., Next.js API routes)
module.exports = LinkedInJobScraper;

// If run directly, execute the scraper
if (require.main === module) {
  (async () => {
    const scraper = new LinkedInJobScraper();
    try {
      const results = await scraper.scrapeJobs();
      console.log("✅ Scraping completed successfully");
      if (results && !results.error) {
        console.log(
          `📊 Results: ${results.totalJobs} total jobs, ${results.nodeJobs} Node.js jobs`
        );
      }
    } catch (error) {
      console.error("❌ Scraping failed:", error);
      process.exit(1);
    }
  })();
}
