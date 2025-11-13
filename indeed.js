const puppeteer = require("puppeteer");
const fs = require("fs");
const nodemailer = require("nodemailer");
const path = require("path");

class IndeedJobScraper {
  constructor() {
    this.baseURL = "https://www.indeed.com";
    this.delayBetweenJobs = 2000;
    this.delayBetweenLocations = 5000;
    this.maxJobsPerLocation = 500;
    this.navigationTimeout = 90000;

    // Search parameters
    this.searchQuery = "node.js OR nodejs OR node js OR express.js OR backend developer OR software engineer";
    this.locations = ["Bangalore, Karnataka", "Pune, Maharashtra", "Mumbai, Maharashtra", "Gurugram, Haryana", "Ahmedabad, Gujarat"];
    this.datePosted = "7"; // Last 7 days (Indeed uses: 1 = 24h, 7 = 7 days, 30 = 30 days)

    this.allJobs = [];
    this.nodeJobs = [];

    // Email configuration
    this.emailConfig = {
      service: "gmail",
      auth: {
        user: "jaylimbasiya93@gmail.com",
        pass: "mjsg ikgq yokl bmew",
      },
    };
  }

  /**
   * Main function to scrape jobs
   */
  async scrapeJobs() {
    let browser;
    let page;

    try {
      console.log("🚀 STARTING INDEED JOB SCRAPER");
      console.log("=".repeat(70));
      console.log(`📝 Search Query: Node.js/Backend Developer roles`);
      console.log(`📍 Locations: ${this.locations.join(", ")}`);
      console.log(`⏰ Started at: ${new Date().toLocaleString()}\n`);

      const startTime = Date.now();

      // Launch browser
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

      // Increase default timeout
      page.setDefaultNavigationTimeout(this.navigationTimeout);
      page.setDefaultTimeout(this.navigationTimeout);

      // Step 1: Navigate to Indeed
      console.log("🔗 Step 1: Navigating to Indeed...");
      await page.goto(this.baseURL, {
        waitUntil: "domcontentloaded",
        timeout: this.navigationTimeout,
      });
      await this.delay(3000);
      console.log("✅ Successfully navigated to Indeed\n");

      // Step 2: Search jobs for each location
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

      // Step 3: Save results
      const endTime = Date.now();
      const totalTime = ((endTime - startTime) / 1000).toFixed(2);

      this.saveResults();
      this.displaySummary(totalTime);

      // Step 4: Send Node.js jobs via email
      console.log("\n📧 Step 4: Sending Node.js jobs via email...");
      await this.sendNodeJsJobsEmail();

      await browser.close();
    } catch (error) {
      console.error("💥 Error in job scraping:", error);
      if (browser) {
        await browser.close();
      }
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
        to: "jaylimbasiya93@gmail.com",
        subject: `Indeed Node.js Jobs Report - ${new Date().toLocaleDateString()} (${
          this.nodeJobs.length
        } jobs found)`,
        html: emailHtml,
        text: emailText,
        attachments: [
          {
            filename: `indeed_nodejs_jobs_${new Date().getTime()}.json`,
            content: JSON.stringify(this.nodeJobs, null, 2),
          },
          {
            filename: `indeed_nodejs_jobs_${new Date().getTime()}.csv`,
            content: this.generateNodeJsJobsCsv(),
          },
        ],
      };

      await transporter.sendMail(mailOptions);
      console.log(
        "✅ Node.js jobs report sent successfully to jaylimbasiya93@gmail.com"
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
          <h3 style="margin: 0 0 10px 0; color: #2164f3;">${index + 1}. ${
        job.title || "N/A"
      }</h3>
          <p style="margin: 5px 0;"><strong>Company:</strong> ${
            job.company || "N/A"
          }</p>
          <p style="margin: 5px 0;"><strong>Location:</strong> ${
            job.location || "N/A"
          }</p>
          <p style="margin: 5px 0;"><strong>Salary:</strong> ${
            job.salary || "N/A"
          }</p>
          <p style="margin: 5px 0;"><strong>Posted:</strong> ${
            job.postedTime || "N/A"
          }</p>
          <p style="margin: 5px 0;"><strong>Job Type:</strong> ${
            job.jobType || "N/A"
          }</p>
          <p style="margin: 10px 0;">
            <a href="${
              job.jobUrl || "#"
            }" style="color: #2164f3; text-decoration: none; font-weight: bold;">
              🔗 View Job on Indeed
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
          .header { background: #2164f3; color: white; padding: 20px; border-radius: 5px; }
          .stats { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🚀 Indeed Node.js Jobs Report</h1>
          <p>Latest Node.js/Backend Developer Opportunities from Indeed</p>
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
          <p>• This report contains ${totalJobs} Node.js/Backend developer jobs from Indeed</p>
          <p>• All jobs were posted in the last 7 days</p>
          <p>• JSON and CSV attachments are included for further analysis</p>
        </div>

        <footer style="margin-top: 30px; padding: 15px; text-align: center; color: #666; border-top: 1px solid #ddd;">
          <p>Generated by Indeed Job Scraper • ${timestamp}</p>
        </footer>
      </body>
      </html>
    `;
  }

  /**
   * Generate plain text email content for Node.js jobs
   */
  generateNodeJsJobsEmailText() {
    let text = `INDEED NODE.JS JOBS REPORT\n`;
    text += `========================\n\n`;
    text += `Total Jobs Found: ${this.nodeJobs.length}\n`;
    text += `Locations: ${this.locations.join(", ")}\n`;
    text += `Generated: ${new Date().toLocaleString()}\n\n`;

    text += `JOB OPPORTUNITIES:\n`;
    text += `=================\n\n`;

    this.nodeJobs.forEach((job, index) => {
      text += `${index + 1}. ${job.title || "N/A"}\n`;
      text += `   Company: ${job.company || "N/A"}\n`;
      text += `   Location: ${job.location || "N/A"}\n`;
      text += `   Salary: ${job.salary || "N/A"}\n`;
      text += `   Posted: ${job.postedTime || "N/A"}\n`;
      text += `   Job Type: ${job.jobType || "N/A"}\n`;
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
      "Title,Company,Location,Salary,Posted,Job Type,Job URL\n";

    const rows = this.nodeJobs
      .map(
        (job) =>
          `"${(job.title || "").replace(/"/g, '""')}","${(
            job.company || ""
          ).replace(/"/g, '""')}","${(job.location || "").replace(
            /"/g,
            '""'
          )}","${(job.salary || "").replace(/"/g, '""')}","${job.postedTime || ""}","${job.jobType || ""}","${
            job.jobUrl || ""
          }"`
      )
      .join("\n");

    return header + rows;
  }

