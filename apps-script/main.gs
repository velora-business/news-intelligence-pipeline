// ============================================================
// CONFIGURATION
// ============================================================
const SLACK_TOKEN = "YOUR SLACK BOT TOKEN HERE"; // Get this from api.slack.com/apps
const CHANNEL_ID = "YOUR SLACK CHANNEL ID HERE"; // this is where the news will come in via RSS
const SHEET_NAME = "YOUR GOOGLE SHEET TAB NAME HERE"; // this is where the slack based RSS will be funneled into
const RAILWAY_URL = "YOUR RAILWAY URL HERE/scrape"; // Replace with your Railway URL
const BATCH_SIZE = 10;       // URLs per batch sent to Railway
const TIME_LIMIT_MS = 330000; // 5.5 minutes in milliseconds — stops before hitting 6 min limit


// ============================================================
// MASTER FUNCTION — trigger this weekly
// ============================================================
function fetchAndSummariseAseanNews() {
  fetchAseanNews();
  scrapeAndSummarise();
}


// ============================================================
// PART 1: FETCH URLS FROM SLACK
// Unchanged from your original — only addition is columns D
// and E are now included when writing new rows to the sheet
// ============================================================
function fetchAseanNews() {
  const oneWeekAgo = (Date.now() / 1000) - (7 * 24 * 60 * 60);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  const existingUrls = new Set();
  const lastRow = sheet.getLastRow();
  if (lastRow > 0) {
    sheet.getRange(1, 2, lastRow, 1).getValues().forEach(row => existingUrls.add(row[0]));
  }

  const duplicateTracker = {};
  let cursor = "";
  let allMessages = [];

  do {
    let url = `https://slack.com/api/conversations.history?channel=${CHANNEL_ID}&oldest=${oneWeekAgo}&limit=100`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = UrlFetchApp.fetch(url, {
      headers: { "Authorization": "Bearer " + SLACK_TOKEN }
    });
    const data = JSON.parse(response.getContentText());

    if (!data.ok) { Logger.log("Slack error: " + data.error); return; }

    allMessages = allMessages.concat(data.messages);
    cursor = data.response_metadata && data.response_metadata.next_cursor
      ? data.response_metadata.next_cursor : "";
  } while (cursor);

  Logger.log("Total messages fetched: " + allMessages.length);

  const rows = [];

  for (const msg of allMessages) {
    try {
      const rawUrl = msg.blocks[0].elements[0].elements[0].url;
      const actualUrl = decodeURIComponent(rawUrl.match(/url=([^&]+)/)[1]);

      if (existingUrls.has(actualUrl)) {
        duplicateTracker[actualUrl] = (duplicateTracker[actualUrl] || 0) + 1;
        continue;
      }

      existingUrls.add(actualUrl);

      const snippet = msg.text
        .split("\n").slice(1).join(" ")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .trim();

      const date = new Date(parseFloat(msg.ts) * 1000);
      const tz = Session.getScriptTimeZone();
      const day = parseInt(Utilities.formatDate(date, tz, "d"), 10);
      const month = Utilities.formatDate(date, tz, "MMMM");
      const year = Utilities.formatDate(date, tz, "yyyy");
      const time = Utilities.formatDate(date, tz, "HH:mm:ss");

      let suffix = "th";
      if (day % 10 === 1 && day !== 11) suffix = "st";
      else if (day % 10 === 2 && day !== 12) suffix = "nd";
      else if (day % 10 === 3 && day !== 13) suffix = "rd";

      const dateStr = `${day}${suffix} ${month} ${year} ${time}`;

      // Added "" for Col D (AI Summary) and "PENDING" for Col E (Status) ---
      rows.push([dateStr, actualUrl, snippet, "", "PENDING"]);

    } catch(e) {
      Logger.log("Skipped message: " + e.message);
    }
  }

  if (rows.length > 0) {
    if (sheet.getLastRow() === 0) {
      // Headers now include AI Summary and Status columns ---
      sheet.appendRow(["Timestamp", "URL", "Snippet", "AI Summary", "Status"]);
    }
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 5).setValues(rows);
    Logger.log("Written " + rows.length + " new unique rows to sheet.");
  } else {
    Logger.log("No new unique messages found.");
  }

  const dupeKeys = Object.keys(duplicateTracker);
  if (dupeKeys.length > 0) {
    Logger.log("--- Duplicate URL Summary ---");
    dupeKeys.forEach(url => Logger.log(`Found ${duplicateTracker[url]} duplicate(s) of: ${url}`));
  } else {
    Logger.log("--- No duplicates found. ---");
  }
}


