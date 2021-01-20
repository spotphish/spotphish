var ROOT_DIR="https://cdn.jsdelivr.net/gh/spotphish/spotphish@V"+chrome.runtime.getManifest().version;
var defaultFeeds = [
    {
        "name": "main",
        "src":ROOT_DIR+"/models/Template Matching/main.json"
    }
];
const defaultModels=[{
    weightage:100,
    webgl:false,
    name:"TemplateMatching",
    dependencies:[
        ROOT_DIR+"/models/Template Matching/jsfeat.js",
        ROOT_DIR+"/models/Template Matching/orb-features.js"

        ],
    src:ROOT_DIR+"/models/Template Matching/TemplateMatching.js",
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
        src:ROOT_DIR+"/models/LogoDetection/LogoDetection.js",
        label:"Logo Detection",
        selected:false
    }
]