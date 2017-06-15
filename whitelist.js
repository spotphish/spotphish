//Sites of brands with logos, used for phising detection using the red flag approach.
var redFlagSites = [
    { "site": "Facebook", "logo": "assets/img/fb-logo_lnx.png", "diagDist": 202 },
    { "site": "Facebook", "logo": "assets/img/fb-old.png", "diagDist": 121 },
    { "site": "Paypal", "logo": "assets/img/paypal-linux.png", "diagDist":156 },
    { "site": "ICICI", "logo": "assets/img/icici-shot.png", "diagDist": 195 },
    { "site": "HDFC", "logo": "assets/img/hdfc-screen.png", "diagDist":158 },
    { "site": "IDBI", "logo": "assets/img/idbi-linux.png", "diagDist":217 },
    { "site": "Dropbox", "logo": "assets/img/db-logo.png", "diagDist":57 },
    { "site": "Google", "logo": "assets/img/google-logo.png", "diagDist":90 },
    { "site": "Google", "logo": "assets/img/google-old.png", "diagDist":129 }
];

//Sites that are used for greenflag approach. Can be modified by a user
var whiteListedURLs = [ "https://accounts.google.com/signin", "https://www.facebook.com", "https://www.paypal.comi/signin", "https://infinity.icicibank.com/corp/AuthenticationController", "https://netbanking.hdfcbank.com/netbanking", "https://dropbox.com"];

//Domains/sites that are skipped completely for red flaf approach.
var skipDomains = [ "google.com", "facebook.com", "google.co.in", "paypal.com", "icicibank.com", "hdfcbank.com", "dropbox.com"];
