#!/usr/bin/env node
import {APP_DATA_DIR} from "./utils/paths";
import {downloadProfile} from "./scrapers/instagram";
import {getConfig, setConfig} from "./utils/config";
import {downloadRarbgSearchResults} from "./scrapers/rarbg";
import {getOptions} from "./options";

console.log('data dir:', APP_DATA_DIR);


const url = process.argv[2];

const options = getOptions();

const {proxy} = getConfig();
if (!options.proxy) {
    options.proxy = proxy;
}
if (proxy) {
    console.log('using proxy for download:', proxy);
}


if (url.indexOf('set') === 0) {
    const [, , , key, value] = process.argv;
    const c = setConfig({key, value});
    console.log(JSON.stringify(c, null, 2));
} else if (url.indexOf('https://www.instagram.com/') === 0) {
    downloadProfile({profileUrl: url, ...options}).then();
} else if (url.indexOf('https://rarbgprx.org/torrents.php') === 0) {
    downloadRarbgSearchResults({url, ...options}).then();
} else {
    console.log('not supported:', url);
}
