var defaultFeeds = [
    {
        "name": "main",
        "src":"https://cdn.jsdelivr.net/gh/spotphish/spotphish/Default Model/Template Matching/main.json"
    }
];
const defaultModels=[{
    weightage:100,
    webgl:false,
    name:"TemplateMatching",
    dependencies:[
        "https://cdn.jsdelivr.net/gh/spotphish/spotphish/Default Model/Template Matching/jsfeat.js",
        "https://cdn.jsdelivr.net/gh/spotphish/spotphish/Default Model/Template Matching/orb-features.js"

        ],
    src:"https://cdn.jsdelivr.net/gh/spotphish/spotphish/Default Model/Template Matching/TemplateMatching.js",
    label:"Template Matching",
    selected:true,
    },
    {
        name:"LogoDetection",
        webgl:true,
        weightage:0,
        dependencies:[
            "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@2.0.0/dist/tf.min.js",
            ],
        src:"https://cdn.jsdelivr.net/gh/spotphish/spotphish/models/LogoDetection/LogoDetection.js",

        label:"Logo Detection",
        selected:false
    }
]