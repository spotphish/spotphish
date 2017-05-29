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

// ...
//KILLPHISHER: Unused, hence commmented for now.
/**
 * Loads shader files from (relative) URIs.
 */
/*const gl_LoadShaders
  = () => {
  return Promise.all([
  fetch('tm.vs'),
  fetch('tm.fs')
  ])
  .then(responses => {
  return Promise.all(responses.map(res => res.text()));
  });
  };
  */
/**
 * Loads inlined shaders.
 */
const gl_LoadShaders2 = () => {
    return Promise.resolve([
        `
            const vec2 scale = vec2(0.5, 0.5);

            attribute   vec2 a_position;
            varying     vec2 v_texCoord;

            void main()
            {
                gl_Position = vec4(a_position, 0, 1);
                v_texCoord  = a_position * scale + scale;
            }
            `,
        `
            precision mediump float;

            varying vec2        v_texCoord;

            uniform sampler2D   u_image0;   // original
            uniform sampler2D   u_image1;   // template

            uniform vec2        u_ires0;
            uniform vec2        u_ires1;

            void main()
            {
                float sumR = 0.0;
                float sumG = 0.0;
                float sumB = 0.0;

                // the 'sliding window' (= template image) is 32x32.
                for (int i = 0; i <= 32; i++)
                {
                    for (int j = 0; j <= 32; j++)
                    {
                        // calculate the amount in pixels to step in x and y for the original and template images.
                        vec2 d0 = vec2(float(i), float(j)) * u_ires0;
                        vec2 d1 = vec2(float(i), float(j)) * u_ires1;

                        // retrieve the corresponding texels from the images.
                        vec4 I = texture2D(u_image0, v_texCoord + d0);
                        vec4 T = texture2D(u_image1, d1);

                        // calculate the SQDIFF metric.

                        float diffR = T.r - I.r;
                        float diffG = T.g - I.g;
                        float diffB = T.b - I.b;

                        sumR += diffR * diffR;
                        sumG += diffG * diffG;
                        sumB += diffB * diffB;
                    }
                }

                // set the (normalized) sum in the result matrix.
                gl_FragColor = vec4(sumR / float(255), sumG / float(255), sumB / float(255), 1);
            }
            `
    ]);
};

const gl_CreateShader = (gl, type, source) => {
    let shader = gl.createShader(type);

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    return shader;
};

const gl_CreateTexture = (gl, image) => {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.bindTexture(gl.TEXTURE_2D, null);

    return texture;
};

