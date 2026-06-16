// Run a single scrape locally: `npm run scrape`
// Useful for testing without waiting for the cron.

import { runScrape } from "../lib/scrape-runner";

runScrape()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