// ============================================================
// PART 2: SCRAPE AND SUMMARISE
// Reads all PENDING rows, sends them to Railway in batches
// of 10, writes summaries to Col D and status to Col E.
// Stops before 6 min limit and schedules continuation if needed.
// ============================================================
function scrapeAndSummarise() {
  const startTime = Date.now();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const totalRows = sheet.getLastRow();

  if (totalRows <= 1) { Logger.log("No rows to process."); return; }

  const urlCol = sheet.getRange(2, 2, totalRows - 1, 1).getValues();
  const statusCol = sheet.getRange(2, 5, totalRows - 1, 1).getValues();

  // Collect all row indices that are still PENDING
  const pendingIndices = [];
  for (let i = 0; i < urlCol.length; i++) {
    if (urlCol[i][0] && statusCol[i][0] === "PENDING") {
      pendingIndices.push(i);
    }
  }

  Logger.log(`Total PENDING rows: ${pendingIndices.length}`);

  if (pendingIndices.length === 0) {
    Logger.log("All rows already processed.");
    return;
  }

  let processed = 0;

  // Process in batches of BATCH_SIZE
  for (let b = 0; b < pendingIndices.length; b += BATCH_SIZE) {

    //Time check — stop if approaching 5.5 minute limit ---
    if (Date.now() - startTime > TIME_LIMIT_MS) {
      Logger.log("Approaching time limit. Scheduling continuation.");
      scheduleContinuation();
      return;
    }

    const batchIndices = pendingIndices.slice(b, b + BATCH_SIZE);
    const batchUrls = batchIndices.map(i => urlCol[i][0]);

    Logger.log(`Processing batch of ${batchUrls.length} URLs...`);

    try {
      //Send batch to Railway endpoint ---
      const response = UrlFetchApp.fetch(RAILWAY_URL, {
        method: "POST",
        contentType: "application/json",
        payload: JSON.stringify({ urls: batchUrls }),
        muteHttpExceptions: true
      });

      const data = JSON.parse(response.getContentText());

      if (!data.results) {
        Logger.log("Railway error: " + response.getContentText());
        // Mark entire batch as failed
        batchIndices.forEach(i => {
          sheet.getRange(i + 2, 4).setValue("SCRAPE_FAILED");
          sheet.getRange(i + 2, 5).setValue("SCRAPE_FAILED");
        });
        continue;
      }

      //Write summaries and statuses back to sheet ---
      data.results.forEach((result, idx) => {
        const rowNum = batchIndices[idx] + 2;
        const summary = result.summary;

        if (summary === "SCRAPE_FAILED" || summary === "SUMMARY_FAILED") {
          sheet.getRange(rowNum, 4).setValue(summary);
          sheet.getRange(rowNum, 5).setValue(summary);
        } else {
          sheet.getRange(rowNum, 4).setValue(summary);
          sheet.getRange(rowNum, 5).setValue("DONE");
        }
      });

      processed += batchUrls.length;
      Logger.log(`Batch complete. Total processed so far: ${processed}`);

    } catch(e) {
      Logger.log("Batch error: " + e.message);
      batchIndices.forEach(i => {
        sheet.getRange(i + 2, 4).setValue("ERROR: " + e.message);
        sheet.getRange(i + 2, 5).setValue("ERROR");
      });
    }
  }

  Logger.log(`Scraping run complete. Processed ${processed} articles.`);
}


// ============================================================
// PART 3: CONTINUATION PATTERN
// If time runs out, schedules continueScraping() to run
// 1 minute later and pick up all remaining PENDING rows
// ============================================================
function scheduleContinuation() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === "continueScraping") {
      Logger.log("Continuation trigger already exists.");
      return;
    }
  }
  ScriptApp.newTrigger("continueScraping")
    .timeBased()
    .after(60 * 1000) // 1 minute
    .create();
  Logger.log("Continuation scheduled in 1 minute.");
}

function continueScraping() {
  // Delete this trigger first so it doesn't pile up
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === "continueScraping") ScriptApp.deleteTrigger(t);
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const totalRows = sheet.getLastRow();
  if (totalRows <= 1) return;

  const statusCol = sheet.getRange(2, 5, totalRows - 1, 1).getValues();
  const remaining = statusCol.filter(r => r[0] === "PENDING").length;

  if (remaining === 0) {
    Logger.log("All articles processed. Pipeline complete.");
    return;
  }

  Logger.log(`${remaining} PENDING articles remaining. Continuing...`);
  scrapeAndSummarise();
}
