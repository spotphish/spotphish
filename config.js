var defaultFeeds = [
    {
        "name": "main",
        "src": "https://sudhirkr.github.io/spotphish-model/feeds/main/main.json"
    }
];

var cuaLocation = "http://parking.coriolis.co.in/assets/spotphish/cua.json";
const MlDataLocation = "http://parking.coriolis.co.in/assets/spotphish/";


// var tensorflow_tf;

// async function loadTensorflowModel() {
//     let response = await fetch("https://raw.githubusercontent.com/sudhirkr/spotphish-model/master/load-model.json");
//     let tensorflow_model = await response.json();
//     console.log(tensorflow_model);
//     tensorflow_tf = new TensorflowTF(tensorflow_model.model, tensorflow_model.labels);
//     // return new TensorflowTF(tensorflow_model.model, tensorflow_model.labels);
// }

var algorithm_tensorflow_graph_model_url = "https://raw.githubusercontent.com/sudhirkr/spotphish-model/master/web_model/model.json";
var algorithm_tensorflow_labels = ["Axis Bank", "Bank of Baroda","HDFC Bank","State Bank of India","Kotak Bank","ICICI Bank","Bandhan Bank","Federal Bank", "IndusInd Bank", "Punjab National Bank","RBL Bank","Facebook","Amazon","Paypal","Google","Dropbox","Bank of India","Bank of Maharashtra","Canara Bank","Central Bank of India","Indian Bank","Indian Overseas Bank","Punjab and Sind Bank","Union Bank of India","UCO Bank","Yes Bank","IDBI Bank","LinkedIn","Twitter","incometax"];

