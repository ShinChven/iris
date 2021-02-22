export interface ScraperOptions {
    headless?: boolean;
    abortOnError?: boolean;
    proxy?: string;
    timeout?: number;
    clock?: number;
}

export const getOptions = () => {
    const options: ScraperOptions = {}

    process.argv.forEach(a => {
        try {
            if (a === '--headless') {
                options.headless = true;
            } else if (a === '--abort-on-error') {
                options.abortOnError = true;
            } else if (a.indexOf('--timeout=') === 0) {
                const split = a.split('=');
                const n = split[1];
                const timeout = parseInt(n);
                if (!isNaN(timeout)) {
                    options.timeout = timeout;
                }
            } else if (a.indexOf('--clock=') === 0) {
                const split = a.split('=');
                const n = split[1];
                const clock = parseInt(n);
                if (!isNaN(clock)) {
                    options.clock = clock;
                }
            }
        } catch (e) {
            console.error(e);
        }
    });
    return options;
}
