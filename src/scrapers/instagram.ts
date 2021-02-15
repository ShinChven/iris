import { autoScroll, executablePaths } from "../utils/puppeteer";
import puppeteer, { HTTPRequest, HTTPResponse } from 'puppeteer-core';
import fs from 'fs-extra';
import path from "path";
import { APP_DATA_DIR } from "../utils/paths";
import qs from "qs";
import { sleep } from "../utils/sleep-promise";
import { taskId } from "../utils/task-id";
import { downloadFiles } from "../io/download";
import { rejects } from "assert";

export const INSTAGRAM_DATA_DIR = path.join(APP_DATA_DIR, 'instagram');
export const INSTAGRAM_COOKIES_FILENAME = path.join(INSTAGRAM_DATA_DIR, 'cookies.json');

/**
 * Remove queries from profile url, return the clean url.
 * @param profileUrl Url of the instagram profile you want to scrape
 */
export const getPureProfileUrl = (profileUrl: string) => profileUrl && profileUrl.split('?')[0];

/**
 * Get Profile id/name from instagram profile url.
 * @param profileUrl Url of the instagram profile you want to scrape
 */
export const getProfileName = (profileUrl: string) => {
    const split = getPureProfileUrl(profileUrl).split('/');
    if (split) {
        for (let i = split.length - 1; i >= 0; i--) {
            const take = split[i];
            if (take.length > 0 && take !== 'channel') {
                return take;
            }
        }
    }
    return undefined;
}

/**
 * Download the instagram profile's timeline posts and IGTV videos. 
 * 
 * Manual login is required as instagram is preventing puppeteer from typing in username and password programmatically, as of Feb 15th, 2021. 
 * Please login your instagram account manually, cookies will be saved to the app's data dir which is in user's home dir.
 * 
 * @param profileUrl {string} Url of the instagram profile you want to scrape
 * @param proxy {string} Use a proxy for downloader if given.
 */
export const downloadProfile = async ({ profileUrl, proxy }: { profileUrl: string, proxy?: string }) => {

    // make room to store contents scraped.
    const profileDir = path.join(INSTAGRAM_DATA_DIR, getProfileName(profileUrl)!);
    console.log(getProfileName(profileUrl));
    console.log(profileDir);

    // fetch profile's content urls via puppeteer.
    const profile = await fetchProfile({ profileUrl });

    // use downloader to download all file urls to user's home dir:
    // 1. download timeline files.
    await downloadFiles({ outputDir: profileDir, proxy, tasks: profile.timelineFiles.map(f => ({ url: f })) });
    // 2. download igtv files.
    await downloadFiles({
        outputDir: path.join(profileDir, 'igtv'),
        proxy,
        tasks: profile.igtvFiles.map(f => ({ url: f })),
    });
}

/**
 * Fetch instagram profile's media content.
 * @param profileUrl {string} Url of the instagram profile you want to scrape
 */
export const fetchProfile = async ({ profileUrl }: { profileUrl: string }) => {

    // scrape timeline feeds via puppeteer
    const profile = await scrapeTimeline({ profileUrl });

    // scrape igtv videos feeds via puppeteer
    const { igtvFiles, igtv } = await scrapeIGTV({ igtvUrl: `${getPureProfileUrl(profileUrl)}channel` });
    profile.igtv = igtv;
    profile.igtvFiles = igtvFiles;

    // output data for archive and debug.
    const tid = taskId();
    const profileDir = path.join(INSTAGRAM_DATA_DIR, getProfileName(profileUrl)!);
    const profileDataDir = path.join(profileDir, '.data');
    await fs.ensureDir(profileDataDir);
    await fs.outputFile(path.join(profileDataDir, `${tid}-data.json`), JSON.stringify(profile, null, 2));
    await fs.outputFile(path.join(profileDataDir, `${tid}-timeline-files.txt`), profile.timelineFiles.join('\n'));
    await fs.outputFile(path.join(profileDataDir, `${tid}-igtv-files.txt`), profile.igtvFiles.join('\n'));

    return profile;
}

/**
 * Fetch instagram profile's timeline posts via puppeteer, while scraping, a chrome will be fired up.
 * 
 * Manual login is required as instagram is preventing puppeteer from typing in username and password programmatically, as of Feb 15th, 2021. 
 * Please login your instagram account manually, cookies will be saved to the app's data dir which is in user's home dir.
 * 
 * @param profileUrl {string} Url of the instagram profile you want to scrape
 */
