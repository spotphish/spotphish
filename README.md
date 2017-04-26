# Killphisher

This Chrome extension is a perceptual anti-phishing tool which detects pages which look like login pages for popular services, but are hosted on a different domain.

The technique is inspired by and based on **perceptual ad-blocking**, as described in the paper ["The Future of Ad Blocking: An Analytical Framework and New Techniques."](http://randomwalker.info/publications/ad-blocking-framework-techniques.pdf), [the blog post on the topic](https://freedom-to-tinker.com/2017/04/14/the-future-of-ad-blocking/) and the [github repository](https://github.com/citp/ad-blocking).

# Code Overview

- *manifest.json* contains information about the overall structure of the extension as well as the title, version number, and description.
- *popup* is just a simple description of the extension that appears when the user clicks the icon in the upper right.
- *content.js* is the script that runs in iframes, searches for login dialogs and highlights the iframes if it smells phishy.
- *perceptualLibrary/container_finder.js* contains code that returns a list of containers conforming to various constraints, including width/height bounds or specific css properties but also more high-level things like whether the container is a sidebar or not.
- *perceptualLibrary/imageSearch.js* contains the perceptual code for detecting images of various kinds.
- *perceptualLibrary/check_text_and_link* contains code that searches for text and a link within a given container.
- *perceptualLibrary/adchoices_hashes.js* contains the hashes of logo icons to match.
- *perceptualLibrary/hash_encoding.js* contains the code that converts from the logo hashes (in hex) to binary.
- *perceptualLibrary/perceptual_background.js* contains the code that does the fuzzy image hashing and link destination detection.
- *locale_info.js* keeps information about the "Sponsored" text in various languages to support all Facebook locales.
- *utils.js* contains the code for covering fishy once they have been identified
- *externalCode* contains jquery 1.12.4
- *actual_icons* contains the actual logo icons for Google, Facebook etc.

# Running This Extension

To get this running from the source code on your local machine (Chrome only):

- navigate to "chrome://extensions"
- click the checkbox next to "Developer mode" in the upper right hand corner
- click the "Load unpacked extension..." button below the "Extensions" title
- select the “killphisher” folder from your filesystem

### License:
MIT
