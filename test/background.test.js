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
/* eslint-env mocha */

'use strict';

const fs = require('fs-extra');
const path = require('path');
const sinon = require('sinon');
const chrome = require('sinon-chrome/extensions');
const { assert } = require('chai');
const { JSDOM } = require('jsdom');
const { Script } = require('vm');
const { addListeners, checkTab } = require('../src/background.js');

const sinonAssertAfter = async (delay = 2000) => new Promise((resolve) => {
  setTimeout(async () => {
    console.log('assert now!');
    resolve(sinon.assert);
  }, delay);
});

describe('test background page', () => {
  let window;
  const blogConfig = {
    owner: 'adobe',
    repo: 'theblog',
    ref: 'master',
    host: 'blog.adobe.com',
    innerHost: 'theblog--adobe.hlx.page',
    outerHost: 'theblog--adobe.hlx.live',
  };
  const bgScripts = [
    new Script([fs.readFileSync(path.join(__dirname, '../src/utils.js'), 'utf-8')]),
    new Script([fs.readFileSync(path.join(__dirname, '../src/background.js'), 'utf-8')]),
  ];
  const fakeState = (state = {}) => {
    window.getState = (cb) => {
      if (typeof cb === 'function') cb(state);
    };
  }

  before(() => {
    global.chrome = chrome;
  });

  beforeEach(() => {
    const bgPage = new JSDOM('<html></html>', {
      resources: 'usable',
      runScripts: 'dangerously',
    });
    window = bgPage.window;
    window.chrome = chrome;
    window.console = console;
    bgScripts.forEach((script) => bgPage.runVMScript(script));
    fakeState();
  });

  afterEach(() => {
    window.close();
  });

  after(() => {
    chrome.flush();
    delete global.chrome;
  });

  it.only('attaches listeners on startup', () => {
    // addListeners();
    sinon.assert.calledOnce(chrome.browserAction.onClicked.addListener);
    sinon.assert.calledOnce(chrome.tabs.onActivated.addListener);
    sinon.assert.calledOnce(chrome.tabs.onUpdated.addListener);
    sinon.assert.calledOnce(chrome.storage.onChanged.addListener);
  });

  it('checks tab when browser action is clicked', async () => {
    const tab = {
      id: 1234,
      url: 'https://blog.adobe.com/foo',
    };
    // spy on checkTab
    const spy = sinon.spy(window, 'checkTab');
    
    // click browser action with fake tab
    chrome.browserAction.onClicked.dispatch(tab);
    // checkTab must be called
    sinon.assert.called(spy);
    sinon.reset();
  });
});
