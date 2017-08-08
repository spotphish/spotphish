//Sites of brands with logos, used for phising detection using the red flag approach

var redFlagSites =[{
    "site": "Facebook",
    "enabled": true,
    "type": "default",
    "url": [
        "https://www.facebook.com/",
        "https://www.facebook.com/login/",
        "https://www.facebook.com/reg/",
        "https://www.facebook.com/login.php"
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
    "site": "Google",
    "enabled": true,
    "type": "default",
    "url": [
        "https://accounts.google.com/signin/v2/identifier",
        "https://accounts.google.com/signin/oauth/identifier"
    ],
    "templates": [{
        "templateName": "Google 2016",
        "logo": "assets/img/google-old.png"
    }, {
        "templateName":"Google mid 2017",
        "logo":"assets/img/google-logo.png"
    }]
}, {
    "site": "Amazon",
    "enabled": true,
    "type": "default",
    "url": [
        "https://www.amazon.in/ap/signin",
        "https://www.amazon.com/ap/signin",
        "https://www.amazon.co.uk/ap/signin",
        "https://www.amazon.com.au/ap/signin",
        "https://www.amazon.co.jp/ap/signin",
        "https://www.amazon.cn/ap/signin",
        "https://www.amazon.sg/ap/signin",
        "https://www.amazon.fr/ap/signin",
        "https://www.amazon.de/ap/signin",
        "https://www.amazon.it/ap/signin",
        "https://www.amazon.nl/ap/signin",
        "https://www.amazon.es/ap/signin",
        "https://www.amazon.ca/ap/signin",
        "https://www.amazon.com.mx/ap/signin",
        "https://www.amazon.com.br/ap/signin"
    ],
    "templates": [{
        "templateName": "Amazon",
        "logo": "assets/img/amazon-logo.png"
    }, {
        "templateName":"AWS",
        "logo":"assets/img/aws-logo.png"
    }]
}]

//Domains/sites that are skipped completely for red flaf approach.
var skipDomains = [ {
                        "name": "Google",
                        "site": "google.com",
                        "whiteListed":true,
                        "domains": ["google.com","google.co.in"]
                    }, {
                        "name": "Facebook",
                        "site": "facebook.com",
                        "whiteListed":true,
                        "domains": ["facebook.com"]
                    }, {
                        "name": "Paypal",
                        "site": "paypal.com",
                        "whiteListed":true,
                        "domains": ["paypal.com"]
                    }, {
                        "name": "ICICI Bank",
                        "site": "icicibank.com",
                        "whiteListed":true,
                        "domains": ["icicibank.com"]
                    }, {
                        "name" : "IDBI Bank",
                        "site": "inet.idbibank.co.in",
                        "whiteListed":true,
                        "domains": ["inet.idbibank.co.in", "www.idbi.com"]
                    }, {
                        "name" : "Amazon",
                        "site": "amazon.com",
                        "whiteListed":true,
                        "domains": [
                                    "amazon.com",
                                    "amazon.in",
                                    "amazon.co.uk",
                                    "amazon.com.au",
                                    "amazon.co.jp",
                                    "amazon.cn",
                                    "amazon.sg",
                                    "amazon.fr",
                                    "amazon.de",
                                    "amazon.nl",
                                    "amazon.es",
                                    "amazon.it",
                                    "amazon.ca",
                                    "amazon.com.mx",
                                    "amazon.com.br"
                                    ]
                    }];
