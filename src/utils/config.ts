import fs from 'fs-extra';
import path from "path";
import {APP_DATA_DIR} from "./paths";

export const CONFIG_FILEPATH = path.join(APP_DATA_DIR, 'config.json');

export const getConfig = (): any => {
    return fs.existsSync(CONFIG_FILEPATH) ? fs.readJSONSync(CONFIG_FILEPATH) : {};
}

export const setConfig = ({key, value}: { key: string, value?: any }) => {
    const config = getConfig();
    if (value) {
        config[key] = value;
    } else {
        delete config[key];
    }
    fs.outputJSONSync(CONFIG_FILEPATH, config);
    return config;
}
