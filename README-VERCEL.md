# LinkedIn Job Scraper for Vercel

This is a Vercel-compatible version of the LinkedIn job scraper that uses `puppeteer-core` and `@sparticuz/chromium-min` for serverless environments.

## Installation

Install the required dependencies:

```bash
npm install puppeteer-core @sparticuz/chromium-min nodemailer
```

For local development, you can also install regular puppeteer:

```bash
npm install puppeteer
```

## Environment Variables

Set these environment variables in Vercel:

- `LINKEDIN_EMAIL` - Your LinkedIn email
- `LINKEDIN_PASSWORD` - Your LinkedIn password
- `EMAIL_USER` - Gmail address for sending emails (optional, defaults to hardcoded value)
- `EMAIL_PASS` - Gmail app password for sending emails (optional, defaults to hardcoded value)

## Usage

### As a Standalone Script

```bash
node linkdinjob.js
```

### In Next.js API Route (Pages Router)

Create `pages/api/scrape-jobs.js`:

```javascript
const LinkedInJobScraper = require("../../linkdinjob.js");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const scraper = new LinkedInJobScraper();
    const results = await scraper.scrapeJobs();

    if (results.error) {
      return res.status(500).json({ error: results.error });
    }

    return res.status(200).json({
      success: true,
      totalJobs: results.totalJobs,
      totalNodeJobs: results.totalNodeJobs,
      locations: results.locations,
      scrapedAt: results.scrapedAt,
    });
  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
```

### In Next.js API Route (App Router)

Create `app/api/scrape-jobs/route.js`:

```javascript
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 minutes (max for Vercel Pro)

export async function GET(request) {
  try {
    // Use dynamic import for CommonJS module
    const LinkedInJobScraper = (await import("../../linkdinjob.js")).default;
    
    const scraper = new LinkedInJobScraper();
    const results = await scraper.scrapeJobs();

    if (results.error) {
      return NextResponse.json(
        { error: results.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      totalJobs: results.totalJobs,
      totalNodeJobs: results.totalNodeJobs,
      locations: results.locations,
      scrapedAt: results.scrapedAt,
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

## Features

- ✅ Vercel/serverless compatible
- ✅ Automatic browser detection (puppeteer for dev, puppeteer-core + chromium for production)
- ✅ LinkedIn job scraping
- ✅ Node.js job filtering
- ✅ Email notifications
- ✅ Multiple location support
- ✅ File saving in development (disabled in production)

## Configuration

Modify the constructor in `linkdinjob.js` to change:

- `locations` - Array of locations to search
- `searchQuery` - LinkedIn search query
- `maxJobsPerLocation` - Maximum jobs per location
- `delayBetweenJobs` - Delay between scraping jobs
- `emailConfig` - Email configuration

## Vercel Deployment Notes

1. **Timeout**: Vercel free tier has a 10-second timeout for Hobby plan, 60 seconds for Pro. For longer scraping, upgrade to Pro and set `maxDuration` in your API route.

2. **Memory**: Puppeteer can be memory-intensive. Consider using Vercel Pro for better performance.

3. **Environment Variables**: Make sure to set all required environment variables in Vercel dashboard.

4. **Chromium Version**: The code uses Chromium v131.0.1. You can update the version in the `launchBrowser()` method if needed.

## Troubleshooting

- **"No Puppeteer installation found"**: Make sure `puppeteer-core` and `@sparticuz/chromium-min` are installed
- **Login fails**: Check that `LINKEDIN_EMAIL` and `LINKEDIN_PASSWORD` are set correctly
- **Timeout errors**: Increase `maxDuration` in your API route and consider upgrading Vercel plan
- **Memory errors**: Reduce `maxJobsPerLocation` or upgrade to Vercel Pro

## License

Same as the original project.


