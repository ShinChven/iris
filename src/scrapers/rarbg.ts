import {loadCookies, newBrowser, outputCookies} from "../utils/puppeteer";
import path from "path";
import {APP_DATA_DIR} from "../utils/paths";
import puppeteer from 'puppeteer-core';

export const RARBG_HOST = 'https://rarbgprx.org';
export const RARBG_DATA_DIR = path.join(APP_DATA_DIR, 'instagram');
export const RARBG_COOKIES_FILENAME = path.join(RARBG_DATA_DIR, 'cookies.json');
export const RARBG_TORRENT_FILE_SELECTOR = 'body > table:nth-child(6) > tbody > tr > td:nth-child(2) > div > table > tbody > tr:nth-child(2) > td > div > table > tbody > tr:nth-child(1) > td.lista > a:nth-child(2)';
export const RARBG_TORRENT_MAGNET_LINK_SELECTOR = 'body > table:nth-child(6) > tbody > tr > td:nth-child(2) > div > table > tbody > tr:nth-child(2) > td > div > table > tbody > tr:nth-child(1) > td.lista > a:nth-child(3)';
export const RARBG_TORRENT_POSTER_URL_SELECTOR = 'body > table:nth-child(6) > tbody > tr > td:nth-child(2) > div > table > tbody > tr:nth-child(2) > td > div > table > tbody > tr:nth-child(4) > td.lista > img';

interface RarbgTorrent {
    url: string;
    title?: string;
    magnetLink?: string;
    torrentFile?: string;
    posterFile?: string;
}

interface ScrapeViaPuppeteerArgs {
    url: string;
    reusedPage?: puppeteer.Page
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

export const RARBG_SEARCH_RESULT_ITEM_SELECTOR ='table.lista2t > tbody > tr:nth-child(1) > td > a';

export const scrapeRarbgSearchResult = async ({url, reusedPage}: ScrapeViaPuppeteerArgs) => {
    return new Promise<Array<RarbgTorrent>>(async resolve => {
        let browser: puppeteer.Browser;
        let page: puppeteer.Page;
        if (reusedPage) {
            page = reusedPage;
        } else {
            browser = await newBrowser();
            page = await browser.newPage();
        }

        page.on('load',async ()=>{
            const u = page.url();
            if (u.indexOf('https://rarbgprx.org/torrents.php') >= 0) {
                outputCookies({page, cookiesPath: RARBG_COOKIES_FILENAME}).then().catch();
            }
            const elements = await page.$$(RARBG_SEARCH_RESULT_ITEM_SELECTOR);
            console.log(elements.length);
            browser?.close()
        });

        await loadCookies({page, cookiesPath: RARBG_COOKIES_FILENAME});
        await page.goto(url);
    });
}

export const scrapeRarbgTorrent = async ({url, reusedPage}: ScrapeViaPuppeteerArgs) => {
    return new Promise<RarbgTorrent>(async (resolve) => {
        let browser: puppeteer.Browser;
        let page: puppeteer.Page;
        if (reusedPage) {
            page = reusedPage;
        } else {
            browser = await newBrowser();
            page = await browser.newPage();
        }

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
                browser?.close();
            }
        })
        await loadCookies({page, cookiesPath: RARBG_COOKIES_FILENAME});
        await page.goto(url);
    });
}
