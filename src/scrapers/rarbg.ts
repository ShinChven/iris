import { loadCookies, newBrowser, outputCookies } from "../utils/puppeteer";
import path from "path";
import { APP_DATA_DIR } from "../utils/paths";
import puppeteer from 'puppeteer-core';
import { sleep } from "../utils/sleep-promise";
import { taskId } from "../utils/task-id";
import fs from "fs-extra";
import { ScraperOptions } from "../options";
import qs from "qs";

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

interface RarbgScrapeArgs extends ScraperOptions {
    url: string;
    headless?: boolean;
    browser?: puppeteer.Browser;
}

export const getRarbgResultFilename = (url: string) => {
    const querystring = url.split('?')[1];
    const queries: { search?: string, category?: string | Array<string> } = qs.parse(querystring);
    const { search, category } = queries;
    const nameComponents: Array<string> = [];
    if (typeof search === "string") {
        const searchString = search?.split(' ').join('_');
        if (searchString) {
            nameComponents.push(searchString);
        }
    }
    let categoryArr: Array<number> = [];
    if (typeof category === 'string') {
        categoryArr = category?.split(';').map(i => parseInt(i));
    } else if (Array.isArray(category)) {
        categoryArr = category.map(i => parseInt(i));
    }
    if (categoryArr.length > 0) {
        categoryArr.sort((a, b) => a - b);
        const categoryString = categoryArr.join('_');
        if (categoryString) {
            nameComponents.push(categoryString);
        }
    }
    return nameComponents.join('_in_');
}

const getMagnetURL = (m: string) => {
    return m.split('&')[0];
}

export const downloadRarbgSearchResults = async (scrapeArgs: RarbgScrapeArgs) => {
    const torrents = await scrapeRarbgSearchResult(scrapeArgs);
    const { url, } = scrapeArgs;
    const result = { url, torrents };
    const resultFilename = getRarbgResultFilename(url);
    const id = taskId();
    await fs.outputJSON(path.join(RARBG_DATA_DIR, `${id}-${resultFilename}.json`), result, { encoding: 'utf-8' });
    const magnets: Record<string, string> = {};

    const magnetFile = path.join(RARBG_DATA_DIR, `${resultFilename === '' ? id : resultFilename}.txt`);
    if (fs.existsSync(magnetFile)) {
        const str = await fs.readFile(magnetFile, 'utf-8');
        const existed = str.split('\n');
        existed.forEach(m => {
            magnets[getMagnetURL(m)] = m;
        });
    }
    torrents.forEach(t => {
        const m = t.magnetLink;
        if (typeof m === 'string') {
            magnets[getMagnetURL(m)] = m;
        }
    })
    console.log(magnets.length);
    await fs.outputFile(magnetFile, Object.keys(magnets).map(k => magnets[k]).join('\n'), { encoding: 'utf-8' });
    console.log('magnets saved to', magnetFile);
    return result;
}