// ...
// console.log("check how many time this load");
var matchFound = false;
const matchTemplate = (screenShot, template) => {
    return new Promise((resolve) => {
        console.log("Is match found : " + matchFound);
        let t0 = performance.now();
        let canvasElement = document.createElement('canvas');
        let p = Promise.all([loadImage(screenShot, canvasElement), loadImage(template.logo)]);

        Promise.all([gl_LoadShaders2(), p]).then((results) => {

            let shaders = results[0];
            let images = results[1];

            let gl = canvasElement.getContext('webgl');

            let glWidth = gl.canvas.width;
            let glHeight = gl.canvas.height;

            // ...
            // Initialization: Shaders.

            let vs = gl_CreateShader(gl, gl.VERTEX_SHADER, shaders[0]);
            let fs = gl_CreateShader(gl, gl.FRAGMENT_SHADER, shaders[1]);

            let program = gl.createProgram();

            gl.attachShader(program, vs);
            gl.attachShader(program, fs);

            gl.linkProgram(program);
            gl.useProgram(program);

            // set the (inverse) size of the original and template images in the fragment shader.
            gl.uniform2f(gl.getUniformLocation(program, 'u_ires0'), 1.0 / images[0].width, 1.0 / images[0].height);
            gl.uniform2f(gl.getUniformLocation(program, 'u_ires1'), 1.0 / images[1].width, 1.0 / images[1].height);

            // ...
            // Initialization: Buffers.

            let positionAttribute = gl.getAttribLocation(program, 'a_position');
            let positionBuffer = gl.createBuffer();

            // create a buffer with vertices for a quad which occupies the entire canvas.
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([-1.0, -1.0,
                    1.0, -1.0, -1.0, 1.0, -1.0, 1.0,
                    1.0, -1.0,
                    1.0, 1.0
                ]),
                gl.STATIC_DRAW
            )

            // ...
            // Initialization: Textures.

            let textures = [];
            textures.push(gl_CreateTexture(gl, images[0]));
            textures.push(gl_CreateTexture(gl, images[1]));

            // ...
            // Rendering.

            gl.enableVertexAttribArray(positionAttribute);
            gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0);

            gl.uniform1i(gl.getUniformLocation(program, 'u_image0'), 0);
            gl.uniform1i(gl.getUniformLocation(program, 'u_image1'), 1);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, textures[0]);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, textures[1]);

            let t0 = performance.now();

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            // read the contents of the framebuffer (which will contain the result matrix).
            var pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
            gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            // ...
            // set the threshold for matching templates. A lower value for 'thresholdPercentage' produces more exact matches.
            //
            // Note: As an original image may contain multiple matches, 'thresholdPercentage' should not be set to 0 but rather
            // a value that allows for some variation between matches.
            let thresholdPercentage = 0.02;
            let threshold = thresholdPercentage * 255;
            let positions = [];

            // process the result matrix and find the minimum values (<= the set threshold) in the 'pixels' array.
            for (let y = 0; y < glHeight; y++) {
                let idx = y * glWidth;

                for (let x = 0; x < glWidth; x++) {
                    let p = (idx + x) * 4; // each pixel is 4 bytes (RGBA).
                    let sadR = pixels[p];
                    let sadG = pixels[p + 1];
                    let sadB = pixels[p + 2];

                    if (sadR <= threshold && sadG <= threshold && sadB <= threshold) {
                        let SAD = [sadR, sadG, sadB];

                        positions.push({
                            x: x,
                            y: y,
                            SAD: SAD
                        });
                    }
                }
            }

            // sort the position objects in ascending order (by the SAD metric).
            positions.sort((obj1, obj2) => {
                let d1 = obj1.SAD[0] < obj2.SAD[0];
                let d2 = obj1.SAD[1] < obj2.SAD[1];
                let d3 = obj1.SAD[2] < obj2.SAD[2];

                if (d1 && d2 && d3)
                    return -1;

                if (!d1 && !d2 && !d3)
                    return 1;

                return 0;
            });

            // 'prune' the sorted position objects to retrieve the correct (and distinct) positions.
            // Due to the set threshold, we may get matches that differ very slightly in x and y but do represent
            // the same match. We remove these 'extra' matches from our result set.
            let prunedPositions = [];
            let i = 0;
            for (let pos of positions) {
                if (!prunedPositions.length) {
                    prunedPositions.push(pos);
                } else {
                    let passed = prunedPositions.every((p, i) => {
                        if (
                            Math.abs(pos.x - p.x) <= 3 &&
                            Math.abs(pos.y - p.y) <= 3
                        ) {
                            return false;
                        }

                        return true;
                    });

                    if (!passed) {
                        continue;
                    } else {
                        prunedPositions.push(pos);
                        i++;
                    }
                }
            }
            console.log("Match result", prunedPositions.length);
            if (prunedPositions.length > 0) {
                // console.log("Inside match check");
                resolve(template.site);
            }
            //cb();
            //console.log()
            //let t1 = performance.now();
            //let time = t1 - t0;

            // ...
            // render the template matches.

            /*let canvasRendered      = document.getElementById('rendered');
              canvasRendered.width    = glWidth;
              canvasRendered.height   = glHeight;

              let ctx = canvasRendered.getContext('2d');
              ctx.drawImage(images[0], 0, 0, images[0].width, images[0].height);

              for (let pos of prunedPositions)
              {
              let posX = pos.x;
              let posY = pos.y;

              ctx.rect(posX, posY, images[1].width, images[1].height);
              ctx.strokeStyle = 'red';
              ctx.stroke();

              $('#pos_and_time').append(`<p>Matched: (${posX}, ${posY})</p>`);
              }

              let canvasTemplate      = document.getElementById('template');
              canvasTemplate.width    = images[1].width;
              canvasTemplate.height   = images[1].height;

              ctx = canvasTemplate.getContext('2d');
              ctx.drawImage(images[1], 0, 0, images[1].width, images[1].height);

              $('#pos_and_time').append(`Time: ${time.toFixed(2)} ms`);*/
        });
    })
}

