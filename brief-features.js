
const loadImage = (imageUrl, canvasElement) => {
    return new Promise((resolve) => {
        let image = new Image();
        image.onload = () => {
            if (canvasElement) {
                canvasElement.width = image.width;
                canvasElement.height = image.height;
            }

            resolve(image);
        };

        image.src = imageUrl;
    });
};

var promiseTimeout = 5000; //in ms
const matchBriefFeatures = (screenShot, template) => {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            reject("No match found");
        }, promiseTimeout);
        let p = Promise.all([loadImage(screenShot), loadImage(template.logo)]);
        Promise.all([p]).then((results) => {
            var image1 = results[0][1];
            var image2 = results[0][0];
            var canvas = document.createElement('canvas');
            canvas.width = image1.width + image2.width + 200;
            canvas.height = image1.height + image2.height + 200;
            var context = canvas.getContext('2d');


            let descriptorLength = 256;
            let matchesShown = 10;
            let blurRadius = 3;

            var isMatch = function(matches) {
                var confCount = 0;
                for (var i = 0; i < 10; i++) {
                    console.log(matches[i]);
                    if (matches[i].confidence > 0.9)
                        confCount++;
                }

                if (confCount >= 8)
                    return true;
                else
                    return false;
            }

            tracking.Brief.N = descriptorLength;
            console.log(image1.width);
            console.log(image2.width);
            context.drawImage(image1, 0, 0, image1.width, image1.height);
            context.drawImage(image2, 200, 0, image2.width, image2.height);

            var imageData1 = context.getImageData(0, 0, image1.width, image1.height);
            var imageData2 = context.getImageData(200, 0, image2.width, image2.height);

            var gray1 = tracking.Image.grayscale(tracking.Image.blur(imageData1.data, image1.width, image1.height, blurRadius), image1.width, image1.height);
            var gray2 = tracking.Image.grayscale(tracking.Image.blur(imageData2.data, image2.width, image2.height, blurRadius), image2.width, image2.height);

            var corners1 = tracking.Fast.findCorners(gray1, image1.width, image1.height);
            var corners2 = tracking.Fast.findCorners(gray2, image2.width, image2.height);

            var descriptors1 = tracking.Brief.getDescriptors(gray1, image1.width, corners1);
            var descriptors2 = tracking.Brief.getDescriptors(gray2, image2.width, corners2);

            var matches = tracking.Brief.reciprocalMatch(corners1, descriptors1, corners2, descriptors2);

            matches.sort(function(a, b) {
                return b.confidence - a.confidence;
            });
            if (isMatch(matches))
                resolve(template.site);
        });
    })
}
