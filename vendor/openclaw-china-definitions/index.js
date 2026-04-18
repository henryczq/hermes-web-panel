import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const DATA_PACKAGE_DIR = __dirname;
export const REGISTRY_PATH = path.join(DATA_PACKAGE_DIR, 'channel-plugins.registry.json');
export const DETAILS_DIR = path.join(DATA_PACKAGE_DIR, 'channel-plugin-details');
export const REFERENCES_DIR = path.join(DATA_PACKAGE_DIR, 'references');
export const EXAMPLES_PATH = path.join(REFERENCES_DIR, 'channel-examples.json');
export const OVERVIEW_PATH = path.join(REFERENCES_DIR, 'overview.md');

export function getChannelPluginDetailPath(detailId) {
  return path.join(DETAILS_DIR, `${detailId}.json`);
}

export function getReferencePath(fileName) {
  return path.join(REFERENCES_DIR, fileName);
}
