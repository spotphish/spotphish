var defaultFeeds = [{
    "name": "main",
    "src": "https://cdn.jsdelivr.net/gh/spotphish/spotphish@v" + chrome.runtime.getManifest().version + "/models/Template Matching/main.json"
}];
const defaultModels = [{
        root: "https://github.com/spotphish/spotphish/tree/master/models/Template Matching",
        weightage: 20,
        webgl: false,
        label: "Template Matching",
        selected: true,
    },
    {
        root: "https://github.com/spotphish/spotphish/tree/master/models/LogoDetection",
        webgl: true,
        weightage: 80,
        label: "Logo Detection",
        selected: true
    }
]