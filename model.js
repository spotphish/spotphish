let Sites = {

    safe: [], /* flattened list of strings, all enabled safe domains */
    templates: [],
    sites: [], /* all sites, merged with user-defined changes */

    /* db */
    dbDefaultSites: null,
    dbCustomSites: null,
    dbTemplateList: null,
    dbFeedList: null,

    /* db caches, used to compute updates */
    defaultSites: [], 
    customSites: [],
    feedList: [],
    templateList: [],


    /*
     * Get site corresponding to url or domain name, filtered by one of three criteria:
     * "enabled" (default), "exists" (enabled/disabled but not deleted), "all"
     *
     * Returns site object or undefined.
     */

    getSite: function(url, filter="enabled") {
        const host = url.includes("://") ? getPathInfo(url).host : url,
            ff = (filter === "enabled") ? x => !x.deleted && !x.disabled :
                (filter === "exists") ? x => !x.deleted : x => true;
        const found = this.sites.filter(ff)
            .filter(s => _.find(s.domains, y => host.endsWith(y)));
        return found[0];
    }, 

    getSiteByName: function(name, filter="enabled") {
        const ff = (filter === "enabled") ? x => !x.deleted && !x.disabled :
                (filter === "exists") ? x => !x.deleted : x => true;
        return _.find(this.sites.filter(ff), x => x.name === name);
    }, 

    getProtectedURL: function(url, filter="enabled") {
        const url1 = stripQueryParams(url),
            ff = (filter === "enabled") ? x => !x.deleted && !x.disabled && x.url === url1:
                (filter === "exists") ? x => !x.deleted && x.url === url1: x => x.url === url1;
        const site = this.getSite(url1);
        if (site) {
            const found = _.find(site.protected, ff),
                u = found ? Object.assign(_.cloneDeep(found), {site: site.name}) : null;
            return u;
        }
        return null;
    },

    getSafeDomain: function(url) {
        const host = url.includes("://") ? getPathInfo(url).host : url;
        return _.find(this.safe, x => host.endsWith(x));
    },

    getSites: function(filter="enabled") {
        const ff = (filter === "enabled") ? x => !x.deleted && !x.disabled :
                (filter === "exists") ? x => !x.deleted : x => true;
        return this.sites.filter(ff);
    }, 

    getTemplates: function() {
        return this.templates;
    }, 

    addSafeDomain: function(domain) {
        const p = psl.parse(domain);
        if (!p.domain) {
            return Promise.reject(new Error(`Invalid domain ${domain}`));
        }
        const exists = !!this.getSafeDomain(domain);
        if (exists) {
            return Promise.reject(new Error(`Domain already marked safe: ${domain}`));
        }
        const site = this.getSite(domain, "all");
        let out = {
            name: site ? site.name : _.capitalize(p.sld),
            src: site ? site.src : "user_defined", safe:
            [{domain}]
        };
        const cur = _.cloneDeep(this.customSites.find(s => s.name === out.name)) || {};
        if (site && site.deleted) {
            out.deleted = false;
        }
        out = mergeSite(out, cur);
        return this.dbCustomSites.put(out)
            .then(x => this.sync());
    },

    removeSafeDomain: function(domain) {
        const site = _.find(this.customSites, s => s.safe && _.find(s.safe, x => x.domain === domain));
        if (!site) {
            return Promise.reject(new Error(`Safe domain not found: ${domain}`));
        }
        const data = _.cloneDeep(site);
        data.safe = site.safe.filter(x => x.domain !== domain);
        return this.dbCustomSites.put(data)
            .then(x => this.sync());
    },

    addProtectedURL: function(url, logo) {
        const url1 = stripQueryParams(url),
            site = this.getSite(url1, "exists"),
            host = getPathInfo(url).host;
        let data;

        if (!site) {
            const p = psl.parse(host);
            if (!p.sld) {
                return Promise.reject(new Error(`Invalid hostname ${host}`));
            }
            data = {name: _.capitalize(p.sld), src: "user_defined"};
        } else {
            /* Site exists, may be disabled */
            data = {name: site.name, src: site.src, disabled: false};
        }

        data.protected = [{url: url1, disabled: false, deleted: false}];

        let res = Promise.resolve(true);
        const cur = _.find(this.customSites, x => x.name === data.name) || {};

        if (logo) {
            let pattern;
            res = res.then(x => createPatterns(logo))
                .then(result => {
                    pattern = {
                        base64: logo,
                        patternCorners: result.patternCorners,
                        patternDescriptors: result.patternDescriptors,
                        site: data.name,
                        page: url1,
                        checksum: CryptoJS.SHA256(logo).toString()
                    };
                    return this.dbTemplateList.put(pattern);
                }).then(x => {
                    data.templates = [{page: url1, checksum: pattern.checksum}];
                    const out = mergeSite(data, cur);
                    return this.dbCustomSites.put(out);
                });
        } else {
            const out = mergeSite(data, cur);
            res = res.then(x => this.dbCustomSites.put(out));
        }

        res = res.then(x => this.sync());
        return res;
    },

    removeProtectedURL: function(url) {
        const url1 = stripQueryParams(url),
            site = this.getSite(url1);

        if (!site) {
            return Promise.reject(new Error(`Site not found for URL ${url1}`));
        }
        if (!_.find(site.protected, x => x.url === url1)) {
            return Promise.reject(new Error(`Protected URL not found: ${url1}`));
        }
        const csite = _.cloneDeep(_.find(this.customSites, x => x.url === url1)) ||
                {name: site.name, src: site.src};

        csite.protected = csite.protected || [];
        csite.templates = csite.templates || [];

        if (_.find(csite.protected, x => x.url === url1)) {
            csite.protected = csite.protected.filter(x => x.url !== url1);
        } else {
            csite.protected = [{url: url1, deleted: true}];
        }
        
        if (_.find(csite.templates, x => x.page && x.page === url1)) {
            csite.templates = csite.templates.filter(x => !(x.page && x.page === url1));
        } else {
            const t = _.cloneDeep(_.find(site.templates, x => x.page && x.page === url1));
            if (t) {
                t.deleted = true;
                csite.templates = [t];
            }
        }
        return this.dbCustomSites.put(csite)
            .then(x => this.sync());
    },

    removeSite: function(name) {
        const site = this.getSiteByName(name, "exists");
        if (!site) {
            return Promise.reject(new Error(`Site does not exist: ${name}`));
        }
        let res = (site.src === "user_defined") ? this.dbCustomSites.remove(name) :
            this.dbCustomSites.put({name, src: site.src, deleted: true});
        return res.then(x => this.sync());
    },

    toggleSite: function(name, enable) {
        const site = this.getSiteByName(name, "exists");
        if (!site) {
            return Promise.reject(new Error(`Site does not exist: ${name}`));
        }
        const cur = _.find(this.customSites, x => x.name === site.name);
        let out = cur ? _.cloneDeep(cur) : {name: site.name, src: site.src};
        out.disabled = !enable;
        return this.dbCustomSites.put(out)
            .then(x => this.sync());
    },

    toggleURL: function(url, enable) {
        const site = this.getSite(url),
            url1 = _.cloneDeep(this.getProtectedURL(url, "exists")),
            templates = site.templates.filter(x => !x.deleted && x.page && x.page === url);

        if (!site || !url1) {
            return Promise.reject(new Error(`URL does not exist: ${url}`));
        }
        const cur = _.find(this.customSites, x => x.name === site.name);
        let out = cur ? _.cloneDeep(cur) : {name: site.name, src: site.src};
        url1.disabled = !enable;
        out.protected = [url1];
        if (templates.length) {
            out.templates = templates.map(x => _.cloneDeep(x))
                .map(x => (x.disabled = !enable, x));
        }
        if (cur) {
            out = mergeSite(out, cur);
        }
        return this.dbCustomSites.put(out)
            .then(x => this.sync());
    },

    sync: function() {
        let defaultSites, customSites;

        return this.dbDefaultSites.getAll()
            .then(x => defaultSites = x)
            .then(x => this.dbCustomSites.getAll())
            .then(x => customSites = x)
            .then(syncSites.bind(this))
            .then(syncTemplates.bind(this))
            .then(x => (debug("SYNC!", this.sites, this.safe, this.templates), debug("SYNC2", this.defaultSites, this.customSites, this.templateList)));

        function prep(site) {
            site.protected = site.protected || [];
            site.templates = site.templates || [];
            site.safe = site.safe || [];
            site.safe = _.uniq(site.safe.concat(site.protected.filter(x => !x.deleted && !x.disabled)
                .map(p => ({domain: getPathInfo(p.url).host}))));
            site.domains = _.uniq(site.safe.map(s => s.domain)
                .concat(site.protected.filter(x => !x.deleted).map(p => getPathInfo(p.url).host)));
            return site;
        }

        function syncSites() {
            let sites = _.cloneDeep(defaultSites);
            sites = sites.map(prep);
            customSites.forEach(cs => {
                const i = defaultSites.findIndex(s => s.name === cs.name);
                if (i === -1) {
                    assert("syncSites.1", cs.src === "user_defined");
                    sites.push(prep(_.cloneDeep(cs)));
                } else {
                    sites[i] = prep(mergeSite(cs, defaultSites[i]));
                }
            });
            this.defaultSites = defaultSites;
            this.customSites = customSites;
            this.sites = sites.filter(s => !!s.protected.length);
            this.safe = _.uniq(sites.filter(s => !s.deleted && !s.disabled)
                .map(s => s.safe.map(x => x.domain))
                .reduce((a,b) => a.concat(b),[]));
        }

        function syncTemplates() {

            /* Garbage collect deleted templates */

            /* flattened list of all templates, annotated by site name */
            const templates = this.sites.filter(x => !x.deleted && x.templates)
                .map(y => y.templates.map(z => (z.site = y.name, z)))
                .reduce((a,b) => a.concat(b),[]);

            const checksums = templates.filter(x => !x.deleted).map(y => y.checksum);
            const garbageTemplates = this.templateList.filter(x => checksums.indexOf(x.checksum) === -1)
                .map(y => y.checksum);
            let res = Promise.resolve(true);
            if (garbageTemplates.length) {
                res = res.then(x => this.dbTemplateList.removeBatch(garbageTemplates));
            }

            /* Compute patterns for new templates */
            const newTemplates = templates.filter(x => !x.deleted &&
                this.templateList.findIndex(y => y.checksum === x.checksum) === -1);

            if (newTemplates) {
                const np = newTemplates.filter(t => !!t.image)
                    .map(x => createPatterns(x.image)
                        .then(result => {
                            x.base64 = result.base64;
                            x.patternCorners = result.patternCorners;
                            x.patternDescriptors = result.patternDescriptors;
                            return x;
                        }).then(x => this.dbTemplateList.put(x))
                        .catch(x => (console.log(x), null)));
                
                res = res.then(x => Promise.all(np));
            }

            /* Sync */
            res = res.then(x => this.dbTemplateList.getAll())
                .then(x => {
                    this.templateList = x;
                    const templates = this.sites.filter(x => !x.deleted && !x.disabled &&
                        x.templates)
                        .map(y => y.templates)
                        .reduce((a,b) => a.concat(b),[]);

                    const checksums = templates.filter(x => !x.deleted && !x.disabed)
                        .map(y => y.checksum);
                    this.templates = this.templateList.filter(y => checksums.indexOf(y.checksum) !== -1);
                });

            return res;
        }
    },

    init: function() {
        this.dbDefaultSites = new Pdb({storeName: "default_sites", keyPath: "name"});
        this.dbCustomSites = new Pdb({storeName: "custom_sites", keyPath: "name"});
        this.dbTemplateList = new Pdb({storeName: "template_list", keyPath: "checksum"});

        return Promise.all([this.dbDefaultSites.ready(), this.dbCustomSites.ready(),
            this.dbTemplateList.ready()])
            .then(x => this.sync());
    },

    reset: function() {
        return this.dbCustomSites.clear()
            .then(x => this.sync());
    }
};

