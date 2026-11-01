/**
 * Automatic Rapid report import -- Google Apps Script, runs under meitalg@ymax.co.il.
 *
 * Rapid emails two daily reports from info@ymax.co.il, each with a
 * DynamicReport_*.xlsx attachment:
 *   - "ירוקים2" (~08:00)               -> /api/sync/referrals-email (ירוקים)
 *   - "דו"ח מכירות אווטומאטי" (~10:00) -> /api/sync/sales-email (כסף ראפיד)
 * This script POSTs each attachment to the matching dashboard endpoint.
 * Processed threads get the Gmail label below so each email is imported
 * once; a failed POST leaves the thread unlabeled and the next daily run
 * retries it.
 *
 * This file is the reference copy -- the running copy lives at
 * script.google.com (pasted in by Meital). Setup:
 *   1. New project at script.google.com, paste this file.
 *   2. Project Settings > Script Properties: add CRON_SECRET (same value as
 *      the dashboard's Vercel env).
 *   3. Run installTrigger() once and approve the Gmail permissions.
 */

const DASHBOARD = 'https://ymax-goals-dashboard.vercel.app/api/sync/';
const DONE_LABEL = 'dashboard-imported';
const REPORTS = [
  { subject: 'subject:ירוקים2', endpoint: 'referrals-email' },
  { subject: 'subject:"מכירות אווטומאטי"', endpoint: 'sales-email' },
];

function importRapidEmails() {
  const secret = PropertiesService.getScriptProperties().getProperty('CRON_SECRET');
  if (!secret) throw new Error('CRON_SECRET missing from Script Properties');
  const label = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);

  REPORTS.forEach(function (report) {
    const query = 'from:info@ymax.co.il ' + report.subject + ' has:attachment newer_than:7d -label:' + DONE_LABEL;
    // Oldest first, so if several days piled up the newest snapshot lands last.
    GmailApp.search(query).reverse().forEach(function (thread) {
      const msg = thread.getMessages()[0];
      const xlsx = msg.getAttachments().filter(function (a) {
        return /\.xlsx$/i.test(a.getName());
      })[0];
      if (!xlsx) return;

      const reportDate = Utilities.formatDate(msg.getDate(), 'Asia/Jerusalem', 'yyyy-MM-dd');
      const res = UrlFetchApp.fetch(DASHBOARD + report.endpoint + '?reportDate=' + reportDate, {
        method: 'post',
        contentType: 'application/octet-stream',
        payload: xlsx.copyBlob().getBytes(),
        headers: { Authorization: 'Bearer ' + secret },
        muteHttpExceptions: true,
      });

      console.log(report.endpoint + ' ' + xlsx.getName() + ' -> HTTP ' + res.getResponseCode() + ' ' + res.getContentText());
      if (res.getResponseCode() === 200) thread.addLabel(label);
    });
  });
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'importRapidEmails') ScriptApp.deleteTrigger(t);
  });
  // The later of the two emails usually lands around 10:00; atHour(11)
  // fires somewhere in 11:00-12:00. A late or failed one is picked up the
  // next day.
  ScriptApp.newTrigger('importRapidEmails').timeBased().everyDays(1).atHour(11)
    .inTimezone('Asia/Jerusalem').create();
}
