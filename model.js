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
        const found = this.filter(ff)
            .filter(s => !!_.find(s.safe, y => host.endsWith(y.domain)));
        return found[0];
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

    addSafeDomain: function(domain) {
        const p = psl.parse(domain);
        if (!p.domain) {
            throw new Error(`Invalid domain ${domain}`);
        }
        const exists = !!this.getSafeDomain(domain);
        if (exists) {
            throw new Error(`Domain already marked safe: ${domain}`);
        }
        const site = this.getSite(domain, "all");
        const cur = _.cloneDeep(this.customSites.find(s => s.name === site.name));
        let out = {
            name: site ? site.name : _.capitalize(p.sld),
            src: site ? site.src : "user_defined", safe: [{domain}]
        };
        if (site && site.deleted) {
            out.deleted = false;
        }
        if (cur) {
            out = mergeSite(out, cur);
        }
        return this.dbCustomSafe.put(out)
            .then(x => this.sync());
    },

    removeSafeDomain: function(domain) {
        const site = _.find(this.customSites, s => s.safe && _.find(s.safe, x => x.domain === domain));
        if (!site) {
            throw new Error(`Safe domain not found: ${domain}`);
        }
        const data = _.cloneDeep(site);
        site.safe = site.safe.filter(x => x.domain !== domain);
        return this.dbCustomSafe.put(data)
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
                throw new Error(`Invalid hostname ${host}`);
            }
            data = {name: _.capitalize(p.sld), src: "user_defined"};
        } else {
            /* Site exists, may be disabled */
            data = {name: site.name, src: site.src, disabled: false};
        }

        data.protected = [{url: url1, disabled: false, deleted: false}];

        let res = Promise.resolve(true);

        if (logo) {
            res = res.then(x => createPatterns(logo))
                .then(result => {
                    const pattern = {
                        base64: logo,
                        patternCorners: result.patternCorners,
                        patternDescriptors: result.patternDescriptors,
                        site: data.name,
                        page: url1,
                        checksum: CryptoJS.SHA256(logo).toString()
                    };
                    return this.dbTemplateList.put(pattern);
                });
        }

        const cur = this.customSites.filter(x => x.name === data.name) || {},
            out = mergeSite(data, cur);
        res = res.then(x => this.dbCustomSites.put(out))
            .then(x => this.sync());
        return res;
    },

    removeProtectedURL: function(url) {
        const url1 = stripQueryParams(url),
            site = this.getSite(url1);
        let indexTemplate = -1,
            indexProtected = site.protected.findIndex(x => x.url === url1);

        if (!site) {
            throw new Error(`Site not found for URL ${url1}`);
        }
        if (indexProtected === -1) {
            throw new Error(`Protected URL not found: ${url1}`);
        }
        if (site.templates) {
            indexTemplate = site.templates.findIndex(x => x.page && x.page === url);
        }
        let res = Promise.resolve(true);
        if (site.src === "user_defined") {
            const out = _.cloneDeep(site);
            if (indexTemplate !== -1) {
                //const checksum = out.templates[indexTemplate].checksum;
                out.templates.splice(indexTemplate, 1);
                //res = res.then(x => this.dbTemplateList.remove(checksum))
                //    .then(x => this.syncTemplates());
            }
            out.protected.splice(indexProtected, 1);
            res = res.then(x => this.dbCustomSites.put(out))
                .then(x => this.sync());
        } else { // This is one of the default sites.
            const cur = _.find(this.customSites, x => x.name === site.name);
            let out = cur ? _.cloneDeep(cur) : {name: site.name, src: site.src};
            out.protected = [_.cloneDeep(site.protected[indexProtected])];
            out.protected[0].deleted = true;
            if (indexTemplate !== -1) {
                out.templates = [_.cloneDeep(site.templates[indexTemplate])];
                out.templates[0].deleted = true;
            }
            if (cur) {
                out = mergeSite(out, cur);
            }
            res = res.then(x => this.dbCustomSites.put(out))
                .then(x => this.sync());
        }

        return res;
    },

    removeSite: function(name) {
        const site = this.getSite(name, "exists");
        if (!site) {
            throw new Error(`Site does not exist: ${name}`);
        }
        let res = (site.src === "user_defined") ? this.dbCustomSites.remove(name) :
            this.dbCustomSites.put({name, src: site.src, deleted: true});
        return res.then(x => this.sync());
    },

    toggleSite: function(name, enable) {
        const site = this.getSite(name, "exists");
        if (!site) {
            throw new Error(`Site does not exist: ${name}`);
        }
        const cur = _.find(this.customSites, x => x.name === site.name);
        let out = cur ? _.cloneDeep(cur) : {name: site.name, src: site.src};
        out.disabled = !enable;
        return this.dbCustomSites.put(out)
            .then(x => this.sync());
    },

    toggleURL: function(url, enable) {
        const site = this.getSite(url),
            url1 = this.getProtectedURL(url, "exists"),
            templates = site.templates.filter(x => !x.deleted && x.page && x.page === url);

        if (!site || !url1) {
            throw new Error(`URL does not exist: ${url}`);
        }
        const cur = _.find(this.customSites, x => x.name === site.name),
            out = cur ? _.cloneDeep(cur) : {name: site.name, src: site.src};
        url1.disabled = !enable;
        out.protected = [url1];
        if (templates.length) {
            out.templates = templates.map(x => _.cloneDeep(x))
                .map(x => (x.disabled = !enable, x));
        }
        if (cur) {
            mergeSite(out, cur);
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
            .then(syncSites)
            .then(syncTemplates);

        function prep(site) {
            site.protected = site.protected || [];
            site.templates = site.templates || [];
            site.safe = site.safe || [];
            site.safe = _.uniq(site.safe.concat(site.protected.map(p => ({domain: getPathInfo(p.url).host}))));
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
            /* flattened list of all templates, annotated by site name */
            const templates = this.sites.filter(x => !x.deleted && x.templates)
                .map(y => y.templates.map(z => (z.site = y.name, z)))
                .reduce((a,b) => a.concat(b),[]);

            const checksums = templates.filter(x => !x.deleted).map(y => y.checksum);
            const garbageTemplates = this.templateList.filter(x => checksums.indexOf(x.checksum) === -1)
                .map(y => y.checksum);
            const newTemplates = templates.filter(x => !x.deleted &&
                this.templateList.findIndex(y => y.checksum === x.checksum) === -1);

            let res = Promise.resolve(true);
            if (garbageTemplates.length) {
                res = res.then(x => this.dbTemplateList.removeBatch(garbageTemplates));
            }
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
            res = res.then(x => this.dbTemplateList.getAll())
                .then(x => this.templateList = x.filter(x => !x.disabled));

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

Feed:
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
          "url": "https://accounts.google.com/signin/v2/identifier"
        },
        {
          "url": "https://accounts.google.com/signin/oauth/identifier"
        },
        {
          "url": "https://accounts.google.com/signin/v2/sl/pwd"
        }
      ],
      "templates": [
        {
          "name": "Google 2016",
          "image": "https://deepak-shinde.github.io/feeds/main/images/google-old.png",
          "checksum": "eae2d41d1d199d57ee6515953a143596572f425cb8217cd4912165d535686a9d"
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
    ...
*/
