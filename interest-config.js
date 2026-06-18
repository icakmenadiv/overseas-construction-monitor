// Anonymous interest-heart feature configuration.
//
// Safety rule:
// - Keep INTEREST_FEATURE_ENABLED false on production unless the UI has been tested.
// - You can preview the feature without changing this file by opening index.html?interest=1.
//
// Backend rule:
// - Leave INTEREST_API_ENDPOINT empty for browser-only test mode.
// - After deploying the Cloudflare Worker, set it to the Worker URL.

window.INTEREST_FEATURE_ENABLED = false;
window.INTEREST_API_ENDPOINT = "";
