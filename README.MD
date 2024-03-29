# Iris

> Internet scraper.
> 
> This is a cli app, you must use it from command line.

## Install

- Install nodejs.
- Install Chrome to default path.
- Clone this repository.
- Run script below to install this cli:

```bash
npm link
```

### About puppeteer's Chrome Executable Path

Some scrapers use [puppeteer-core](https://www.npmjs.com/package/puppeteer-core) to scrape content. 

`puppeteer-core` does not come with a bundled Chromium, `iris` will use the `Chrome`'s default installation path.

Please make sure you have installed Chrome to default path. If not, you should modify the [executablePath](https://github.com/ShinChven/iris/blob/master/src/utils/puppeteer.ts) here.



## Usage

After installation, `iris` command should be available, just use it in your terminal:

```bash
# COMMAND
iris <URL-TO-SCRAPE> [...options]
# EXAMPLE
iris https://www.instagram.com/{PROFILE_NAME} --headless
```

### Options
|Option|Description|
|---|---|
|--headless|Run puppeteer in headless mode. After you log in to some sites, you can add this option to run scraper without Chrome UI.|

### Scrape Instagram

```bash
iris <INSTAGRAM-PROFILE-URL>
```

This is the only supported site at initial release.

The program will fire up a Chrome instance via puppeteer to scrape instagram profile.

Manual login is required as instagram is preventing puppeteer from typing in username and password programmatically, as of Feb 15th, 2021. 

Please log in your instagram account manually when chrome pops up, cookies will be saved to the app's data dir (which is in user's home dir) to be reused.

Please `DO NOT` use your main account for scraping, doing so might get your account banned.

Please `DO NOT` steal others' privacy and respect content owner.

Scraping can be slow.

### Download

Media files will be downloaded to this application's data dir: `~/.iris`.

Existing files won't be downloaded again. If something's broken, delete it manually.


