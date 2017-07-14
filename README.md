# Killphisher: Zero-Day Phishing Protection

We propose a new anti-phishing technique based on creating large visual
differences between legitimate sites and phishing pages which attempt to mimic
them.

Attackers can automatically create thousands of customized phishing emails,
domains and pages which, being newly minted, evade the browser's
blacklist-based phishing protection. High-value individuals and employees of
sensitive organizations are especially vulnerable to such _zero-day phishing_
attacks.

We increase the contrast in user experience between browsing a genuine page
versus an imitation page in the following manner:

  * Annotate genuine login pages with a personal image selected by the user.
  * Take periodic screenshots of the active browser tab and raise an alarm if
    it visually resembles the login page of a whitelisted site. The comparison
    is done using computer vision techniques.

Our approach can thus effectively protect against zero-day phishing, which
would not be caught by a blacklist-based system. It is implemented as a Chrome
extension.

More information [here](doc/rationale.md).

![Paypal Greenflag]

*Actual Paypal login, green flag*

<br>

![Paypal Redflag]

*Paypal Phish, red flag*

# Running This Extension

To get this running from the source code on your local machine (Chrome only):

- navigate to "chrome://extensions"
- click the checkbox next to "Developer mode" in the upper right hand corner
- click the "Load unpacked extension..." button below the "Extensions" title
- select the "killphisher" folder from your filesystem

# History

This project is inspired by the paper [The Future of Ad Blocking][foab] by
Storey et al, which introduces a novel _perceptual ad blocking_ technique. It
ignores HTML markup and blacklists and uses lightweight computer vision
techniques to "see" the page like a human and recognize features of the ad
(like the AdChoices icon) which must be present for regulatory purposes.

We observe that the same constraint holds for phishing - HTML markup may be
obfuscated, blacklists may be thwarted, but at the end of the day, the rendered
phishing page must look, in human eyes, very similar to the page it imitates.
Thus, it can be identified by computer vision techniques.

### License:
MIT


[Paypal Greenflag]: doc/img/paypal-greenflag.gif
[Paypal Redflag]: doc/img/paypal-redflag.gif
[foab]: https://arxiv.org/abs/1705.08568
