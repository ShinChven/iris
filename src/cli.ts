#!/usr/bin/env node
import {APP_DATA_DIR} from "./utils/paths";
import {downloadProfile} from "./scrapers/instagram";
import {getConfig, setConfig} from "./utils/config";

console.log('data dir:', APP_DATA_DIR);

const {proxy} = getConfig();

if (proxy) {
    console.log('using proxy for download:', proxy);
}

const url = process.argv[2];

if (url.indexOf('set') === 0) {
    const [, , , key, value] = process.argv;
    const c = setConfig({key, value});
    console.log(JSON.stringify(c, null, 2));
} else if (url.indexOf('https://www.instagram.com/') === 0) {
    downloadProfile({profileUrl: url, proxy: proxy ? proxy : undefined}).then();
}
