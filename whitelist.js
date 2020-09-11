//Sites of brands with logos, used for phising detection using the red flag approach

var redFlagSites =[{
    "site": "Facebook",
    "enabled": true,
    "type": "default",
    "url": [
        { url: "https://www.facebook.com/", green_check: { password: 2 } },
        { url: "https://www.facebook.com/login/" },
        { url: "https://www.facebook.com/reg/" },
        { url: "https://www.facebook.com/login.php" }
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
        { url: "https://www.paypal.com/in/signin" },
        { url: "https://www.paypal.com/us/cgi-bin" },
        { url: "https://www.paypal.com/signin" },
        { url: "https://www.paypal.com/jp/signin" },
        { url: "https://www.paypal.com/signin/authorize" }
    ],
    "templates": [{
        "templateName": "Paypal",
        "logo": "assets/img/paypal-linux.png"
    }]
} ,{
    "site": "Google",
    "enabled": true,
    "type": "default",
    "url": [
        { url: "https://accounts.google.com/signin/v2/identifier" },
        { url: "https://accounts.google.com/signin/oauth/identifier" },
        { url: "https://accounts.google.com/signin/v2/sl/pwd" }
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
        { url: "https://www.amazon.in/ap/signin" },
        { url: "https://www.amazon.com/ap/signin" },
        { url: "https://www.amazon.co.uk/ap/signin" },
        { url: "https://www.amazon.com.au/ap/signin" },
        { url: "https://www.amazon.co.jp/ap/signin" },
        { url: "https://www.amazon.cn/ap/signin" },
        { url: "https://www.amazon.sg/ap/signin" },
        { url: "https://www.amazon.fr/ap/signin" },
        { url: "https://www.amazon.de/ap/signin" },
        { url: "https://www.amazon.it/ap/signin" },
        { url: "https://www.amazon.nl/ap/signin" },
        { url: "https://www.amazon.es/ap/signin" },
        { url: "https://www.amazon.ca/ap/signin" },
        { url: "https://www.amazon.com.mx/ap/signin" },
        { url: "https://www.amazon.com.br/ap/signin" }
    ],
    "templates": [{
        "templateName": "Amazon",
        "logo": "assets/img/amazon-logo.png"
    }, {
        "templateName":"AWS",
        "logo":"assets/img/aws-logo.png"
    }]
}, {
    "site": "Dropbox",
    "enabled": true,
    "type": "default",
    "url": [
        {url: "https://www.dropbox.com/"},
        {url: "https://www.dropbox.com/business"}
    ],
    "templates": [{
        "templateName": "Dropbox-1",
        "logo": "assets/img/db1.png"
    }, {
        "templateName":"Dropbox-2",
        "logo":"assets/img/db2.png"
    }]
}/*, {//---------------------------------------------------------------------------
    "site": "Axis Bank",
    "enabled": true,
    "type": "default",
    "url": [
        {url: "https://www.axisbank.com/"},
        {url: "https://www.axisbank.com/bank-smart/internet-banking/getting-started"},
        {url: "https://retail.axisbank.co.in/wps/portal/rBanking/axisebanking/AxisRetailLogin/!ut/p/a1/04_Sj9CPykssy0xPLMnMz0vMAfGjzOKNAzxMjIwNjLwsQp0MDBw9PUOd3HwdDQwMjIEKIoEKDHAARwNC-sP1o_ArMYIqwGNFQW6EQaajoiIAVNL82A!!/dl5/d5/L2dBISEvZ0FBIS9nQSEh/?_ga=2.176901798.2087957965.1597285660-2077410702.1597035646"}
    ],
    "templates": [{
        "templateName": "Axis-Bank-1",
        "logo": "assets/img/Axis-Bank-1.png"
    }, {
        "templateName":"Axis-Bank-2",
        "logo":"assets/img/Axis-Bank-2.png"
    }]
}, {
    "site": "Bank of Baroda",
    "enabled": true,
    "type": "default",
    "url": [
        {url: "https://www.bankofbaroda.in/"},
        {url: "https://www.bobibanking.com/"},
        {url: "https://www.bankofbaroda.in/login.htm"},
        {url: "https://feba.bobibanking.com/corp/AuthenticationController?FORMSGROUP_ID__=AuthenticationFG&__START_TRAN_FLAG__=Y&FG_BUTTONS__=LOAD&ACTION.LOAD=Y&AuthenticationFG.LOGIN_FLAG=1&BANK_ID=012&language=English"}
    ],
    "templates": [{
        "templateName": "Bank-of-Baroda-1",
        "logo": "assets/img/Bank-of-Baroda-1.png"
    }, {
        "templateName":"Bank-of-Baroda-2",
        "logo": "assets/img/Bank-of-Baroda-2.png"
    }]
}, {
    "site": "HDFC Bank",
    "enabled": true,
    "type": "default",
    "url": [
        {url: "https://www.hdfcbank.com/"},
        {url: "https://netbanking.hdfcbank.com/netbanking/?_ga=2.209993557.1157941487.1597288009-2143975229.1597036634"},
        {url: "https://v1.hdfcbank.com/assets/popuppages/netbanking.htm"}
    ],
    "templates": [{
        "templateName": "HDFC-Bank-1",
        "logo": "assets/img/HDFC-Bank-1.png"
    }, {
        "templateName": "HDFC-Bank-2",
        "logo": "assets/img/HDFC-Bank-2.png"
    }, {
        "templateName": "HDFC-Bank-3",
        "logo": "assets/img/HDFC-Bank-3.png"
    }]
}/*, {
    "site": "",
    "enabled": true,
    "type": "default",
    "url": [
        {url: ""},
        {url: ""}
    ],
    "templates": [{
        "templateName": "",
        "logo": "assets/img/.png"
    }, {
        "templateName":"",
        "logo":"assets/img/.png"
    }]
}*/
];

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
                        "domains": ["facebook.com"],
                    }, {
                        "name": "Paypal",
                        "site": "paypal.com",
                        "whiteListed":true,
                        "domains": ["paypal.com"]
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
                    }, {
                        "name": "Dropbox",
                        "site": "dropbox.com",
                        "whiteListed":true,
                        "domains": ["dropbox.com"]
                    }/*, {
                        "name": "Axis Bank",
                        "site": "axisbank.com",
                        "whiteListed":true,
                        "domains": ["axisbank.com",
                                    "retail.axisbank.co.in"
                                ]
                    }, {
                        "name": "Bank of Baroda",
                        "site": "bankofbaroda.in",
                        "whiteListed":true,
                        "domains": ["bankofbaroda.in",
                                    "bobibanking.com",
                                    "feba.bobibanking.com"
                                ]
                    }, {
                        "name": "HDFC Bank",
                        "site": "hdfcbank.com",
                        "whiteListed":true,
                        "domains": ["hdfcbank.com",
                                    "netbanking.hdfcbank.com",
                                    "v1.hdfcbank.com"
                                ]
                    }/*, {
                        "name": "",
                        "site": "",
                        "whiteListed":true,
                        "domains": [""]
                    }*/
];