  /**
   * Search jobs for a specific location
   */
  async searchJobsForLocation(page, location) {
    try {
      console.log(`🔍 Searching for jobs in ${location}...`);

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
      let pageNumber = 0;
      const maxPages = 50;
      const processedJobIds = new Set();

      while (
        scrapedCount < this.maxJobsPerLocation &&
        pageNumber < maxPages
      ) {
        pageNumber++;
        console.log(`\n📄 Page ${pageNumber} for ${location}...`);

        // Get all job cards on current page
        const jobCards = await this.getJobCardsList(page);
        console.log(`📋 Found ${jobCards.length} job cards on page`);

        if (jobCards.length === 0) {
          console.log("🚫 No more jobs found");
          break;
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

            if (jobData && jobData.jobId && !processedJobIds.has(jobData.jobId)) {
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

        // Try to go to next page
        const hasNextPage = await this.goToNextPage(page);
        if (!hasNextPage) {
          console.log("🚫 No more pages to load");
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
   * Perform search on Indeed
   */
  async performSearch(page, location) {
    try {
      // Navigate to Indeed search page
      const searchUrl = this.buildSearchUrl(location);
      console.log(`🔗 Navigating to: ${searchUrl}`);

      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: this.navigationTimeout,
      });

      await this.delay(5000);

      // Check if we're on search results page
      const isOnSearchPage = await page.evaluate(() => {
        return (
          document.querySelector("#mosaic-provider-jobcards") !== null ||
          document.querySelector(".job_seen_beacon") !== null ||
          document.querySelector('[data-testid="slider_item"]') !== null
        );
      });

      if (isOnSearchPage) {
        console.log("✅ Successfully navigated to search results");
        return true;
      }

      // Alternative: Use search form if URL navigation doesn't work
      console.log("⚠️ URL navigation might have failed, trying search form...");
      await page.goto(this.baseURL, {
        waitUntil: "domcontentloaded",
        timeout: this.navigationTimeout,
      });

      await this.delay(3000);

      const searchSuccess = await page.evaluate((query, loc) => {
        // Find search input (what)
        const whatInput = document.querySelector('#text-input-what, input[name="q"], input[id*="text-input-what"]');
        // Find location input (where)
        const whereInput = document.querySelector('#text-input-where, input[name="l"], input[id*="text-input-where"]');

        if (whatInput && whereInput) {
          whatInput.value = query;
          whatInput.dispatchEvent(new Event("input", { bubbles: true }));
          whatInput.dispatchEvent(new Event("change", { bubbles: true }));

          whereInput.value = loc;
          whereInput.dispatchEvent(new Event("input", { bubbles: true }));
          whereInput.dispatchEvent(new Event("change", { bubbles: true }));

          // Find and click search button
          const searchButton = document.querySelector('button[type="submit"], button[id*="whatWhere-button"]');
          if (searchButton) {
            searchButton.click();
            return true;
          }
        }
        return false;
      }, this.searchQuery, location);

      if (searchSuccess) {
        await this.delay(5000);
        console.log("✅ Search form submitted successfully");
        return true;
      }

      return false;
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
      q: this.searchQuery,
      l: location,
      fromage: this.datePosted, // Days ago (7 = last 7 days)
      sort: "date", // Sort by date (most recent first)
    });

    return `${this.baseURL}/jobs?${params.toString()}`;
  }

  /**
   * Apply additional filters on the page
   */
  async applyFilters(page) {
    try {
      console.log("🎯 Applying filters...");

      await this.delay(3000);

      // Apply date filter (Last 7 days)
      try {
        const dateFilterApplied = await page.evaluate(() => {
          // Look for date posted filter
          const dateButtons = document.querySelectorAll(
            'button[data-testid="filter-dateposted"], button[id*="filter-dateposted"], a[data-testid="filter-dateposted"]'
          );
          
          if (dateButtons.length > 0) {
            dateButtons[0].click();
            return true;
          }
          
          // Alternative: Look for filter menu
          const filterMenus = document.querySelectorAll(
            'button[aria-label*="Date posted"], button[id*="filter-date"]'
          );
          for (const button of filterMenus) {
            button.click();
            return true;
          }
          
          return false;
        });

        if (dateFilterApplied) {
          await this.delay(2000);

          // Select "Last 7 days"
          await page.evaluate(() => {
            const options = document.querySelectorAll(
              'a[data-testid*="7days"], a[id*="7days"], li[data-testid*="7days"]'
            );
            if (options.length > 0) {
              options[0].click();
            } else {
              // Try clicking on text containing "7 days"
              const allOptions = document.querySelectorAll("a, li, button");
              for (const option of allOptions) {
                const text = option.textContent?.toLowerCase() || "";
                if (text.includes("7 days") || text.includes("past week")) {
                  option.click();
                  break;
                }
              }
            }
          });

          await this.delay(3000);
          console.log("✅ Date filter applied (Last 7 days)");
        }
      } catch (error) {
        console.log("⚠️ Could not apply date filter:", error.message);
      }

      // Apply sort by date (most recent)
      try {
        await page.evaluate(() => {
          const sortSelect = document.querySelector(
            'select[id*="sort"], select[name*="sort"]'
          );
          if (sortSelect) {
            sortSelect.value = "date";
            sortSelect.dispatchEvent(new Event("change", { bubbles: true }));
          }
        });

        await this.delay(2000);
        console.log("✅ Sort by date applied");
      } catch (error) {
        console.log("⚠️ Could not apply sort filter:", error.message);
      }

      await this.delay(3000);
      console.log("✅ Filters applied");
    } catch (error) {
      console.error("Error applying filters:", error.message);
    }
  }

  /**
   * Get list of job cards
   */
  async getJobCardsList(page) {
    return await page.evaluate(() => {
      // Try multiple selectors for job cards
      const selectors = [
        'div[data-jk]',
        'a[data-jk]',
        'div[class*="job_seen_beacon"]',
        'div[class*="slider_item"]',
        '[data-testid="slider_item"]',
        'div[class*="jobCard"]',
        'td[class*="resultContent"]',
      ];

      for (const selector of selectors) {
        const cards = document.querySelectorAll(selector);
        if (cards.length > 0) {
          return Array.from(cards).map((card, index) => index);
        }
      }

      return [];
    });
  }

  /**
   * Scrape individual job card
   */
  async scrapeJobCard(page, index, location, processedJobIds) {
    try {
      // Get job data from the card without clicking (Indeed shows details in card)
      const jobData = await page.evaluate((idx, loc) => {
        const data = {
          location: loc,
          scrapedAt: new Date().toISOString(),
        };

        // Try multiple selectors for job cards
        const selectors = [
          'div[data-jk]',
          'a[data-jk]',
          'div[class*="job_seen_beacon"]',
          'div[class*="slider_item"]',
          '[data-testid="slider_item"]',
        ];

        let card = null;
        for (const selector of selectors) {
          const cards = document.querySelectorAll(selector);
          if (cards[idx]) {
            card = cards[idx];
            break;
          }
        }

        if (!card) {
          return null;
        }

        // Scroll card into view
        card.scrollIntoView({ behavior: "smooth", block: "center" });

        // Extract Job ID
        const jobId = card.getAttribute("data-jk") || 
                     card.querySelector('[data-jk]')?.getAttribute("data-jk") ||
                     card.closest('[data-jk]')?.getAttribute("data-jk");
        
        if (jobId) {
          data.jobId = jobId;
          data.jobUrl = `https://www.indeed.com/viewjob?jk=${jobId}`;
        }

        // Extract Job Title
        const titleSelectors = [
          'h2[class*="jobTitle"]',
          'h2 a[class*="jobTitle"]',
          'a[class*="jobTitle"]',
          'span[title]',
          'h2',
        ];

        for (const selector of titleSelectors) {
          const element = card.querySelector(selector);
          if (element) {
            const title = element.getAttribute("title") || element.textContent?.trim();
            if (title && title.length > 0) {
              data.title = title;
              break;
            }
          }
        }

        // Extract Company Name
        const companySelectors = [
          'span[class*="companyName"]',
          'a[class*="companyName"]',
          'div[class*="companyName"]',
          'span[data-testid="company-name"]',
        ];

        for (const selector of companySelectors) {
          const element = card.querySelector(selector);
          if (element && element.textContent?.trim()) {
            data.company = element.textContent.trim();
            break;
          }
        }

        // Extract Location
        const locationSelectors = [
          'div[class*="companyLocation"]',
          'div[data-testid="text-location"]',
          'div[class*="location"]',
        ];

        for (const selector of locationSelectors) {
          const element = card.querySelector(selector);
          if (element && element.textContent?.trim()) {
            data.location = element.textContent.trim();
            break;
          }
        }

        // Extract Salary
        const salarySelectors = [
          'span[class*="salary"]',
          'div[class*="salary"]',
          'div[data-testid="attribute_snippet_testid"]',
        ];

        for (const selector of salarySelectors) {
          const element = card.querySelector(selector);
          if (element) {
            const salaryText = element.textContent?.trim();
            if (salaryText && (salaryText.includes("$") || salaryText.includes("₹") || salaryText.includes("salary"))) {
              data.salary = salaryText;
              break;
            }
          }
        }

        // Extract Posted Time
        const postedSelectors = [
          'span[class*="date"]',
          'span[class*="posted"]',
          'div[class*="date"]',
        ];

        for (const selector of postedSelectors) {
          const element = card.querySelector(selector);
          if (element) {
            const postedText = element.textContent?.trim();
            if (postedText && (postedText.includes("day") || postedText.includes("hour") || postedText.includes("just posted"))) {
              data.postedTime = postedText;
              break;
            }
          }
        }

        // Extract Job Type (Full-time, Part-time, etc.)
        const jobTypeElements = card.querySelectorAll('div[class*="attribute"], span[class*="attribute"]');
        for (const element of jobTypeElements) {
          const text = element.textContent?.toLowerCase() || "";
          if (text.includes("full-time") || text.includes("part-time") || text.includes("contract") || text.includes("temporary")) {
            data.jobType = element.textContent.trim();
            break;
          }
        }

        // Extract Job Description snippet
        const descriptionSelectors = [
          'div[class*="summary"]',
          'div[class*="snippet"]',
          'div[class*="job-snippet"]',
        ];

        for (const selector of descriptionSelectors) {
          const element = card.querySelector(selector);
          if (element && element.textContent?.trim()) {
            data.description = element.textContent.trim().substring(0, 1000);
            break;
          }
        }

        return data;
      }, index, location);

      // Validate and return job data
      if (jobData && jobData.title && jobData.company && jobData.jobId) {
        if (!processedJobIds.has(jobData.jobId)) {
          // Try to get more details by clicking on the job
          await this.delay(1000);
          
          try {
            const moreDetails = await page.evaluate((idx) => {
              const selectors = [
                'div[data-jk]',
                'a[data-jk]',
                'div[class*="job_seen_beacon"]',
                '[data-testid="slider_item"]',
              ];

              let card = null;
              for (const selector of selectors) {
                const cards = document.querySelectorAll(selector);
                if (cards[idx]) {
                  card = cards[idx];
                  break;
                }
              }

              if (!card) return null;

              const link = card.querySelector('a[href*="/viewjob"]') || 
                          card.querySelector('a[data-jk]') ||
                          card.closest('a[href*="/viewjob"]');

              if (link) {
                link.click();
                return true;
              }
              return false;
            }, index);

            if (moreDetails) {
              await this.delay(3000);

              // Extract additional details from job detail page
              const additionalDetails = await page.evaluate(() => {
                const details = {};

                // Get full job description
                const descriptionSelectors = [
                  'div[id="jobDescriptionText"]',
                  'div[class*="jobsearch-JobComponent-description"]',
                  'div[class*="jobDescriptionText"]',
                ];

                for (const selector of descriptionSelectors) {
                  const element = document.querySelector(selector);
                  if (element && element.textContent?.trim()) {
                    details.description = element.textContent.trim().substring(0, 3000);
                    break;
                  }
                }

                return details;
              });

              if (additionalDetails.description) {
                jobData.description = additionalDetails.description;
              }

              // Go back to results page
              await page.goBack();
              await this.delay(2000);
            }
          } catch (error) {
            // If we can't get more details, continue with what we have
            console.log(`  ⚠️ Could not get additional details for job ${index}`);
          }

          return jobData;
        }
      }

      return null;
    } catch (error) {
      console.error(`Error scraping job at index ${index}:`, error.message);
      return null;
    }
  }

  /**
   * Check if job is Node.js related
   */
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
      "nodejs developer",
      "node.js developer",
      "express developer",
    ];

    return nodeKeywords.some((keyword) => searchText.includes(keyword));
  }

  /**
   * Go to next page of results
   */
  async goToNextPage(page) {
    try {
      const hasNext = await page.evaluate(() => {
        // Look for "Next" button
        const nextButtons = document.querySelectorAll(
          'a[aria-label="Next Page"], a[aria-label="Next"], a[data-testid="pagination-page-next"]'
        );

        if (nextButtons.length > 0 && !nextButtons[0].classList.contains("disabled")) {
          nextButtons[0].click();
          return true;
        }

        // Alternative: Look for pagination links
        const paginationLinks = document.querySelectorAll(
          'a[data-testid*="pagination"], a[class*="pagination"]'
        );
        
        for (const link of paginationLinks) {
          const text = link.textContent?.toLowerCase() || "";
          const ariaLabel = link.getAttribute("aria-label")?.toLowerCase() || "";
          
          if (
            (text.includes("next") || ariaLabel.includes("next")) &&
            !link.classList.contains("disabled")
          ) {
            link.click();
            return true;
          }
        }

        // Try to find and click the next page number
        const currentPage = document.querySelector('b[class*="pagination"]') || 
                           document.querySelector('span[class*="pagination"]');
        
        if (currentPage) {
          const currentPageNum = parseInt(currentPage.textContent) || 1;
          const nextPageLink = document.querySelector(`a[aria-label="${currentPageNum + 1}"]`);
          
          if (nextPageLink) {
            nextPageLink.click();
            return true;
          }
        }

        return false;
      });

      return hasNext;
    } catch (error) {
      console.error("Error going to next page:", error.message);
      return false;
    }
  }

  /**
   * Set stealth mode
   */
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

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission })
          : originalQuery(parameters);
    });

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
    });
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Save results to files
   */
  saveResults() {
    const timestamp = new Date().getTime();

    // Save all jobs
    const allJobsFilename = `indeed_all_jobs_${timestamp}.json`;
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
    const nodeJobsFilename = `indeed_nodejs_jobs_${timestamp}.json`;
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
      const allCsvFilename = `indeed_all_jobs_${timestamp}.csv`;
      const csvHeader =
        "Title,Company,Location,Salary,Posted,Job Type,Job URL\n";
      const csvRows = this.allJobs
        .map(
          (job) =>
            `"${(job.title || "").replace(/"/g, '""')}","${(
              job.company || ""
            ).replace(/"/g, '""')}","${(job.location || "").replace(
              /"/g,
              '""'
            )}","${(job.salary || "").replace(/"/g, '""')}","${job.postedTime || ""}","${job.jobType || ""}","${
              job.jobUrl || ""
            }"`
        )
        .join("\n");

      fs.writeFileSync(allCsvFilename, csvHeader + csvRows);
      console.log(`✅ All jobs CSV saved to: ${allCsvFilename}`);
    }

    // Save CSV for Node.js jobs
    if (this.nodeJobs.length > 0) {
      const nodeCsvFilename = `indeed_nodejs_jobs_${timestamp}.csv`;
      const csvHeader =
        "Title,Company,Location,Salary,Posted,Job Type,Job URL\n";
      const csvRows = this.nodeJobs
        .map(
          (job) =>
            `"${(job.title || "").replace(/"/g, '""')}","${(
              job.company || ""
            ).replace(/"/g, '""')}","${(job.location || "").replace(
              /"/g,
              '""'
            )}","${(job.salary || "").replace(/"/g, '""')}","${job.postedTime || ""}","${job.jobType || ""}","${
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

// Run the scraper
(async () => {
  const scraper = new IndeedJobScraper();
  await scraper.scrapeJobs();
})();
