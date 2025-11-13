const express = require("express");
const path = require("path");
const cors = require("cors");
const nodemailer = require("nodemailer");
const LinkedInEmailScraper = require("./combine");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("."));

// Serve HTML page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Scraping endpoint with Server-Sent Events
// Email sending function
async function sendResultsToEmail(combinedResults, companyName) {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "jaylimbasiya93@gmail.com",
      pass: "mjsg ikgq yokl bmew",
    },
  });

  // Format the results as HTML table
  const resultsHTML = `
    <h2>Scraping Results for ${companyName}</h2>
    <table border="1" cellpadding="8" style="border-collapse: collapse;">
      <thead>
        <tr style="background-color: #f2f2f2;">
          <th>Name</th>
          <th>Email</th>
          <th>Status</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody>
        ${combinedResults
          .map(
            (result) => `
          <tr>
            <td>${result.name || "N/A"}</td>
            <td>${result.email || "Not Found"}</td>
            <td>${result.status || "Unknown"}</td>
            <td>${result.source || "LinkedIn + Email Finder"}</td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>
    <p><strong>Total Results:</strong> ${combinedResults.length}</p>
    <p><strong>Emails Found:</strong> ${
      combinedResults.filter((r) => r.email).length
    }</p>
  `;

  try {
    await transporter.sendMail({
      from: "jaylimbasiya93@gmail.com",
      to: "jaylimbasiya93@gmail.com", // Send to yourself
      subject: `Scraping Results for ${companyName} - ${new Date().toLocaleDateString()}`,
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h1 style="color: #333;">LinkedIn Scraping Report</h1>
          ${resultsHTML}
          <br>
          <p><strong>Generated on:</strong> ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    console.log("Results email sent successfully to jaylimbasiya93@gmail.com");
    return true;
  } catch (error) {
    console.error("Error sending results email:", error.message);
    return false;
  }
}

// Modified scraping endpoint
app.post("/scrape", async (req, res) => {
  const { companyName, website, maxNames, jobLink } = req.body;

  console.log(
    `Starting scraping for: ${companyName}, ${website}, ${maxNames} names`
  );

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    "Content-Type": "text/plain",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  try {
    const scraper = new LinkedInEmailScraper();

    // Override console.log to stream logs to client
    const originalConsoleLog = console.log;
    console.log = function (...args) {
      const message = args
        .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : arg))
        .join(" ");

      originalConsoleLog.apply(console, args);

      res.write(
        JSON.stringify({
          type: "log",
          message: message,
          timestamp: new Date().toLocaleTimeString(),
        }) + "\n"
      );
    };

    // Send progress updates
    const sendProgress = (percentage, stage) => {
      res.write(
        JSON.stringify({
          type: "progress",
          percentage: percentage,
          stage: stage,
          timestamp: new Date().toLocaleTimeString(),
        }) + "\n"
      );
    };

    sendProgress(10, "🚀 Starting LinkedIn scraping...");

    // Step 1: Get names from LinkedIn
    sendProgress(30, "🔍 Searching LinkedIn for employee names...");
    const linkedinNames = await scraper.getPeopleFromCompany(
      companyName,
      maxNames
    );

    if (!linkedinNames || linkedinNames.length === 0) {
      throw new Error("No names found from LinkedIn");
    }

    sendProgress(
      50,
      `📝 Found ${linkedinNames.length} names, starting email discovery...`
    );

    // Step 2: Find emails
    sendProgress(70, "📧 Finding emails using Mailmeteor...");
    const emailResults = await scraper.findEmailsForNames(
      linkedinNames,
      website
    );

    // Prepare results
    const foundEmails = emailResults.detailedResults.filter((r) => r.email);
    const successRate = (
      (foundEmails.length / linkedinNames.length) *
      100
    ).toFixed(1);

    sendProgress(90, "💾 Preparing final results...");

    // Create combined results
    const combinedResults = emailResults.detailedResults.map((result) => ({
      name: result.name,
      email: result.email,
      status: result.status,
      source: "LinkedIn + Email Finder",
    }));

    const finalResults = {
      company: companyName,
      website: website,
      linkedinNames: linkedinNames.length,
      emailsFound: foundEmails.length,
      successRate: successRate,
      processingTime: (scraper.totalProcessingTime / 1000).toFixed(2),
      fullResults: {
        company: companyName,
        domain: website,
        scrapedAt: new Date().toISOString(),
        linkedinNames: {
          total: linkedinNames.length,
          names: linkedinNames,
        },
        emailResults: {
          totalProcessed: emailResults.detailedResults.length,
          emailsFound: emailResults.emailArray.length,
          successRate: successRate,
          details: emailResults.detailedResults,
        },
        combined: combinedResults,
      },
    };

    // Send results to email
    sendProgress(95, "📧 Sending results to email...");
    const emailSent = await sendResultsToEmail(combinedResults, companyName);

    if (emailSent) {
      console.log("✅ Results successfully sent to jaylimbasiya93@gmail.com");
    } else {
      console.log("⚠️ Failed to send results email");
    }

    // Send emails to the scraped addresses
    const { sendEmails } = require("./index");
    const emailArray = combinedResults
      .filter((result) => result.email)
      .map((result) => result.email);

    if (emailArray.length > 0) {
      sendProgress(
        98,
        "📨 Sending application emails to discovered addresses..."
      );
      try {
        await sendEmails(emailArray, jobLink);
        console.log(
          `✅ Application emails sent successfully to ${emailArray.length} recipients`
        );
      } catch (error) {
        console.log(`⚠️ Error sending application emails: ${error.message}`);
      }
    }

    // Send completion
    res.write(
      JSON.stringify({
        type: "complete",
        results: finalResults,
        emailSent: emailSent,
        timestamp: new Date().toLocaleTimeString(),
      }) + "\n"
    );

    console.log = originalConsoleLog;
    res.end();
  } catch (error) {
    console.error("Scraping error:", error);

    res.write(
      JSON.stringify({
        type: "error",
        message: error.message,
        timestamp: new Date().toLocaleTimeString(),
      }) + "\n"
    );

    res.end();
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `📧 LinkedIn Email Scraper Web Interface available at: http://localhost:${PORT}`
  );
});
