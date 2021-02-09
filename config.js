var defaultFeeds = [{
    "name": "main",
    "src": "https://spotphish.github.io/feeds/main/main.json"
}];
const defaultModels = [{
        root: "https://github.com/spotphish/models/tree/master/Template Matching",
        weightage: 20,
        webgl: false,
        label: "Template Matching",
        selected: false,
    },
    {
        root: "https://github.com/spotphish/models/tree/master/LogoDetection",
        webgl: true,
        weightage: 100,
        label: "Logo Detection",
        selected: true
    }
]