export const scrapeTimeline = async (
    {
        profileUrl,
    }: { profileUrl: string, }) => {

    // done in promise
    return new Promise<InstagramProfile>(async resolve => {
        // data container
        const profile: InstagramProfile = {
            igtv: [], igtvFiles: [],
            url: getPureProfileUrl(profileUrl),
            profileName: getProfileName(profileUrl),
            timeline: [],
            timelineFiles: []
        }
        // init puppeteer
        const browser = await puppeteer.launch({
            headless: false,
            executablePath: executablePaths[process.platform], // use local chrome installation
            defaultViewport: undefined,
        });
        const page = await browser.newPage();

        // start scrapping when profile page is loaded.
        page.on('load', async () => {
            console.log("page loaded @", page.url());
            // save cookies
            const cookies = await page.cookies();
            await fs.ensureDir(INSTAGRAM_DATA_DIR);
            await fs.writeJSON(INSTAGRAM_COOKIES_FILENAME, cookies);

            // check if the profile page is loaded.
            const pageUrl = page.url();
            if (pageUrl.indexOf(getPureProfileUrl(profileUrl)) === 0) {
                // start auto scroll, request for timeline content will be scrapped in `page.on('response')`.
                await autoScroll(page);
                // scroll ended, return data
                await sleep(1000);
                resolve(profile);
                await browser.close();
            }
        });

        /**
         * Calculate DisplayResources' resolution.
         * @param d {DisplayResources}
         */
        const getDisplayResourceQuality = (d: DisplayResources) => d.config_height * d.config_width;

        /**
         * Get GraphImage in best quality.
         * @param node {InstagramTimelineNode} InstagramTimelineNode
         */
        const getGraphImageInBestQuality = (node: InstagramTimelineNode): DisplayResources | undefined => {
            let displayResource: DisplayResources | undefined = undefined;
            try {
                node?.display_resources?.forEach(d => {
                    if (typeof displayResource?.config_height === 'number') {
                        if (getDisplayResourceQuality(d) > getDisplayResourceQuality(displayResource)) {
                            displayResource = d;
                        }
                    } else {
                        displayResource = d;
                    }
                })
                if (displayResource === undefined) {
                    displayResource = {
                        src: node.display_url,
                        config_width: node.dimensions.width,
                        config_height: node.dimensions.height,
                    }
                }
            } catch (e) {
                console.error(e);
            }
            return displayResource;
        };

        /**
         * Pass an InstagramTimelineNode and it's media files to Profile data container, if the node contains children, children will be added recursively.
         * @param node {InstagramTimelineNode} InstagramTimelineNode
         */
        const addNodeToProfile = (node: InstagramTimelineNode) => {
            console.log('parse node:', `${node.shortcode} is ${node.__typename}`);

            // add node
            profile.timeline.push(node);

            // add image
            const d = getGraphImageInBestQuality(node);
            d && profile.timelineFiles.push(d.src);

            // add video
            if (node.is_video) {
                profile.timelineFiles.push(node.video_url);
            }

            // if the node contains children, children will be added recursively.
            node.edge_sidecar_to_children?.edges?.forEach(edge => {
                profile.timeline.push(edge.node);
                addNodeToProfile(edge.node);
            });
        }

        // Listen to HTTPResponse to scrape timeline
        page.on('response', async (resp: HTTPResponse) => {
            try {
                const networkUrl = resp.url();
                const querystring = networkUrl.split('?')[1];
                const { query_hash } = qs.parse(querystring);
                if (query_hash) {
                    console.log(query_hash);
                    const igResp = (await resp.json()) as InstagramQueryResponse;
                    const edges = igResp?.data?.user?.edge_web_feed_timeline?.edges
                        || igResp?.data?.user?.edge_owner_to_timeline_media?.edges
                        || igResp?.data?.user?.edge_felix_video_timeline?.edges;
                    edges?.forEach(({ node }) => {
                        addNodeToProfile(node);
                    });
                }
            } catch (e) {
                console.error(e);
            }
        });

        // load saved cookies, so you don't have to login every time.
        if (fs.existsSync(INSTAGRAM_COOKIES_FILENAME)) {
            const cookies = await fs.readJSON(INSTAGRAM_COOKIES_FILENAME);
            await page.setCookie(...cookies);
        }
        await page.goto(profileUrl);
    });
}

/**
 * Make an IGTV video url from InstagramTimelineNode.
 * @param node {InstagramTimelineNode} InstagramTimelineNode
 */
export const getIGTVUrl = (node: InstagramTimelineNode) => `https://www.instagram.com/tv/${node.shortcode}/`;

/**
 * Fetch IGTV video urls with cover image url via puppeteer
 * @param igtvUrl {string} Instagram profile's igtv url
 */
