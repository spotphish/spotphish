const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// starting server to server static file
const port = process.argv[2] || 9000;
const server = http.createServer(function (req, res) {
  console.log(`${req.method} ${req.url}`);
  // parse URL
  const parsedUrl = url.parse(req.url);
  // extract URL path
  let pathname = `.${parsedUrl.pathname}`;
  // maps file extention to MIME types
  const mimeType = {
    '.html': 'text/html'
  };
  fs.exists(pathname, function (exist) {
    if(!exist) {
      // if the file is not found, return 404
      res.statusCode = 404;
      res.end(`File ${pathname} not found!`);
      return;
    }
    // if is a directory, then look for index.html
    if (fs.statSync(pathname).isDirectory()) {
      pathname += '/createPatterns.html';
    }
    // read file from file system
    fs.readFile(pathname, function(err, data){
      if(err){
        res.statusCode = 500;
        res.end(`Error getting the file: ${err}.`);
      } else {
        // based on the URL path, extract the file extention. e.g. .js, .doc, ...
        const ext = path.parse(pathname).ext;
        // if the file is found, set Content-type and send data
        res.setHeader('Content-type', mimeType[ext] || 'text/plain' );
        res.end(data);
      }
    });
  });
})

server.listen(parseInt(port));

console.log('\x1b[32m', `Server listening on port ${port}`);

(async() => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

     page.on('console', (...args) => {
        console.log(`${args}`);
    });
     // opening create pattern page
    await page.goto(`http://localhost:${port}`);
    // get calculated data
    const data = await page.evaluate(function() {
        return redFlagSites
    });

  if (data){
    var content = "var defPatterns = " + JSON.stringify(data);
    fs.writeFile('assets/defaults/pattern.js', content);
  }
  // take screen shot
  await page.screenshot({path: 'create_pattern.png'});

  browser.close();
  console.log(`Stoped Server`);
  server.close()

  console.log('\x1b[32m', "Successfully created/updated pattens in 'assets/defaults/pattern.js' file");
})();

// TO RUN
// node create_pattern.js <port no>

