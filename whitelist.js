//Sites of brands with logos, used for phising detection using the red flag approach

var redFlagSites =[{
    "site": "Facebook",
    "enabled": true,
    "type": "default",
    "url": [
        "https://www.facebook.com/",
        "https://www.facebook.com/login/"
    ],
    "templates": [{
        "templateName": "Facebook",
        "logo": "assets/img/fb-logo_lnx.png"
    }, {
        "templateName":"Facebook pre 2016",
        "logo":"assets/img/fb-old.png"
    }]
}, {
    "site":"Paypal",
    "enabled": true,
    "type": "default",
    "url": [
        "https://www.paypal.com/in/signin",
        "https://www.paypal.com/us/cgi-bin",
        "https://www.paypal.com/signin",
        "https://www.paypal.com/jp/signin"
    ],
    "templates": [{
        "templateName": "Paypal",
        "logo": "assets/img/paypal-linux.png"
    }]
}, {
    "site":"ICICI Bank",
    "enabled": true,
    "type": "default",
    "url": [
        "https://infinity.icicibank.com/corp/AuthenticationController"
    ],
    "templates": [{
        "templateName": "ICICI bank",
        "logo": "assets/img/icici-shot.png"
    }]
}, {
    "site":"HDFC Bank",
    "enabled": true,
    "type": "default",
    "url": [
        "https://netbanking.hdfcbank.com/netbanking"
    ],
    "templates": [{
        "templateName": "HDFC bank",
        "logo":"assets/img/hdfc-screen.png"
    }]
}, {
    "site":"IDBI Bank",
    "enabled": true,
    "type": "default",
    "url": [
        "https://inet.idbibank.co.in/corp/BANKAWAY"
    ],
    "templates": [{
        "templateName": "IDBI bank",
        "logo":"assets/img/idbi-linux.png"
    }],
},{ 
    "site": "Goole",
    "enabled": true,
    "type": "default",
    "url": [
        "https://accounts.google.com/signin/v2/identifier"
    ],
    "templates": [{
        "templateName": "Google 2016",
        "logo": "assets/img/google-old.png"
    }, {
        "templateName":"Google mid 2017",
        "logo":"assets/img/google-logo.png"
    }]
}]

//Domains/sites that are skipped completely for red flaf approach.
var skipDomains = [ "google.com", "facebook.com", "google.co.in", "paypal.com", "icicibank.com", "hdfcbank.com", "dropbox.com", "inet.idbibank.co.in"];
