import puppeteer from "puppeteer-core";

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
}

/**
 * A puppeteer auto scroll script.
 * @param page {puppeteer.Page}
 */
export async function autoScroll(page:puppeteer.Page){
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