export const scrapeIGTV = async (
    {
        igtvUrl,
    }: { igtvUrl: string, }) => {
    // done in promise
    return new Promise<InstagramProfile>(async resolve => {

        /**
         *  data container
         */
        const profile: InstagramProfile = {
            url: "",
            profileName: "",
            timeline: [],
            timelineFiles: [],
            igtv: [],
            igtvFiles: [],
        };

        // init puppeteer 
        const browser = await puppeteer.launch({
            headless: false,
            executablePath: executablePaths[process.platform],
            defaultViewport: undefined,
        });

        const page = await browser.newPage();

        // start scraping at when loaded
        page.on('load', async () => {
            console.log("page loaded @", page.url());
            const cookies = await page.cookies();
            await fs.ensureDir(INSTAGRAM_DATA_DIR);
            await fs.writeJSON(INSTAGRAM_COOKIES_FILENAME, cookies);

            // check if the igtv page loaded
            const pageUrl = page.url();
            if (pageUrl.indexOf(getPureProfileUrl(igtvUrl)) === 0) {

                // start auto scroll to activate HTTPRequest for video page shortcode scraping
                await autoScroll(page);
                // scroll ended, return data
                await sleep(1000);

                // load igtv video page to scrape video urls
                const p = await browser.newPage();
                if (fs.existsSync(INSTAGRAM_COOKIES_FILENAME)) {
                    const cookies = await fs.readJSON(INSTAGRAM_COOKIES_FILENAME);
                    await p.setCookie(...cookies);
                }
                // await p.goto(igtvUrl);
                for (let i = 0; i < profile.igtv.length; i++) {
                    try {
                        await sleep(1000);
                        const igtv = profile.igtv[i];
                        const videoUrl = await scrapeIGTVVideo({ tvUrl: getIGTVUrl(igtv), page: p });
                        profile.igtvFiles.push(videoUrl);
                    } catch (e) {
                        console.error(e);
                    }
                }
                resolve(profile);
                await browser.close();
            }
        });

        // Read edge_felix_video_timeline from HTTPResponse
        page.on('response', async (resp: HTTPResponse) => {
            if (page.url().indexOf(getProfileName(igtvUrl)!) > 0) {
                try {
                    const networkUrl = resp.url();
                    const querystring = networkUrl.split('?')[1];
                    const { query_hash } = qs.parse(querystring);
                    if (query_hash) {
                        console.log(query_hash);
                        const igResp = (await resp.json()) as InstagramQueryResponse;
                        const edges = igResp?.data?.user?.edge_felix_video_timeline?.edges;
                        edges?.forEach(({ node }) => {
                            profile.igtv.push(node);
                            profile.igtvFiles.push(node.display_url);
                        });
                    }
                } catch (e) {
                    console.error(e);
                }
            } else {
                console.log(page.url());
            }
        });

        if (fs.existsSync(INSTAGRAM_COOKIES_FILENAME)) {
            const cookies = await fs.readJSON(INSTAGRAM_COOKIES_FILENAME);
            await page.setCookie(...cookies);
        }
        await page.goto(igtvUrl).catch(e => console.log('catch'));
    });

}

/**
 * Scrape IGTV Video url from video page
 * @param tvUrl {string} tv url
 * @param page {puppeteer.Page} reused puppeteer browser page
 */
const scrapeIGTVVideo = async ({ tvUrl, page }: { tvUrl: string, page: puppeteer.Page }) => {
    return new Promise<string>(async (resolve, reject) => {
        let timeout = setTimeout(() => reject(`timeout: ${tvUrl}`), 5000);
        page.on('request', async (req: HTTPRequest) => {
            if (page.url().indexOf('https://www.instagram.com/tv/') === 0) {
                if (req.resourceType() === 'media') {
                    let mediaUrl = req.url();
                    if (mediaUrl.indexOf('.mp4') > 0) {
                        clearTimeout(timeout);
                        resolve(mediaUrl);
                    }
                }
            }
        });
        await page.goto(tvUrl);
    })
}




/// types 

export interface Page_info {
    has_next_page: boolean;
    end_cursor: string;
}

export interface Dimensions {
    height: number;
    width: number;
}

export interface Display_resources {
    src: string;
    config_width: number;
    config_height: number;
}

export interface MediaCaptionEdgeNode {
    text: string;
}

export interface MediaCaptionEdge {
    node: MediaCaptionEdgeNode;
}

export interface Edge_media_to_caption {
    edges: MediaCaptionEdge[];
}

export interface Location {
    id: string;
    has_public_page: boolean;
    name: string;
    slug: string;
}

export interface DisplayResources {
    src: string;
    config_width: number;
    config_height: number;
}

export interface Edge_sidecar_to_children {
    edges?: Edges[];
}

export interface Owner {
    id: string;
    username: string;
}

export interface InstagramTimelineNode {
    __typename: string | 'GraphImage' | 'GraphVideo' | 'GraphSidecar';
    id: string;
    dimensions: Dimensions;
    display_url: string;
    display_resources?: DisplayResources[];
    is_video: boolean;
    video_url: string;
    shortcode: string;
    accessibility_caption: string;
    edge_media_to_caption?: Edge_media_to_caption;
    taken_at_timestamp: number;
    location: Location;
    edge_sidecar_to_children?: Edge_sidecar_to_children;
    owner: Owner;
}

export interface Edges {
    node: InstagramTimelineNode;
}

export interface Timeline {
    page_info: Page_info;
    count?: number;
    edges?: Edges[];
}

export interface User {
    id: string;
    profile_pic_url: string;
    username: string;
    edge_web_feed_timeline?: Timeline;
    edge_owner_to_timeline_media?: Timeline;
    edge_felix_video_timeline?: Timeline;
}

export interface Data {
    user?: User;
}

export interface InstagramQueryResponse {
    data?: Data;
    status: string;
}

export interface InstagramProfile {
    url: string;
    profileName?: string;
    timeline: InstagramTimelineNode[];
    timelineFiles: string[];
    igtv: InstagramTimelineNode[];
    igtvFiles: string[];
}
