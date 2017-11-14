# SpotPhish: Zero-Day Phishing Protection

A browser extension for Chrome and Firefox which provides zero-day phishing protection.

## Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Usage](#usage)
    - [Choose a security image](#choose-a-security-image)
    - [Protecting a page](#protecting-a-page)
    - [Unprotecting a page](#unprotecting-a-page)
    - [Safe Domains](#safe-domains)
- [Troubleshooting](#troubleshooting)
- [History](#history)
- [Credits](#credits)
- [License](#license)

## Introduction

SpotPhish is a Chrome extension, which provides zero-day phishing protection
by creating large visual differences between legitimate sites and phishing
pages which attempt to mimic them.

Attackers can automatically create thousands of customized phishing emails,
domains and pages which, being newly minted, cannot be caught by the
blacklist-based methods present on most browsers. High-value individuals and
employees of sensitive organizations are especially vulnerable to such
_zero-day phishing_ attacks.

The extension increases the contrast in user experience between browsing a genuine
page versus an imitation page in the following manner:

  * Visiting a genuine page triggers a popup with a personal security image,
    which is displayed for a few seconds.
  * Screenshots of the active browser tab are taken and compared with
    "mugshots" of protected pages. The user is alerted if the current
    page visually resembles a protected page, but belongs to an unknown
    domain.

Screenshots are processed locally in the browser and discarded immediately;
they are not stored or sent to an external site.  More information and
technical details [here](doc/rationale.md).

![Paypal Greenflag]

*Real Paypal login page*

<br>

![Paypal Redflag]

*Paypal phishing page*

## Installation

To get this running from the source code on your local machine:

- Clone this git repository
- Navigate to "chrome://extensions".
- Click the checkbox next to "Developer mode" in the upper right hand corner.
- Click the "Load unpacked extension..." button below the "Extensions" title.
- Select the "spotphish" folder from your filesystem
- Existing pages will not be affected; reload for protection

## Usage

Once the plugin is installed, try visiting the following links:

- [Paypal real login page](https://www.paypal.com/signin): You should see a
  popup with a security image, which will fade in a few seconds. This is an
  indication that the page is a protected page and its URL has been verified.

- [Paypal phishing sample](http://www.phishtank.com/phish_detail.php?phish_id=5123590)
  (Don't worry, it's harmless): This page contains a screenshot of a Paypal phishing page
  and will trigger an alert warning about possible phishing.

To customize the behaviour of the plugin, click the icon at the right of the address bar
and select *Settings*.

### Choose a security image

Your security image is flashed in a popup whenever you visit a protected page.
It is an indication that the page URL has been verified and it is safe to enter
your credentials. This image is common across _all_ protected pages.

Some points to keep in mind while choosing a security image:

- An image with personal and emotional significance works better than generic
  defaults.
- Choose an image you would _miss_ if it didn't show up. Pictures or animated gifs of pets,
  loved ones, favorite movie clips are good choices.
- Pick an image which is not publicly associated with you, like your profile pictures or photos
  shared on social media.

To upload an image, or to change the selected image, visit _Settings &rarr; Security Image_.

### Protecting a page

Protected pages are webpages being monitored by the plugin, as they are potential
targets for phishing attempts. Protection comes in two flavours:

  * **Basic:** Your security image is flashed in a popup whenever you visit a
    protected page. This means the page URL has been verified to be genuine and you
    can safely enter your creds.

  * **Enhanced:** The extension has a "mugshot" of the protected page - a
    distinctive snippet by which most people would identify the page. In
    addition to flashing the security image when the original page is visited,
    the extension monitors all browsing activity, taking periodic snapshots of the
    active tab. It raises an alarm if the mugshot is present anywhere the
    snapshot of the current page, and the current page does not belong to a
    known, safe domain.

Basic mode has negligible overhead and can be turned on for any number of pages.
The image comparison in enhanced mode is done using computer vision techniques,
and adds some CPU overhead. Therefore, we optimize it to run only under certain
conditions: if the page contains a visible password field and is not part of a
[safe domain](#safe-domains). The domain of a protected page is automatically
enrolled as a [safe domain](#safe-domains), i.e. one which is highly unlikely
to host phishing pages.

Login pages of popular and heavily-phished sites like Google, Facebook, Amazon
and Paypal are protected out of the box. To protect any other login page, say
of your bank, visit the page containing the login dialog, click on the
SpotPhish icon to the right of the address bar and select _Protect Page_.

If you want enhanced protection, you will be prompted to select the "mugshot"
of the page. Select the area which distictly identifies the brand and function
of the page from other such pages - the logo, or login dialog are good choices.

You can manage protected pages from the _Settings_ page of the plugin.

### Unprotecting a page

To remove protection from a page, visit _Settings &rarr; Protected Pages_ and
disable or remove the desired page.

### Safe Domains

A safe domain is one which is well managed, secure and highly unlikely to host
phishing pages. These include Google, Facebook, Amazon and every domain for
which we have added a protected page. We skip enhanced mode checking for these
pages and reduce the CPU overhead. You can add and remove other domains to this
list by visiting _Settings &rarr; Safe Domains_.

Domains which have been added because they host a protected page cannot be
removed from this tab.

## Troubleshooting

  1. **I'm getting a lot of false alarms on this site!**  
If you trust the site, consider adding it to [Safe Domains](#safe-domains).

  1. **No, really, why does it think this page looks like Amazon?**  
Look at the _correspondence image_ shown in the red warning dialog - the
mugshot of the protected page and the current page side by side, with green
lines connecting the corresponding features. You can view a larger version of
this image by right-clicking and selecting the browser's _Open Image in New
Tab_.  The current image matching strategy is very much a work in progress; it
might consider two pages alike which look very different to the human eye.

  1. **This page looks like a protected page, but I didn't get warned!**  
If a mugshot of the protected page exists (_enhanced_ mode), it might still
fail to trigger a warning due to limitations of the image matching code.
The less a fake page resembles the original protected page, the
less likely it will trigger a warning. You will not get a warning in the
following cases:
    * The page had only _basic_ protection - no mugshot.`
    * The current page is part of a _safe domain_.
    * The current page does not contain a password field.

## History

This project is inspired by the paper [The Future of Ad Blocking][foab] by
Storey et al, which introduces a novel _perceptual ad blocking_ technique. It
ignores HTML markup and blacklists and uses lightweight computer vision
techniques to "see" the page like a human and recognize features of the ad
(like the AdChoices icon) which must be present for regulatory purposes.

We observe that the same constraint holds for phishing - HTML markup may be
obfuscated, blacklists may be thwarted, but at the end of the day, the rendered
phishing page must look, in human eyes, very similar to the page it imitates.
Thus, it can be identified by computer vision techniques.

## Credits

Components used and their licenses

|Component  |License    | 
| --------- | --------- |
| [JSFeat](https://github.com/inspirit/jsfeat) | MIT | 
| [JCrop](https://github.com/tapmodo/Jcrop) | MIT |
| [Screenshot Capture](https://github.com/simov/screenshot-capture) | MIT |
| [Material Design Lite](https://github.com/google/material-design-lite) | Apache 2 |
| [IDBWrapper](https://github.com/jensarps/IDBWrapper) | MIT |
| [JQuery](https://jquery.com) | MIT |
| [Ad Blocking](https://github.com/citp/ad-blocking) | MIT |

## License

MIT

## Contact

Email us at <dev@spotphish.com> or follow [@spotphish](https://twitter.com/spotphish).

[Paypal Greenflag]: doc/img/paypal-greenflag.gif
[Paypal Redflag]: doc/img/paypal-redflag.gif
[foab]: https://arxiv.org/abs/1705.08568
