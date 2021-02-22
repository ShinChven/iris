# Iris

> Internet scraper.
> 
> This is a cli app, you must use it from command line.

## Install

- Install nodejs if you haven't.
- Clone this repository.
- Run script below to install this cli:

```bash
npm link
```

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
|--headless|Run puppeteer in headless mode. When you have log in to some sites, add this option to run scraper without Chrome UI.|

### Scrape Instagram

```bash
iris <INSTAGRAM-PROFILE-URL>
```

This is the only supported site at initial release.

The program will fire up a Chrome instance via puppeteer to scrape instagram profile.

Manual login is required as instagram is preventing puppeteer from typing in username and password programmatically, as of Feb 15th, 2021. 

Please log in your instagram account manually when chrome pops up, cookies will be saved to the app's data dir (which is in user's home dir) to reuse.

Please `DO NOT` use your main account for scraping might your account banned.

Please `DO NOT` steal others' privacy and respect contents owner.

Scraping can be slow.

### Download

Media files will be downloaded to program's data dir: `~/.iris`.

Existing files won't be downloaded again. If something's broken, delete it manually.


