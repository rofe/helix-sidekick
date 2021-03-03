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
  getConfigMatches,
  toggleDisplay,
  _noop,
} from './utils.js';

export function toggle(id, cb) {
  toggleDisplay();
  checkTab(id, cb);
}

export function checkTab(id, cb) {
  getState(({ display, configs }) => {
    chrome.tabs.get(id, (tab = {}) => {
      if (chrome.runtime.lastError) {
        console.log('error', chrome.runtime.lastError);
        return;
      }
      const allowed = tab.url && getConfigMatches(configs, tab.url).length;
      if (allowed) {
        // enable browser action for this tab
        chrome.pageAction.show(id, _noop);
        // inject/refresh sidekick in tab
        chrome.tabs.executeScript(id, {
          file: 'content.js',
        }, _noop);
      } else {
        // disable action for this tab
        chrome.pageAction.hide(id, _noop);
      }
      if (typeof cb === 'function') cb(allowed);
    });
  });
}

export function addListeners() {
  // toggle the sidekick when the browser action is clicked
  chrome.pageAction.onClicked.addListener(({ id }) => {
    toggle(id);
  });

  // listen for url updates in any tab and inject sidekick if must be shown
  chrome.tabs.onUpdated.addListener((id, info) => {
    // wait until the tab is done loading
    if (info.status === 'complete') {
      checkTab(id);
    }
  });

  // re-check tabs when activated
  chrome.tabs.onActivated.addListener(({ tabId: id }) => {
    checkTab(id);
  });

  // detect and propagate display changes
  chrome.storage.onChanged.addListener(({ hlxSidekickDisplay = null }, area) => {
    if (area === 'local' && hlxSidekickDisplay) {
      const display = hlxSidekickDisplay.newValue;
      console.log(`sidekick now ${display ? 'shown' : 'hidden'}`);
      chrome.tabs.query({
        currentWindow: true,
      }, (tabs) => {
        tabs.forEach(({ id, url, active = false }) => {
          if (!active) {
            // skip current tab
            checkTab(id);
          }
        });
      });
    }
  });

  // fetch plugins from project
  chrome.runtime.onConnect.addListener((port) => {
    console.assert(port.name == chrome.runtime.id);
    port.onMessage.addListener(({ pluginsUrl }) => {
      if (pluginsUrl) {
        fetch(pluginsUrl)
          .then((response) => response.text())
          .then((code) => chrome.tabs.executeScript(port.sender.tab.id, { code }))
          .catch((error) => console.log('unable to load plugins', error));
      }
    });
  });
}

addListeners();
