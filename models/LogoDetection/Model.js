export default class LogoDetection {
    constructor() {
        // this.label = ["Axis Bank", "Bank of Baroda","HDFC Bank","State Bank of India","Kotak Bank","ICICI Bank","Bandhan Bank","Federal Bank", "IndusInd Bank", "Punjab National Bank","RBL Bank","Facebook","Amazon","Paypal","Google","Dropbox","Bank of India","Bank of Maharashtra","Canara Bank","Central Bank of India","Indian Bank","Indian Overseas Bank","Punjab and Sind Bank","Union Bank of India","UCO Bank","Yes Bank"];
        this.label = [
            "Axis Bank",
            "Bank of Baroda",
            "HDFC Bank",
            "State Bank of India",
            "Kotak Bank",
            "ICICI Bank",
            "Bandhan Bank",
            "Federal Bank",
            "IndusInd Bank",
            "Punjab National Bank",
            "RBL Bank",
            "Facebook",
            "Amazon",
            "Paypal",
            "Google",
            "Dropbox",
            "Bank of India",
            "Bank of Maharashtra",
            "Canara Bank",
            "Central Bank of India",
            "Indian Bank",
            "Indian Overseas Bank",
            "Punjab and Sind Bank",
            "Union Bank of India",
            "UCO Bank",
            "Yes Bank",
            "IDBI Bank",
            "LinkedIn",
            "Twitter",
            "incometax"
        ];
        this.count = 0;
        this.width = 400;
        this.height = 400;
        this.graph_model_url = ROOT_DIR + "/models/LogoDetection/model/model.json";


    }

    drawCorrespondence(x_origin, y_origin, outputs, ans, image) {
        return new Promise((resolve, reject) => {
            var canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(image, x_origin, y_origin, image.width, image.height);
            let y_min = outputs[0].dataSync()[4 * ans] * image.height;
            let x_min = outputs[0].dataSync()[4 * ans + 1] * image.width;
            let y_max = outputs[0].dataSync()[4 * ans + 2] * image.height;
            let x_max = outputs[0].dataSync()[4 * ans + 3] * image.width;
            ctx.beginPath();
            ctx.strokeStyle = "red";

            ctx.lineWidth = 3;
            ctx.rect(x_min + x_origin, y_origin + y_min, x_max - x_min, y_max - y_min);
            ctx.stroke();
            ctx.lineWidth = 1;

            ctx.font = "normal 15px Georgia";
            ctx.fillText(this.label[outputs[2].dataSync()[ans] - 1] + ':' + Math.round(outputs[1].dataSync()[ans] * 100) + '%', x_min + x_origin, y_max + 15 + y_origin);
            ctx.strokeText(this.label[outputs[2].dataSync()[ans] - 1] + ':' + Math.round(outputs[1].dataSync()[ans] * 100) + '%', x_min + x_origin, y_max + 15 + y_origin);
            resolve(canvas.toDataURL("image/png"))
        });
    }

    displayPrediction(outputs, image, debugFlag) {
        return new Promise((resolve, reject) => {
            let ans = -1;
            for (let i = 0; i < outputs[1].dataSync().length; i++) {
                if (outputs[1].dataSync()[i] > 0.3) {
                    ans = i;
                    break;
                }
            }
            if (ans == -1) {
                resolve(null)
            }
            this.drawCorrespondence(0, 0, outputs, ans, image)
                .then((corr_image) => resolve({
                    type: 'custom',
                    site: this.label[outputs[2].dataSync()[ans] - 1],
                    confidence: Math.round(outputs[1].dataSync()[ans] * 100),
                    corr_img: corr_image,
                    display_confidence: ''
                }));

        });
    }

    async predict(url) {


        this.model = await tf.loadGraphModel(this.graph_model_url)

        console.log('I am inside tfJS');
        let image = await this.loadImage(url);

        let t0 = performance.now();

        let tf_image = await tf.browser.fromPixels(image);
        console.log("tf_image", tf.print(tf_image));

        let tf_img = await tf_image.expandDims(0);
        console.log("tf_image shape: ", tf_img.shape);

        let t1 = performance.now();
        console.log("Image to tensor took " + (t1 - t0) + " milliseconds.");

        let backend = 'webgl';
        await tf.setBackend(backend);
        console.log('tf backend ' + backend + ' configured');

        let t01 = performance.now();
        try {
            let outputs = await this.model.executeAsync({
                'image_tensor': tf_img
            }, ['detection_boxes', 'detection_scores', 'detection_classes']);

            let t11 = performance.now();
            console.log("Prediction took " + (t11 - t01) + " milliseconds.");

            for (let i = 0; i < outputs.length; i++) {
                console.log(outputs[i].dataSync());
            }

            let pred_result = await this.displayPrediction(outputs, image);

            this.count = this.count + 1;

            // console.log(pred_result);

            if (pred_result != null) {
                return {
                    site: pred_result.site,
                    confidence: pred_result.confidence,
                    time_taken: (Math.round((t11 - t01) / 1000)),
                    image: pred_result.corr_img
                };
            } else {
                return {
                    site: 'NaN',
                    confidence: 0,
                    time_taken: Math.round((t11 - t01) / 1000),
                    image: url
                };
            }
        } catch (error) {
            let t11 = performance.now();
            console.log("Prediction took " + (t11 - t01) + " milliseconds.");
            return {
                site: 'NaN',
                confidence: 0,
                time_taken: Math.round((t11 - t01) / 1000),
                image: url
            };
        }

    }

    loadImage(imageUrl) {
        // * Loads the image by making a HTML Image Element from the obtaied B64
        return new Promise((resolve, reject) => {
            let img = new Image();
            img.crossOrigin = '';
            img.onload = () => {
                resolve(img);
            };
            img.onerror = () => {
                reject("Error: Unable to load image");
            };
            img.src = imageUrl;
        });
    }

    //----------------------------------------------------------------------------------
    //---------------------------------------functions for debug mode-------------------
    debugDrawCorrespondence(x_origin, y_origin, outputs, ans, image) {
        return new Promise((resolve, reject) => {
            var canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(image, x_origin, y_origin, image.width, image.height);
            let y_min = outputs[0].dataSync()[4 * ans] * image.height;
            let x_min = outputs[0].dataSync()[4 * ans + 1] * image.width;
            let y_max = outputs[0].dataSync()[4 * ans + 2] * image.height;
            let x_max = outputs[0].dataSync()[4 * ans + 3] * image.width;
            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "red";
            ctx.rect(x_min + x_origin, y_origin + y_min, x_max - x_min, y_max - y_min);
            ctx.stroke();
            ctx.lineWidth = 1;
            ctx.font = "normal 15px Georgia";
            ctx.fillText(this.label[outputs[2].dataSync()[ans] - 1] + ':' + Math.round(outputs[1].dataSync()[ans] * 100) + '%', x_min + x_origin, y_max + 15 + y_origin);
            ctx.strokeText(this.label[outputs[2].dataSync()[ans] - 1] + ':' + Math.round(outputs[1].dataSync()[ans] * 100) + '%', x_min + x_origin, y_max + 15 + y_origin);
            resolve(canvas.toDataURL("image/png"))
        });
    }

    debugDisplayPrediction(outputs, image) {
        return new Promise((resolve, reject) => {
            let ans = -1;
            for (let i = 0; i < outputs[1].dataSync().length; i++) {
                if (outputs[1].dataSync()[i] > 0.3) {
                    ans = i;
                    break;
                }
            }
            if (ans == -1) {
                console.log('No prediction from tfMLPrediction');
                resolve(null)
            }
            console.log(this.label[outputs[2].dataSync()[ans] - 1] + ':' + Math.round(outputs[1].dataSync()[ans] * 100) + '%');
            console.log('Debug Mode On');
            this.debugDrawCorrespondence(0, 0, outputs, ans, image)
                .then((corr_image) => resolve({
                    type: 'custom',
                    site: this.label[outputs[2].dataSync()[ans] - 1],
                    confidence: Math.round(outputs[1].dataSync()[ans] * 100),
                    corr_img: corr_image,
                    display_confidence: ': ' + Math.round(outputs[1].dataSync()[ans] * 100) + '%'
                }));

        });
    }

    async debugPredict(screenshot, page_url) {
        return new Promise((resolve, reject) => {
            console.log('I am inside tfJS');
            var t0, t1, t11, t01, tf_img, image;
            this.debugLoadImage(screenshot)
                .then(img => {
                    t0 = performance.now();
                    image = img;
                    return tf.browser.fromPixels(image);
                })
                .then(tf_image => {
                    tf.print(tf_image);
                    tf_img = tf_image.expandDims(0);
                    console.log(tf_img.shape);
                    t1 = performance.now();
                    console.log("Image to tensor took " + (t1 - t0) + " milliseconds.");
                    return tf_img;
                })
                .then((tf_img) => {
                    let backend = 'webgl';
                    console.log('tf backend ' + backend + ' configured');
                    tf.setBackend(backend);
                    t01 = performance.now();
                    return this.model.executeAsync({
                        'image_tensor': tf_img
                    }, ['detection_boxes', 'detection_scores', 'detection_classes']);
                })
                .then(outputs => {
                    t11 = performance.now();
                    console.log("Prediction took " + (t11 - t01) + " milliseconds.");
                    for (let i = 0; i < outputs.length; i++) {
                        console.log(outputs[i].dataSync());
                    }
                    return outputs;
                })
                .then((outputs) => this.debugDisplayPrediction(outputs, image))
                .then((pred_result) => {
                    this.count = this.count + 1;
                    // report result to System Logs@track-result.js
                    // if (pred_result != null) {
                    //     report.trackResult({site: pred_result.site, confidence: pred_result.confidence, time_taken: (Math.round((t11 - t01)/1000))}, pred_result.corr_image, report.getLocation(page_url));
                    // }
                    // else {
                    //     report.trackResult({site: 'NaN', confidence: 0, time_taken: Math.round((t11 - t01)/1000)}, screenshot, report.getLocation(page_url));
                    // }
                    console.log("Result: " + pred_result);
                    resolve(pred_result)
                })
                .catch(() => {
                    console.log("No Label found for this Site! :(");
                    resolve(false);
                });
        });
    }

    debugLoadImage(imageUrl) {
        // * Loads the image by making a HTML Image Element from the obtaied B64
        return new Promise((resolve, reject) => {
            let img = new Image();
            img.crossOrigin = '';
            img.onload = () => {
                resolve(img);
            };
            img.onerror = () => {
                reject("Error: Unable to load image");
            };
            img.src = imageUrl;
        });
    }

}
LogoDetection.dependencies = [
    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@2.0.0/dist/tf.min.js",
]