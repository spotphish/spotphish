/*
 * Copyright (C) 2017 by Coriolis Technologies Pvt Ltd.
 * This program is free software - see the file LICENSE for license details.
 */

"use strict";
var VERBOSE = false;
const tab_status = {
    NA: 0,
    WHITELISTED: 1,
    NOT_WHITELISTED: 2
};

function getPathInfo(path) {
    //  create a link in the DOM and set its href
    var link = document.createElement("a");
    link.setAttribute("href", path);

    //  return an easy-to-use object that breaks apart the path
    return {
        host: link.hostname, //  'example.com'
        port: link.port, //  12345
        path: link.pathname, //  '/blog/foo/bar'
        protocol: link.protocol //  'http:'
    };
}

function stripQueryParams(url) {
    var urlData = getPathInfo(url);
    var site = urlData.protocol + "//" + urlData.host;
    if (urlData.port) {
        site = site + ":" + urlData.port;
    }
    site = site + urlData.path;
    return site;
}

function getUrlVars() {
    var vars = [],
        hash;
    var hashes = window.location.href.slice(window.location.href.indexOf("?") + 1).split("&");
    for (var i = 0; i < hashes.length; i++) {
        hash = hashes[i].split("=");
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function isSpecialTab(url) {
    if (url.indexOf("chrome:") === 0 || url.indexOf("chrome-extension:") === 0 || url.indexOf("chrome-devtools:") === 0 || url.indexOf("file:") === 0 || url.indexOf("chrome.google.com/webstore") >= 0) {
        return true;
    }
    return false;
}

function assert() {
    var args = [].slice.call(arguments),
        name = "ASSERT",
        cond, rest;

    if (isstring(args[0])) {
        name = name + ": " + args[0];
        cond = args[1];
        rest = args.slice(2);
    } else {
        cond = args[0];
        rest = args.slice(1);
    }
    if (!cond) {
        var e = new Error(name);
        console.log(name, rest);
        console.log(e.stack);
        throw e;
    }
}

function debug(...args) {
    if (DEBUG) {
        console.log(...args);
    }
}

/* parseUri, MIT license
 * http://blog.stevenlevithan.com/archives/parseuri
 * Copyright 2007, Steven Levithan
 */

function parseUri(str) {
    var parser = /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@\/]*)(?::([^:@\/]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/,
        parserKeys = ["source", "scheme", "authority", "userInfo", "user", "password", "host", "port", "relative", "path", "directory", "file", "query", "fragment"],
        m = parser.exec(str || ""),
        parts = {};

    parserKeys.forEach(function (key, i) {
        parts[key] = m[i] || "";
    });
    return parts;
}

function parseqs(str) {
    var qp = str.split("&"),
        params = {};

    qp.forEach(function (el) {
        var pv = el.split("=");
        if (pv.length === 2) {
            params[pv[0]] = pv[1];
        }
    });
    return params;
}

function isnumber(n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

function isstring(obj) {
    return obj instanceof String || typeof obj === "string";
}

function isObject(item) {
    return (item && typeof item === "object" && !Array.isArray(item));
}

function mergeDeep(target, ...sources) {
    if (!sources.length) return target;
    const source = sources.shift();

    if (isObject(target) && isObject(source)) {
        for (const key in source) {
            if (isObject(source[key])) {
                if (!target[key]) Object.assign(target, {
                    [key]: {}
                });
                mergeDeep(target[key], source[key]);
            } else {
                Object.assign(target, {
                    [key]: source[key]
                });
            }
        }
    }
    return mergeDeep(target, ...sources);
}

/*
 * Promise wrapper around IDBWrapper around IndexedDB
 */

class Pdb {
    constructor(options) {
        this.ready_promise = new Promise((resolve, reject) => {
            const o = Object.assign({}, options, {
                onStoreReady: resolve,
                onError: reject
            });
            this.db = new IDBStore(o);
        });
    }

    ready() {
        return this.ready_promise;
    }

    put(data) {
        return new Promise((resolve, reject) => this.db.put(data, resolve, reject));
    }

    putBatch(data) {
        return new Promise((resolve, reject) => this.db.putBatch(data, resolve, reject));
    }

    get(id) {
        return new Promise((resolve, reject) => this.db.get(id, resolve, reject));
    }

    getAll() {
        return new Promise((resolve, reject) => this.db.getAll(resolve, reject));
    }

    remove(id) {
        return new Promise((resolve, reject) => this.db.remove(id, resolve, reject));
    }

    removeBatch(idlist) {
        return new Promise((resolve, reject) => this.db.removeBatch(idlist, resolve, reject));
    }

    clear() {
        return new Promise((resolve, reject) => this.db.clear(resolve, reject));
    }
}

function ajax_get(url) {
    return new Promise((resolve, reject) => {
        $.getJSON(url)
            .done(x => resolve(x))
            .fail(e => reject(e));
    });
}


//Reference: https://github.com/akiomik/chrome-storage-promise/blob/master/src/chrome-storage-promise.js
chrome.storage.promise = {
    // local
    local: {
        get: (keys) => {
            let promise = new Promise((resolve, reject) => {
                chrome.storage.local.get(keys, (items) => {
                    let err = chrome.runtime.lastError;
                    if (err) {
                        reject(err);
                    } else {
                        resolve(items);
                    }
                });
            });
            return promise;
        },
        set: (items) => {
            let promise = new Promise((resolve, reject) => {
                chrome.storage.local.set(items, () => {
                    let err = chrome.runtime.lastError;
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            return promise;
        },
        getBytesInUse: (keys) => {
            let promise = new Promise((resolve, reject) => {
                chrome.storage.local.getBytesInUse(keys, (items) => {
                    let err = chrome.runtime.lastError;
                    if (err) {
                        reject(err);
                    } else {
                        resolve(items);
                    }
                });
            });
            return promise;
        },
        remove: (keys) => {
            let promise = new Promise((resolve, reject) => {
                chrome.storage.local.remove(keys, () => {
                    let err = chrome.runtime.lastError;
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            return promise;
        },
        clear: () => {
            let promise = new Promise((resolve, reject) => {
                chrome.storage.local.clear(() => {
                    let err = chrome.runtime.lastError;
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            return promise;
        }
    }
};