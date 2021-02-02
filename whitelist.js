//Sites of brands with logos, used for phising detection using the red flag approach

var redFlagSites = [{
    "site": "Facebook",
    "enabled": true,
    "type": "default",
    "url": [{
            url: "https://www.facebook.com/",
            green_check: {
                password: 2
            }
        },
        {
            url: "https://www.facebook.com/login/"
        },
        {
            url: "https://www.facebook.com/reg/"
        },
        {
            url: "https://www.facebook.com/login.php"
        }
    ],
    "templates": [{
        "templateName": "Facebook",
        "logo": "assets/img/fb-logo_lnx.png"
    }, {
        "templateName": "Facebook pre 2016",
        "logo": "assets/img/fb-old.png"
    }]
}, {
    "site": "Paypal",
    "enabled": true,
    "type": "default",
    "url": [{
            url: "https://www.paypal.com/in/signin"
        },
        {
            url: "https://www.paypal.com/us/cgi-bin"
        },
        {
            url: "https://www.paypal.com/signin"
        },
        {
            url: "https://www.paypal.com/jp/signin"
        },
        {
            url: "https://www.paypal.com/signin/authorize"
        }
    ],
    "templates": [{
        "templateName": "Paypal",
        "logo": "assets/img/paypal-linux.png"
    }]
}, {
    "site": "Google",
    "enabled": true,
    "type": "default",
    "url": [{
            url: "https://accounts.google.com/signin/v2/identifier"
        },
        {
            url: "https://accounts.google.com/signin/oauth/identifier"
        },
        {
            url: "https://accounts.google.com/signin/v2/sl/pwd"
        }
    ],
    "templates": [{
        "templateName": "Google 2016",
        "logo": "assets/img/google-old.png"
    }, {
        "templateName": "Google mid 2017",
        "logo": "assets/img/google-logo.png"
    }]
}, {
    "site": "Amazon",
    "enabled": true,
    "type": "default",
    "url": [{
            url: "https://www.amazon.in/ap/signin"
        },
        {
            url: "https://www.amazon.com/ap/signin"
        },
        {
            url: "https://www.amazon.co.uk/ap/signin"
        },
        {
            url: "https://www.amazon.com.au/ap/signin"
        },
        {
            url: "https://www.amazon.co.jp/ap/signin"
        },
        {
            url: "https://www.amazon.cn/ap/signin"
        },
        {
            url: "https://www.amazon.sg/ap/signin"
        },
        {
            url: "https://www.amazon.fr/ap/signin"
        },
        {
            url: "https://www.amazon.de/ap/signin"
        },
        {
            url: "https://www.amazon.it/ap/signin"
        },
        {
            url: "https://www.amazon.nl/ap/signin"
        },
        {
            url: "https://www.amazon.es/ap/signin"
        },
        {
            url: "https://www.amazon.ca/ap/signin"
        },
        {
            url: "https://www.amazon.com.mx/ap/signin"
        },
        {
            url: "https://www.amazon.com.br/ap/signin"
        }
    ],
    "templates": [{
        "templateName": "Amazon",
        "logo": "assets/img/amazon-logo.png"
    }, {
        "templateName": "AWS",
        "logo": "assets/img/aws-logo.png"
    }]
}, {
    "site": "Dropbox",
    "enabled": true,
    "type": "default",
    "url": [{
            url: "https://www.dropbox.com/"
        },
        {
            url: "https://www.dropbox.com/business"
        }
    ],
    "templates": [{
        "templateName": "Dropbox-1",
        "logo": "assets/img/db1.png"
    }, {
        "templateName": "Dropbox-2",
        "logo": "assets/img/db2.png"
    }]
}];

//Domains/sites that are skipped completely for red flaf approach.
var skipDomains = [{
    "name": "Google",
    "site": "google.com",
    "whiteListed": true,
    "domains": ["google.com", "google.co.in"]
}, {
    "name": "Facebook",
    "site": "facebook.com",
    "whiteListed": true,
    "domains": ["facebook.com"],
}, {
    "name": "Paypal",
    "site": "paypal.com",
    "whiteListed": true,
    "domains": ["paypal.com"]
}, {
    "name": "Amazon",
    "site": "amazon.com",
    "whiteListed": true,
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
}, {
    "name": "Dropbox",
    "site": "dropbox.com",
    "whiteListed": true,
    "domains": ["dropbox.com"]
}];