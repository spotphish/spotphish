
var filename = () => {
    var pad = (n) => ((n = n + "") && (n.length >= 2 ? n : "0" + n));
    var timestamp = ((now) => [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join("-") + " - " + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join("-"))(new Date());
    return "Screenshot Capture - " + timestamp + ".png";
};

var save = (image) => {
    var link = document.createElement("a");
    link.download = filename();
    link.href = image;
    console.log("Image link", link);
    link.click();
};

function crop(image, area, dpr, crop, done) {
    console.log(dpr);
    var browser = typeof(InstallTrigger) !== "undefined" ? "firefox" : "chrome";
    dpr = browser === "firefox" ? 1 : dpr;
    var top = area.y * dpr;
    var left = area.x * dpr;
    var width = area.w * dpr;
    var height = area.h * dpr;
    var w = area.w;
    var h = area.h;
    if (dpr === 1 && !crop) {
        done(image);
        return;
    }

    var canvas = null;
    if (!canvas) {
        canvas = document.createElement("canvas");
        document.body.appendChild(canvas);
    }

    canvas.width = w;
    canvas.height = h;

    var img = new Image();
    img.onload = () => {
        var context = canvas.getContext("2d");
        context.drawImage(img,
            left, top,
            width, height,
            0, 0,
            w, h
        );

        var cropped = canvas.toDataURL("image/png");
        done(cropped);
    };
    img.src = image;
}
