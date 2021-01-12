/*
 * Copyright 2021 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
'use strict';

// default callback to prevent unchecked runtime.lastError
export function _noop() {
  return void chrome.runtime.lastError;
}

// translate: shorthand for chrome.i18n.getMessage()
export function t(msg, subs, opts) {
  return chrome.i18n.getMessage(msg, subs, opts);
}

export function getGitHubSettings(giturl) {
  try {
    const segs = new URL(giturl).pathname.substring(1).split('/');
    if (segs.length < 2) {
      // need at least owner and repo
      throw new Error();
    }
    return {
      owner: segs[0],
      repo: segs[1],
      ref: (segs[2] === 'tree' ? segs[3] : undefined) || 'master',
    };
  } catch (e) {
    return {};
  }
}

export async function getMountpoints(owner, repo, ref) {
  const fstab = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/fstab.yaml`;
  const res = await fetch(fstab);
  if (res.ok) {
    const { mountpoints = {} } = jsyaml.load(await res.text());
    return Object.values(mountpoints);
  }
  return [];
}

export function getConfig(configs, url) {
  const checkHost = new URL(url).host;
  return configs.find(({ owner, repo, host, mountpoints }) => {
    return ((host && checkHost === host) // production host
      || checkHost.endsWith(`${repo}--${owner}.hlx.live`) // outer CDN
      || checkHost.endsWith(`${repo}--${owner}.hlx.page`) // inner CDN
      || mountpoints // editor
        .map((mp) => {
          const mpUrl = new URL(mp);
          return [mpUrl.host, mpUrl.pathname];
        })
        .find(([mpHost, mpPath]) => {
          if (checkHost === mpHost) {
            if (mpHost.includes('sharepoint.com')) {
              if (mpPath.startsWith('/sites')) {
                // sharepoint, check for site name in path
                const site = encodeURIComponent(mpPath.split('/')[2]);
                return new URL(url).pathname.includes(`:/r/sites/${site}/`);
              }
            }
            // assume host check is sufficient
            return true;
          }
          return false;
        }));
  });
}

export function getState(cb) {
  if (typeof cb === 'function') {
    chrome.storage.local.get('hlxSidekickDisplay', ({ hlxSidekickDisplay = false }) => {
      chrome.storage.sync.get('hlxSidekickConfigs', ({ hlxSidekickConfigs = [] }) => {
        cb({
          display: hlxSidekickDisplay,
          configs: hlxSidekickConfigs,
        }, chrome);
      });
    });
  }
}

export function setDisplay(display, cb) {
  chrome.storage.local.set({
    hlxSidekickDisplay: display,
  }, () => {
    if (typeof cb === 'function') cb(display);
  });
}

export function toggleDisplay(cb) {
  getState(({ display }) => {
    setDisplay(!display, cb);
  });
}