var filename = () => {
    var pad = (n) => ((n = n + '') && (n.length >= 2 ? n : '0' + n))
    var timestamp = ((now) => [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join('-') + ' - ' + [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-'))(new Date())
    return 'Screenshot Capture - ' + timestamp + '.png'
}
var save = (image) => {
    var link = document.createElement('a')
    link.download = filename()
    link.href = image
    console.log("Image link", link);
    link.click();
}

var ts0;
chrome.runtime.onMessage.addListener((req, sender, res) => {
    if (req.message === 'capture') {
        ts0 = performance.now();
        console.log("Recieved message at T : " + ts0);
        chrome.tabs.getSelected(null, (tab) => {
            chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (image) => {
                // image is base64

                var matches = [];
                var normalizedImage;
                //TODO:Resolve/reject promise if no match happens
                crop(image, req.area, req.dpr, false, (cropped) => {
                    normalizedImage = cropped;
                    var ts1 = performance.now();
                    console.log("Time taken for snapshot : " + (ts1 - ts0) + " ms");

                    whiteList.forEach(function (value) {
                        matches.push(matchTemplate(normalizedImage, value))
                    });

                   // for (i = 0; i < whiteList.length; i++) {
                   //      // console.log(whiteList[i], normalizedImage);
                   //      matches[i] = matchTemplate(normalizedImage, whiteList[i]);
                   //  }

                    Promise.race(matches).then((site) => {
                        // console.log("After promise");
                        matchFound = true;
                        res({ template_match: "Match found", site: site });
                    })
                })

            })
        })
    } else if (req.message === 'active') {
        if (req.active) {
            chrome.storage.sync.get((config) => {
                if (config.method === 'view') {
                    chrome.browserAction.setTitle({ tabId: sender.tab.id, title: 'Capture Viewport' })
                    chrome.browserAction.setBadgeText({ tabId: sender.tab.id, text: '⬒' })
                }
                // else if (config.method === 'full') {
                //   chrome.browserAction.setTitle({tabId: sender.tab.id, title: 'Capture Document'})
                //   chrome.browserAction.setBadgeText({tabId: sender.tab.id, text: '⬛'})
                // }
                else if (config.method === 'crop') {
                    chrome.browserAction.setTitle({ tabId: sender.tab.id, title: 'Crop and Save' })
                    chrome.browserAction.setBadgeText({ tabId: sender.tab.id, text: '◩' })
                } else if (config.method === 'wait') {
                    chrome.browserAction.setTitle({ tabId: sender.tab.id, title: 'Crop and Wait' })
                    chrome.browserAction.setBadgeText({ tabId: sender.tab.id, text: '◪' })
                }
            })
        } else {
            chrome.browserAction.setTitle({ tabId: sender.tab.id, title: 'Screenshot Capture' })
            chrome.browserAction.setBadgeText({ tabId: sender.tab.id, text: '' })
        }
    }
    return true
})

function crop(image, area, dpr, preserve, done) {
    var top = area.y * dpr
    var left = area.x * dpr
    var width = area.w * dpr
    var height = area.h * dpr
    var w = (dpr !== 1 && preserve) ? width : area.w
    var h = (dpr !== 1 && preserve) ? height : area.h

    if (dpr === 1) {
        done(image);
        return;
    }

    var canvas = null
    if (!canvas) {
        canvas = document.createElement('canvas')
        document.body.appendChild(canvas)
    }
    canvas.width = w
    canvas.height = h

    var img = new Image()
    img.onload = () => {
        var context = canvas.getContext('2d')
        context.drawImage(img,
            left, top,
            width, height,
            0, 0,
            w, h
        )

        var cropped = canvas.toDataURL('image/png')
        done(cropped)
    }
    img.src = image
}
