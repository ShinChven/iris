#!/usr/bin/env node
import fs from 'fs-extra';
import path from "path";
import {APP_DATA_DIR} from "./utils/paths";
import {downloadProfile} from "./scrapers/instagram";

console.log('data dir:', APP_DATA_DIR);

// read local proxy
const proxy_file_path = path.join(APP_DATA_DIR, 'proxy');

fs.existsSync(proxy_file_path)

const proxy = fs.existsSync(proxy_file_path) && fs.readFileSync(proxy_file_path, 'utf-8');

if (proxy) {
    console.log('using proxy for download:', proxy);
}

const url = process.argv[2];

if (url.indexOf('proxy=') === 0) {
    const p = url.split('=')[1];
    // set proxy
    if (p !== undefined) {
        fs.ensureDirSync(APP_DATA_DIR);
        fs.writeFileSync(proxy_file_path, p, 'utf-8');
        console.log('proxy set to:', p);
    } else { // unset proxy
        fs.removeSync(proxy_file_path);
        console.log('proxy set to:', p);
    }
    // check if the url is from instagram
} else if (url.indexOf('https://www.instagram.com/') === 0) {
    downloadProfile({profileUrl: url, proxy: proxy ? proxy : undefined}).then();
}
