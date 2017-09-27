"use strict";
var VERBOSE = false;
const tab_status = {
    NA: 0,
    WHITELISTED: 1,
    NOT_WHITELISTED: 2
};

function getPathInfo(path) {
    //  create a link in the DOM and set its href
    var link = document.createElement('a');
    link.setAttribute('href', path);

    //  return an easy-to-use object that breaks apart the path
    return {
        host: link.hostname, //  'example.com'
        port: link.port, //  12345
        path: link.pathname, //  '/blog/foo/bar'
        protocol: link.protocol //  'http:'
    }
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

function getUrlVars()
{
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function isSpecialTab(url) {
    if (url.indexOf('chrome:') === 0 || url.indexOf('chrome-extension:') === 0 || url.indexOf('chrome-devtools:') === 0 || url.indexOf('file:') === 0 || url.indexOf('chrome.google.com/webstore') >= 0) {
        return true;
    }
    return false;
}

function assert() {
    var args = [].slice.call(arguments),
        name = 'ASSERT',
        cond, rest;

    if (isstring(args[0])) {
        name = name + ': ' + args[0];
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
        m = parser.exec(str || ''),
        parts = {};

    parserKeys.forEach(function(key, i) {
        parts[key] = m[i] || '';
    });
    return parts;
}

function parseqs(str) {
    var qp = str.split('&'),
        params = {};

    qp.forEach(function(el) {
        var pv = el.split('=');
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
    return obj instanceof String || typeof obj === 'string';
}

function ajax_get(url, cb) {
    var request = new XMLHttpRequest(),
        callback = cb || function() {};
    request.open('GET', url, true);
    request.onload = function() {
        console.log("status : ", request.status);
        if (request.status >= 200 && request.status < 400) {
            var data;
            try {
                data = JSON.parse(request.responseText);
            } catch (e) {
                data = null;
            }
            return callback(null, data);
        } else {
            callback('ajax_get error');
        }
    };
    request.onerror = function() {
        return callback('ajax_get error');
    };
    request.send();
}

function isObject(item) {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

function mergeDeep(target, ...sources) {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

