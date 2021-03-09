var defaultFeeds = [{
    "name": "main",
    "src": "https://spotphish.github.io/feeds/main/main.json"
}];
var brandToDomainConverter = {
    src: "https://spotphish.github.io/BrandDomains/converter.json"
}
const defaultModels = [{
        root: "https://github.com/spotphish/models/tree/master/Template Matching",
        weightage: 100,
        webgl: false,
        label: "Template Matching",
        selected: true,
    },
    {
        root: "https://github.com/spotphish/models/tree/master/LogoDetection",
        webgl: true,
        weightage: 100,
        label: "Logo Detection",
        selected: false
    }
]