import path from "path";
import http from "superagent";
import fs from "fs-extra";


require('superagent-proxy')(http);


interface DownloadTask {
    url: string;
    filename?: string;
}

interface DownloadFilesArgs {
    tasks: DownloadTask[];
    outputDir: string;
    proxy?: string;
}

/**
 * 
 * @param url File url
 */
const getFilenameFromUrl = (url: string) => {
    const split = url.split('?')[0].split('/');
    return split[split.length - 1];
}

const getDownloadOutputPath = ({outputDir, task}: { outputDir: string, task: DownloadTask }) => {
    const filename = task?.filename || getFilenameFromUrl(task.url);
    return path.join(outputDir, filename);
}

/**
 * Download album by album url
 * @param albumUrl
 * @param proxy
 */
export const downloadFiles = async ({tasks, proxy, outputDir}: DownloadFilesArgs) => {
    await fs.ensureDir(outputDir);
    for (let i = 0; i < tasks.length; i++) {
        try {
            const task = tasks[i];
            const filepath = getDownloadOutputPath({outputDir, task});
            if (!fs.existsSync(filepath)) {
                console.log('download:', task.url);
                const res = await http.get(task.url).proxy(proxy!);
                console.log('write file:', filepath);
                fs.writeFile(filepath, res.body, "binary").then();
            } else { // skip if exits
                console.log('exist file:', filepath);
            }
            console.log('progress:', `${i + 1}/${tasks.length}`);
        } catch (e) {
            console.error(e);
        }
    }
    console.log('dir:', outputDir)
}
