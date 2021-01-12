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

import {
  getState,
  getConfig,
  toggleDisplay,
  t,
  _noop,
} from './utils.js';

export function checkTab(id, forceToggle, cb) {
  getState(({ display, configs }) => {
    chrome.tabs.get(id, (tab = {}) => {
      const allowed = tab.url && getConfig(configs, tab.url);
      // enable/disable browser action
      try {
        allowed
          ? chrome.browserAction.enable(id, ()=> {
            // change title based on display
            chrome.browserAction.setTitle({
              title: display ? t('title_hide') : t('title_show'),
            }, _noop);
          })
          : chrome.browserAction.disable(id, () => {
            // reset title
            chrome.browserAction.setTitle({
              tabId: id,
              title: chrome.runtime.getManifest().browser_action.default_title,
            }, _noop);
          });
      } catch (e) {
      }
      // check if sidekick needs to be loaded
      if (allowed && (forceToggle || display)) {
        if (forceToggle) {
          toggleDisplay();
        }
        // inject/refresh sidekick
        chrome.tabs.executeScript(id, {
          file: 'content.js',
        }, _noop);
      }
      if (typeof cb === 'function') cb(allowed);
    });
  });
}

// toggle the sidekick when the browser action is clicked
chrome.browserAction.onClicked.addListener(({ id }) => {
  checkTab(id, true);
});

// listen for url updates in any tab and inject sidekick if must be shown
chrome.tabs.onUpdated.addListener((id, info) => {
  // wait until the tab is done loading
  if (info.status === 'complete') {
    checkTab(id);
  }
});

chrome.tabs.onActivated.addListener(({ tabId: id }) => {
  checkTab(id);
});

chrome.storage.onChanged.addListener(({ hlxSidekickDisplay = null }, area) => {
  if (area === 'local' && hlxSidekickDisplay) {
    const display = hlxSidekickDisplay.newValue;
    // change title based on display
    chrome.browserAction.setTitle({
      title: display ? t('title_hide') : t('title_show'),
    }, _noop);
    // if hidden, attempt to hide existing sidekicks in other tabs
    chrome.tabs.query({
      currentWindow: true,
    }, (tabs) => {
      tabs.forEach(({ id, active = false, url = '' }) => {
          if (active) return; // skip current tab
          checkTab(id, false, (allowed) => {
            if (allowed) {
              // inject/refresh sidekick
              chrome.tabs.executeScript(id, {
                file: 'content.js',
              }, _noop);
            }
          });
        });
    });
  }
});