function mergeSite(update, old) {
    const unionProperty = {
        templates : "checksum",
        safe: "domain",
        protected: "url"
    };
    update = _.cloneDeep(update);
    old = _.cloneDeep(old);
    if (update.deleted) {
        return update;
    }
    let result = _.cloneDeep(update);
    for (const key in old) {
        if (unionProperty[key]) {
            if (update[key] === undefined) {
                result[key] = old[key];
            } else {
                //result[key] = _.unionBy(new_data[key], old[key], unionProperty[key]);
                result[key] = _.values(_.merge(
                    _.keyBy(old[key], unionProperty[key]),
                    _.keyBy(update[key], unionProperty[key])
                ));
            }
        } else {
            if (update[key] === undefined) {
                result[key] = old[key];
            }
        }
    }
    return result;
}

/*

Sample Feed:
{
  "name": "default-feed",
  "url": "https://deepak-shinde.github.io/feeds/main/main.json",
  "schema": "1.0",
  "version": "20171010163094",
  "sites": [
    {
      "name": "Google",
      "src": "https://deepak-shinde.github.io/feeds/main/main.json",
      "protected": [
        {
          "url": "https://accounts.google.com/signin/v2/identifier",
          "disabled": true
        },
        {
          "url": "https://accounts.google.com/signin/oauth/identifier"
        },
        {
          "url": "https://accounts.google.com/signin/v2/sl/pwd",
          "deleted": true
        }
      ],
      "templates": [
        {
          "name": "Google 2015",
          "image": "https://deepak-shinde.github.io/feeds/main/images/google-really-old.png",
          "checksum": "fae2d41d1d199d57ee6515953a143596572f425cb8217cd4912165d535686a9e",
          "deleted": true
        },
        {
          "name": "Google 2016",
          "image": "https://deepak-shinde.github.io/feeds/main/images/google-old.png",
          "checksum": "eae2d41d1d199d57ee6515953a143596572f425cb8217cd4912165d535686a9d",
          "disabled": true
        },
        {
          "name": "Google mid 2017",
          "image": "https://deepak-shinde.github.io/feeds/main/images/google-logo.png",
          "checksum": "9e1328a484065a4b5e37e78318ced3d284c989a3f8dbfa898a33aad8ce083765"
        }
      ],
      "safe": [
        {
          "domain": "google.com"
        },
        {
          "domain": "google.co.in"
        }
      ]
    },
    {
      "name": "Wikipedia",
      "src": "https://deepak-shinde.github.io/feeds/main/main.json",
      "safe": [
        {
          "domain": "wikipedia.org"
        }
    }
    ...

Sample dbDefaultSites entry: same as a sites[x] from above

Sample dbTemplateList entry: 
*/
