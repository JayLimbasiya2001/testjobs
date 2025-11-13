// Example Next.js API route for using linkdinjob.js in Vercel
// Place this in: pages/api/scrape-jobs.js (Pages Router) 
// OR app/api/scrape-jobs/route.js (App Router)

// For Pages Router (CommonJS)
const { NextResponse } = require("next/server");
const LinkedInJobScraper = require("../linkdinjob.js");

// For App Router (ES Modules) - uncomment if using App Router:
// import { NextResponse } from "next/server";
// import LinkedInJobScraper from "../linkdinjob.js";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes (max for Vercel Pro)

export async function GET(request) {
  try {
    console.log("🚀 Starting LinkedIn job scraper via API...");

    const scraper = new LinkedInJobScraper();
    const results = await scraper.scrapeJobs();

    if (results.error) {
      return NextResponse.json(
        { error: results.error, message: "Failed to scrape jobs" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Jobs scraped successfully",
        data: {
          totalJobs: results.totalJobs,
          totalNodeJobs: results.totalNodeJobs,
          locations: results.locations,
          scrapedAt: results.scrapedAt,
          totalTime: results.totalTime,
          // Optionally return jobs (might be large, consider pagination)
          // allJobs: results.allJobs,
          // nodeJobs: results.nodeJobs,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        message: "Error scraping jobs",
      },
      { status: 500 }
    );
  }
}

// For Next.js App Router (app/api/scrape-jobs/route.js):
// - Change require to import
// - Use: export async function GET(request: NextRequest)
// - Make sure linkdinjob.js is converted to ES modules or use dynamic import
