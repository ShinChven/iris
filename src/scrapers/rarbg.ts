import {loadCookies, newBrowser, outputCookies} from "../utils/puppeteer";
import path from "path";
import {APP_DATA_DIR} from "../utils/paths";
import puppeteer from 'puppeteer-core';
import {sleep} from "../utils/sleep-promise";
import {taskId} from "../utils/task-id";
import fs from "fs-extra";

export const RARBG_HOST = 'https://rarbgprx.org';
export const RARBG_DATA_DIR = path.join(APP_DATA_DIR, 'rarbg');
export const RARBG_COOKIES_FILENAME = path.join(RARBG_DATA_DIR, 'cookies.json');

interface RarbgTorrent {
    url: string;
    title?: string;
    magnetLink?: string;
    torrentFile?: string;
    posterFile?: string;
}

interface RarbgScrapeArgs {
    url: string;
    headless?: boolean;
    browser?: puppeteer.Browser;
}

export const downloadRarbgSearchResults = async ({url, headless}: RarbgScrapeArgs) => {
    const torrents = await scrapeRarbgSearchResult({url, headless});
    const result = {url, torrents};
    const id = taskId();
    await fs.outputJSON(path.join(RARBG_DATA_DIR, `${id}.json`), result);
    await fs.outputFile(path.join(RARBG_DATA_DIR, `${id}.txt`), torrents.map(t => t.magnetLink).join('\n'));
    return result;
}

const withDomain = (urlPath: string) => {
    // noinspection SuspiciousTypeOfGuard
    if (typeof urlPath !== 'string') {
        return undefined
    }
    if (urlPath.indexOf('https://') >= 0) {
        return urlPath;
    } else {
        return `${RARBG_HOST}${urlPath}`;
    }
}

export const RARBG_SEARCH_RESULT_ITEM_SELECTOR = 'table.lista2t > tbody > tr > td:nth-child(2) > a:nth-child(1)';
export const RARBG_SEARCH_RESULT_NEXT_PAGE_BUTTON_SELECTOR = '#pager_links > a:last-child';

export const scrapeRarbgSearchResult = async ({url, headless}: RarbgScrapeArgs) => {
    return new Promise<Array<RarbgTorrent>>(async resolve => {
        let browser: puppeteer.Browser;
        let page: puppeteer.Page;
        browser = await newBrowser({headless});
        page = await browser.newPage();
        const torrents: Array<RarbgTorrent> = [];

        page.on('load', async () => {
            const u = page.url();
            console.log("page loaded @", u);
            if (u.indexOf('https://rarbgprx.org/torrents.php') >= 0) {
                outputCookies({page, cookiesPath: RARBG_COOKIES_FILENAME}).then().catch();
            }
            const elements = await page.$$(RARBG_SEARCH_RESULT_ITEM_SELECTOR);
            if (elements.length > 0) {
                for (let i = 0; i < elements.length; i++) {
                    console.log(i);
                    const e = elements[i];
                    try {
                        const href = await e.evaluate(a => a.getAttribute('href'));
                        const u = withDomain(href);
                        if (typeof u === 'string' && u.indexOf('https://rarbgprx.org/torrent/') === 0) {
                            const t = await scrapeRarbgTorrent({url: u, browser});
                            torrents.push(t);
                            // noinspection PointlessArithmeticExpressionJS
                            await sleep(1 * 1000);
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
                if (elements.length !== 26) {
                    browser?.close();
                    resolve(torrents);
                }else{
                    try {
                        const nextPagePath = (await page.$eval(RARBG_SEARCH_RESULT_NEXT_PAGE_BUTTON_SELECTOR, a => a.getAttribute('href'))) || undefined;
                        await page.goto(withDomain(nextPagePath!)!);
                    } catch (e) {
                        console.error(e);
                        browser?.close();
                        resolve(torrents);
                    }
                }

            } else {
                browser?.close();
                resolve(torrents);
            }

        });

        await loadCookies({page, cookiesPath: RARBG_COOKIES_FILENAME});
        await page.goto(url);
    });
}

export const RARBG_TORRENT_FILE_SELECTOR = 'body > table:nth-child(6) > tbody > tr > td:nth-child(2) > div > table > tbody > tr:nth-child(2) > td > div > table > tbody > tr:nth-child(1) > td.lista > a:nth-child(2)';
export const RARBG_TORRENT_MAGNET_LINK_SELECTOR = 'body > table:nth-child(6) > tbody > tr > td:nth-child(2) > div > table > tbody > tr:nth-child(2) > td > div > table > tbody > tr:nth-child(1) > td.lista > a:nth-child(3)';
export const RARBG_TORRENT_POSTER_URL_SELECTOR = 'body > table:nth-child(6) > tbody > tr > td:nth-child(2) > div > table > tbody > tr:nth-child(2) > td > div > table > tbody > tr:nth-child(4) > td.lista > img';


export const scrapeRarbgTorrent = async ({url, browser, headless}: RarbgScrapeArgs) => {
    return new Promise<RarbgTorrent>(async (resolve, reject) => {
        let b: puppeteer.Browser = browser || await newBrowser({headless});
        let page = await b.newPage();
        const rarbgTorrent: RarbgTorrent = {url}
        page.on('load', async () => {
            const u = page.url();
            console.log("page loaded @", u);
            if (u.indexOf('https://rarbgprx.org/torrent') >= 0) {
                outputCookies({page, cookiesPath: RARBG_COOKIES_FILENAME}).then().catch();
                try {
                    rarbgTorrent.title = (await page.$eval(RARBG_TORRENT_FILE_SELECTOR, anchor => anchor.textContent)) || undefined;
                } catch (e) {
                    console.error(e);
                }
                try {
                    rarbgTorrent.torrentFile = (await page.$eval(RARBG_TORRENT_FILE_SELECTOR, anchor => anchor.getAttribute('href'))) || undefined;
                    rarbgTorrent.torrentFile = withDomain(rarbgTorrent.torrentFile!);
                } catch (e) {
                    console.error(e);
                }
                try {
                    rarbgTorrent.magnetLink = (await page.$eval(RARBG_TORRENT_MAGNET_LINK_SELECTOR, anchor => anchor.getAttribute('href'))) || undefined;
                } catch (e) {
                    console.error(e);
                }
                try {
                    rarbgTorrent.posterFile = (await page.$eval(RARBG_TORRENT_POSTER_URL_SELECTOR, anchor => anchor.getAttribute('src'))) || undefined;
                } catch (e) {
                    console.error(e);
                }
                resolve(rarbgTorrent);
            } else {
                reject('not found');
            }
            await page.close();
            if (browser === undefined) {
                b?.close();
            }
        })
        await loadCookies({page, cookiesPath: RARBG_COOKIES_FILENAME});
        await page.goto(url);
    });
}
