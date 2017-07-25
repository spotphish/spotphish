//Sites of brands with logos, used for phising detection using the red flag approach
//diagDistance is irrelevant for now, can be skipped for any new logo added.
var redFlagSites = [
    {"templateName":"Facebook", "site": "Facebook", "logo": "assets/img/fb-logo_lnx.png", "diagDist": 202, "enabled":true, "type": "default", "url": "https://www.facebook.com/" },
    { "templateName":"Facebook old","site": "Facebook", "logo": "assets/img/fb-old.png", "diagDist": 121 , "enabled":true, "type": "default", "url": "https://www.facebook.com/"},
    { "templateName":"Paypal","site": "Paypal", "logo": "assets/img/paypal-linux.png", "diagDist":156 , "enabled":true, "type": "default", "url": "https://www.paypal.com/in/signin"},
    { "templateName":"ICICI Bank","site": "ICICI", "logo": "assets/img/icici-shot.png", "diagDist": 195 , "enabled":true, "type": "default", "url": "https://infinity.icicibank.com/corp/AuthenticationController"},
    { "templateName":"HDFC bank","site": "HDFC", "logo": "assets/img/hdfc-screen.png", "diagDist":158 , "enabled":true, "type": "default", "url": "https://netbanking.hdfcbank.com/netbanking"},
    { "templateName":"IDBI Bank","site": "IDBI", "logo": "assets/img/idbi-linux.png", "diagDist":217 , "enabled":true, "type": "default", "url": "https://inet.idbibank.co.in/corp/BANKAWAY"},
    { "templateName":"Dropbox","site": "Dropbox", "logo": "assets/img/db-logo.png", "diagDist":57 , "enabled":true, "type": "default", "url": "https://www.dropbox.com/"},
    { "templateName":"Google 2017","site": "Google", "logo": "assets/img/google-logo.png", "diagDist":90 , "enabled":true, "type": "default", "url": "https://accounts.google.com/ServiceLogin"},
    { "templateName":"Google 2016","site": "Google", "logo": "assets/img/google-old.png", "diagDist":129 , "enabled":true, "type": "default", "url": "https://accounts.google.com/ServiceLogin"}
];

var greenFlagUrls = {
                        
                        "Paypal":[
                                "https://www.paypal.com/in/signin",
                                "https://www.paypal.com/us/cgi-bin",
                                "https://www.paypal.com/signin",
                                "https://www.paypal.com/jp/signin"],

                        "Facebook":[
                                "https://www.facebook.com/",
                                "https://www.facebook.com/login/"],
                        "ICICI":[
                                "https://infinity.icicibank.com/corp/AuthenticationController"],
                        "HDFC":[
                                "https://netbanking.hdfcbank.com/netbanking"],
                        "IDBI":[
                                "https://inet.idbibank.co.in/corp/BANKAWAY"],
                        "Dropbox":[
                                "https://www.dropbox.com/"],
                        "Google":[
                                "https://accounts.google.com/signin/v2/identifier"]
};


//Domains/sites that are skipped completely for red flaf approach.
var skipDomains = [ "google.com", "facebook.com", "google.co.in", "paypal.com", "icicibank.com", "hdfcbank.com", "dropbox.com", "inet.idbibank.co.in"];