const withDomain = (urlPath?: string) => {
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

export const scrapeRarbgSearchResult = async (scrapeArgs: RarbgScrapeArgs) => {
    const { url, headless, timeout, abortOnError, clock } = scrapeArgs;
    return new Promise<Array<RarbgTorrent>>(async resolve => {
        let browser: puppeteer.Browser;
        let page: puppeteer.Page;
        browser = await newBrowser({ headless });
        page = await browser.newPage();
        const torrents: Array<RarbgTorrent> = [];

        page.on('load', async () => {
            const u = page.url();
            console.log("page loaded @", u);

            if (u.indexOf('https://rarbgprx.org/threat_defence.php') >= 0) {
                console.log('Please enter captcha code in browser...')
                return;
            }

            if (u.indexOf('https://rarbgprx.org/torrents.php') >= 0) {
                outputCookies({ page, cookiesPath: RARBG_COOKIES_FILENAME }).then().catch();
            }
            const elements = await page.$$(RARBG_SEARCH_RESULT_ITEM_SELECTOR);

            if (elements.length > 0) {
                for (let i = 0; i < elements.length; i++) {
                    const e = elements[i];
                    try {
                        const href = await e.evaluate(a => a.getAttribute('href'));
                        const u = withDomain(href || undefined);
                        if (typeof u === 'string' && u.indexOf('https://rarbgprx.org/torrent/') === 0) {
                            const t = await scrapeRarbgTorrent({ url: u, browser, timeout });
                            torrents.push(t);
                            console.log(`row:${i}\t table length:${elements.length}\t scraped:${torrents.length}`);
                            // noinspection PointlessArithmeticExpressionJS
                            await sleep(clock || 1 * 1000);
                        }
                    } catch (e) {
                        console.error(e);
                        if (abortOnError) {
                            resolve(torrents);
                            console.log(`abort on error @ ${u}`);
                            await browser.close();
                            return;
                        }
                    }
                }
                if (elements.length !== 26) {
                    browser?.close();
                    resolve(torrents);
                } else {
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

        await loadCookies({ page, cookiesPath: RARBG_COOKIES_FILENAME });
        await page.goto(url);
    });
}

export const RARBG_TORRENT_FILE_SELECTOR = 'body > table:nth-child(6) > tbody > tr > td:nth-child(2) > div > table > tbody > tr:nth-child(2) > td > div > table > tbody > tr:nth-child(1) > td.lista > a:nth-child(2)';
export const RARBG_TORRENT_MAGNET_LINK_SELECTOR = 'body > table:nth-child(6) > tbody > tr > td:nth-child(2) > div > table > tbody > tr:nth-child(2) > td > div > table > tbody > tr:nth-child(1) > td.lista > a:nth-child(3)';
export const RARBG_TORRENT_POSTER_URL_SELECTOR = 'body > table:nth-child(6) > tbody > tr > td:nth-child(2) > div > table > tbody > tr:nth-child(2) > td > div > table > tbody > tr:nth-child(4) > td.lista > img';


export const scrapeRarbgTorrent = async (scrapeArgs: RarbgScrapeArgs) => {
    const { url, browser, headless, timeout } = scrapeArgs;
    return new Promise<RarbgTorrent>(async (resolve, reject) => {
        let b: puppeteer.Browser = browser || await newBrowser({ headless });
        let page = await b.newPage();
        const rarbgTorrent: RarbgTorrent = { url }
        let t: NodeJS.Timeout;
        if (typeof timeout === 'number' && timeout > 0) {
            t = setTimeout(async () => {
                reject('timeout');
                await page.close();
                if (browser === undefined) {
                    b?.close();
                }
            }, timeout);
        }
        page.on('load', async () => {
            if (t !== undefined) {
                clearTimeout(t);
            }
            const u = page.url();
            console.log("page loaded @", u);
            if (u.indexOf('https://rarbgprx.org/torrent') >= 0) {
                // outputCookies({page, cookiesPath: RARBG_COOKIES_FILENAME}).then().catch();
                try {
                    rarbgTorrent.torrentFile = (await page.$eval(RARBG_TORRENT_FILE_SELECTOR, anchor => anchor.getAttribute('href'))) || undefined;
                    rarbgTorrent.torrentFile = withDomain(rarbgTorrent.torrentFile!);
                    rarbgTorrent.magnetLink = (await page.$eval(RARBG_TORRENT_MAGNET_LINK_SELECTOR, anchor => anchor.getAttribute('href'))) || undefined;
                } catch (e) {
                    // if torrentFile url or magnet link is not found, reject it.
                    reject(e);
                    await page.close();
                    if (browser === undefined) {
                        b?.close();
                    }
                    return;
                }
                try {
                    rarbgTorrent.title = (await page.$eval(RARBG_TORRENT_FILE_SELECTOR, anchor => anchor.textContent)) || undefined;
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
        await loadCookies({ page, cookiesPath: RARBG_COOKIES_FILENAME });
        await page.goto(url);
    });
}
