import puppeteer from "puppeteer-core";
import fs from "fs-extra";
import path from "path";

/**
 * Chrome executablePaths for puppeteer, available for win32 and darwin.
 *
 * If your platform arch is not in one of these two, please modify this constant from source.
 */
export const executablePaths: {
    [arch: string]: string
} = {
    win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    linux: '/opt/google/chrome/chrome'    
}

/**
 * A puppeteer auto scroll script.
 * @param page {puppeteer.Page}
 */
export async function autoScroll(page: puppeteer.Page) {
    await page.evaluate(async () => {
        console.log('start scroll');
        await new Promise<void>((resolve, _reject) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 1000);
        });
    });
}

interface NewBrowserArgs {
    headless?: boolean;
}

/**
 * init puppeteer
 */
export const newBrowser = async (args?: NewBrowserArgs) => {
    const {headless = false} = args || {};
    return await puppeteer.launch({
        headless,
        executablePath: executablePaths[process.platform],
        defaultViewport: undefined,
    });
}

interface CookiesArgs {
    page: puppeteer.Page;
    cookiesPath: string;
}

/**
 * Load saved cookies from json file to page if exists.
 * @param page
 * @param cookiesPath
 */
export const loadCookies = async ({page, cookiesPath}: CookiesArgs) => {
    // load saved cookies, so you don't have to login every time.
    if (fs.existsSync(cookiesPath)) {
        const cookies = await fs.readJSON(cookiesPath);
        await page.setCookie(...cookies);
    }
}

/**
 * Output cookies from page to json file
 * @param page
 * @param cookiesPath
 */
export const outputCookies = async ({page, cookiesPath}: CookiesArgs) => {
    // save cookies
    const cookies = await page.cookies();
    await fs.ensureDir(path.dirname(cookiesPath));
    await fs.writeJSON(cookiesPath, cookies);
}
