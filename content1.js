
var jcrop, selection

var overlay = ((active) => (state) => {
  active = (typeof state === 'boolean') ? state : (state === null) ? active : !active
  $('.jcrop-holder')[active ? 'show' : 'hide']()
  //chrome.runtime.sendMessage({message: 'active', active})
})(false)

var image = (done) => {
  var image = new Image()
  image.id = 'fake-image'
  image.src = chrome.runtime.getURL('/images/pixel.png')
  image.onload = () => {
    $('body').append(image)
    done()
  }
}

var init = (done) => {
    console.log("Inside init");
  $('#fake-image').Jcrop({
    bgColor: 'none',
    onSelect: (e) => {
      console.log("Jcrop fakeimg");
      selection = e
      capture()
    },
    onChange: (e) => {
      selection = e
    },
    onRelease: (e) => {
      setTimeout(() => {
        selection = null
      }, 100)
    }
  }, function ready () {
    console.log("jcrop initialized");
    jcrop = this

    $('.jcrop-hline, .jcrop-vline').css({
      backgroundImage: 'url(' + chrome.runtime.getURL('/images/Jcrop.gif') + ')'
    })

    if (selection) {
      jcrop.setSelect([
        selection.x, selection.y,
        selection.x2, selection.y2
      ])
    }

    done && done()
  })
}

var capture = (force) => {
    if (selection) {
      jcrop.release()
      setTimeout(() => {
        chrome.runtime.sendMessage({
          message: 'crop_capture', area: selection, dpr: devicePixelRatio
        }, (res) => {
          overlay(false)
          selection = null;
        console.log(res);
          //save(res.image)
        })
      }, 50)
    }
}

var filename = () => {
  var pad = (n) => ((n = n + '') && (n.length >= 2 ? n : '0' + n))
  var timestamp = ((now) =>
    [pad(now.getFullYear()), pad(now.getMonth() + 1), pad(now.getDate())].join('-')
    + ' - ' +
    [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join('-')
  )(new Date())
  return 'Screenshot Capture - ' + timestamp + '.png'
}

var save = (image) => {
  var link = document.createElement('a')
  link.download = filename()
  link.href = image
  link.click()
}

window.addEventListener('resize', ((timeout) => () => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {
    jcrop.destroy()
    init(() => overlay(null))
  }, 100)
})())

chrome.runtime.onMessage.addListener((req, sender, res) => {
  if (req.message === 'init') {
    res({}) // prevent re-injecting
    console.log("Message received");
    if (!jcrop) {
        console.log("!jcrop");
      image(() => init(() => {
          console.log("initialized jcrop : ", jcrop);
        overlay()
        capture()
      }))
    }
    else {
      overlay()
      capture(true)
    }
  }
  return true
})
