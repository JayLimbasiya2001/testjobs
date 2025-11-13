const puppeteer = require("puppeteer");
const fs = require("fs");
const nodemailer = require("nodemailer");
const path = require("path");

class LinkedInJobScraper {
  constructor() {
    this.baseURL = "https://www.linkedin.com";
    this.delayBetweenJobs = 2000;
    this.delayBetweenLocations = 5000;
    this.maxJobsPerLocation = 500;
    this.navigationTimeout = 90000; // Increased timeout

    // Search parameters
    this.searchQuery =
      '"software engineer" OR "software developer" OR "backend engineer" OR "backend developer" OR "application developer" OR "application engineer" OR "node" OR "full stack"';
    this.locations = ["Bangalore", "Pune", "Mumbai", "Gurugram", "Ahmedabad"];
    // this.locations = ["United States"];
    this.experienceLevels = ["2", "3"]; // Entry level, Associate, Mid-Senior
    this.datePosted = "r86400"; // Past 1 day
    this.workplaceTypes = ["1"]; // 1=On-site, 2=Remote, 3=Hybrid

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
      console.log("🚀 STARTING LINKEDIN JOB SCRAPER");
      console.log("=".repeat(70));
      console.log(`📝 Search Query: Software Engineer/Developer/Node.js roles`);
      console.log(`📍 Locations: ${this.locations.join(", ")}`);
      console.log(`⏰ Started at: ${new Date().toLocaleString()}\n`);

      const startTime = Date.now();

      // Launch browser
      browser = await puppeteer.launch({
        headless: true,
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

      // Step 1: Login to LinkedIn
      console.log("🔐 Step 1: Logging into LinkedIn...");
      const loginSuccess = await this.linkedinLogin(page);

      if (!loginSuccess) {
        console.log("❌ Login failed. Exiting...");
        return;
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

      // Step 4: Save results
      const endTime = Date.now();
      const totalTime = ((endTime - startTime) / 1000).toFixed(2);

      this.saveResults();
      this.displaySummary(totalTime);

      // Step 5: Send Node.js jobs via email
      console.log("\n📧 Step 5: Sending Node.js jobs via email...");
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
   * Search jobs for a specific location
   */
  async searchJobsForLocation(page, location) {
    try {
      // Use the search form on the page instead of URL navigation
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
      let scrollAttempts = 0;
      const maxScrollAttempts = 50;
      const processedJobIds = new Set();

      while (
        scrapedCount < this.maxJobsPerLocation &&
        scrollAttempts < maxScrollAttempts
      ) {
        scrollAttempts++;
        console.log(`\n🔄 Scroll attempt ${scrollAttempts} for ${location}...`);

        // Get all job cards on current page
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
   * Perform search using the search form
   */
  async performSearch(page, location) {
    try {
      // Method 1: Use search inputs on the page
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
   * Apply additional filters on the page
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
   * Get list of job cards
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
   * Scrape individual job card
   */
  async scrapeJobCard(page, index, location, processedJobIds) {
    try {
      // Click on the job card to load details
      const clicked = await page.evaluate((idx) => {
        const cards = document.querySelectorAll(
          ".jobs-search-results__list-item, .job-card-container, .scaffold-layout__list-item, [data-job-id]"
        );

        if (cards[idx]) {
          cards[idx].scrollIntoView({ behavior: "smooth", block: "center" });

          // Try clicking different elements within the card
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

      await this.delay(4000); // Wait for job details to load

      // Extract job details
      const jobData = await page.evaluate((loc) => {
        const data = {
          location: loc,
          scrapedAt: new Date().toISOString(),
        };

        // Job Title
        const titleSelectors = [
          ".job-details-jobs-unified-top-card__job-title",
          ".jobs-unified-top-card__job-title",
          "h1.t-24",
          ".jobs-details-top-card__job-title",
          "h2.t-20",
        ];
        for (const selector of titleSelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.title = element.textContent.trim();
            break;
          }
        }

        // Company Name
        const companySelectors = [
          ".job-details-jobs-unified-top-card__company-name",
          ".jobs-unified-top-card__company-name",
          ".jobs-details-top-card__company-url",
          "a.ember-view.t-black",
          ".job-details-jobs-unified-top-card__primary-description a",
        ];
        for (const selector of companySelectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent.trim()) {
            data.company = element.textContent.trim();
            break;
          }
        }

        // Job Location
        const locationSelectors = [
          ".job-details-jobs-unified-top-card__bullet",
          ".jobs-unified-top-card__bullet",
          ".jobs-details-top-card__bullet",
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

        // Workplace Type
        const workplaceElement = document.querySelector(
          ".jobs-unified-top-card__workplace-type"
        );
        if (workplaceElement) {
          data.workplaceType = workplaceElement.textContent.trim();
        }

        // Posted Time
        const postedSelectors = [
          ".jobs-unified-top-card__posted-date",
          ".job-details-jobs-unified-top-card__posted-date",
          'span[class*="posted"]',
        ];
        for (const selector of postedSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            data.postedTime = element.textContent.trim();
            break;
          }
        }

        // Number of Applicants
        const applicantsElement = document.querySelector(
          ".jobs-unified-top-card__applicant-count, .num-applicants__caption"
        );
        if (applicantsElement) {
          data.applicants = applicantsElement.textContent.trim();
        }

        // Job Description
        const descriptionSelectors = [
          ".jobs-description__content",
          ".jobs-box__html-content",
          "#job-details",
          ".jobs-description-content__text",
          ".jobs-description",
        ];
        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            data.description = element.textContent.trim().substring(0, 3000);
            break;
          }
        }

        // Job ID and URL
        const currentUrl = window.location.href;
        const jobIdMatch =
          currentUrl.match(/currentJobId=(\d+)/) ||
          currentUrl.match(/jobs\/view\/(\d+)/);
        if (jobIdMatch) {
          data.jobId = jobIdMatch[1];
          data.jobUrl = `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}`;
        }

        // Seniority Level
        const insightElements = document.querySelectorAll(
          ".jobs-unified-top-card__job-insight"
        );
        if (insightElements.length > 0) {
          data.seniorityLevel = insightElements[0]?.textContent.trim();
        }
        if (insightElements.length > 1) {
          data.employmentType = insightElements[1]?.textContent.trim();
        }

        // Skills
        const skillsElements = document.querySelectorAll(
          ".job-details-skill-match-status-list__skill, .job-details-how-you-match__skills-item"
        );
        if (skillsElements.length > 0) {
          data.skills = Array.from(skillsElements)
            .map((el) => el.textContent.trim())
            .filter((s) => s);
        }

        return data;
      }, location);

      // Validate and return job data
      if (jobData.title && jobData.company && jobData.jobId) {
        if (!processedJobIds.has(jobData.jobId)) {
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
  async scrollJobList(page) {
    return await page.evaluate(async () => {
      const jobList = document.querySelector(
        ".jobs-search-results-list, .scaffold-layout__list, .scaffold-layout__list-container"
      );

      if (!jobList) return false;

      const beforeHeight = jobList.scrollHeight;
      const beforeScroll = jobList.scrollTop;

      jobList.scrollTo(0, jobList.scrollHeight);

      // Wait for new content
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const afterHeight = jobList.scrollHeight;
      const afterScroll = jobList.scrollTop;

      return afterHeight > beforeHeight || afterScroll > beforeScroll;
    });
  }

  /**
   * LinkedIn login
   */
  async linkedinLogin(page) {
    try {
      const credentials = this.getLinkedInCredentials();

      console.log("🔐 Login Credentials Check:");
      console.log(`   Email provided: ${credentials.email ? "YES" : "NO"}`);
      console.log(
        `   Password provided: ${credentials.password ? "YES" : "NO"}`
      );

      if (!credentials.email || !credentials.password) {
        console.log("❌ Missing LinkedIn credentials");
        console.log("💡 Please create linkedin_config.json with:");
        console.log(
          JSON.stringify(
            {
              email: "jaylimbasiya1950@gmail.com",
              password: "TestJay@9683",
            },
            null,
            2
          )
        );

        // Check if file exists
        try {
          if (fs.existsSync("./linkedin_config.json")) {
            console.log("✅ Config file exists, checking permissions...");
            const stats = fs.statSync("./linkedin_config.json");
            console.log(`   File permissions: ${stats.mode.toString(8)}`);
          } else {
            console.log("❌ Config file does not exist");
          }
        } catch (fileError) {
          console.log("❌ Error accessing config file:", fileError.message);
        }
        return false;
      }

      console.log("🌐 Navigating to LinkedIn login...");
      await page.goto(`${this.baseURL}/login`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      await this.delay(3000);

      // Take screenshot for debugging
      await page.screenshot({ path: "login-page.png", fullPage: true });
      console.log("📸 Login page screenshot saved as 'login-page.png'");

      // Check if we're already logged in
      const isAlreadyLoggedIn = await page.evaluate(() => {
        return (
          document.querySelector(".global-nav, .feed-identity-module") !== null
        );
      });

      if (isAlreadyLoggedIn) {
        console.log("✅ Already logged into LinkedIn");
        return true;
      }

      // Wait for login form with multiple selectors
      let usernameField;
      const selectors = [
        "#username",
        '[name="session_key"]',
        'input[type="email"]',
      ];

      for (const selector of selectors) {
        usernameField = await page.$(selector);
        if (usernameField) {
          console.log(`✅ Found username field with selector: ${selector}`);
          break;
        }
      }

      if (!usernameField) {
        console.log("❌ Could not find username field. Available elements:");
        const pageContent = await page.content();
        const formElements = await page.$$("input, button, form");
        console.log(`   Found ${formElements.length} form elements`);

        // List all input fields
        const inputs = await page.$$eval("input", (elements) =>
          elements.map((el) => ({
            id: el.id,
            name: el.name,
            type: el.type,
            placeholder: el.placeholder,
          }))
        );
        console.log("   Input fields:", inputs);

        return false;
      }

      // Fill credentials
      console.log("⌨️ Filling credentials...");
      await usernameField.click({ clickCount: 3 }); // Select all text
      await usernameField.type(credentials.email, { delay: 100 });

      const passwordField =
        (await page.$("#password")) ||
        (await page.$('[name="session_password"]'));
      if (!passwordField) {
        console.log("❌ Could not find password field");
        return false;
      }

      await passwordField.click({ clickCount: 3 });
      await passwordField.type(credentials.password, { delay: 100 });

      // Click submit
      console.log("🔘 Clicking submit button...");
      const submitButton = await page.$('button[type="submit"]');
      if (submitButton) {
        await submitButton.click();
      } else {
        // Try alternative submit method
        await page.keyboard.press("Enter");
      }

      // Wait for navigation with better handling
      console.log("⏳ Waiting for login to complete...");
      await this.delay(10000);

      // Check for login success
      const loginSuccess = await page.evaluate(() => {
        return (
          document.querySelector(
            ".global-nav, .feed-identity-module, [data-test-global-nav]"
          ) !== null
        );
      });

      if (loginSuccess) {
        console.log("✅ Successfully logged into LinkedIn");
        await this.delay(3000);
        return true;
      } else {
        // Check for error messages
        const errorMessage = await page.evaluate(() => {
          const errorElement = document.querySelector(
            ".error-for-username, .alert-error, [data-test-error]"
          );
          return errorElement ? errorElement.textContent.trim() : null;
        });

        if (errorMessage) {
          console.log(`❌ Login error: ${errorMessage}`);
        } else {
          console.log("❌ Login failed - unknown reason", errorMessage);
          // Take screenshot of current state
          await page.screenshot({ path: "login-failed.png", fullPage: true });
          console.log("📸 Failed login state saved as 'login-failed.png'");
        }
        return false;
      }
    } catch (error) {
      console.error("💥 Login failed with error:", error.message);
      console.error("Stack trace:", error.stack);
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
   * Get LinkedIn credentials
   */
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

// Run the scraper
(async () => {
  const scraper = new LinkedInJobScraper();
  await scraper.scrapeJobs();
})();
