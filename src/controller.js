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
  setDisplay,
  t,
}  from './utils.js';

function removeConfigPicker() {
  const picker = document.getElementById('hlx-sk-picker');
  if (picker) picker.remove();
  document.removeEventListener('keyup', pickConfigByKey);
}

function pickConfigByClick({ target }) {
  inject(target.id);
  removeConfigPicker();
}

function pickConfigByKey(e) {
  if (e.keyCode > 48 && e.keyCode < 58) {
    // number between 1 - 9
    const num = parseInt(e.key);
    try {
      // get config id from button
      inject(document.querySelectorAll('.hlx-sk > button.config')[num - 1].id);
      removeConfigPicker();
    } catch (e) {}
  } else if (e.key === 'Escape') {
    setDisplay(false);
    removeConfigPicker();
  }
}

function injectSidekick(config, display) {
  // reduce config to only include properties relevant for sidekick
  config = config
    ? Object.fromEntries(Object.entries(config)
        .filter(([k]) => ['owner', 'repo', 'ref', 'host', 'project'].includes(k)))
    : undefined;
  let ctrl = document.getElementById('hlx-sk-ctrl');
  if (ctrl) {
    ctrl.remove();
  }
  // inject sidekick
  ctrl = document.head.appendChild(document.createElement('script'));
  ctrl.id = 'hlx-sk-ctrl';
  ctrl.textContent = `/* ** Helix Sidekick Controller ** */
(() => {
  window.hlx = window.hlx || {};
  if (!window.hlx.sidekick) {
    ${config ? `
    window.hlx.sidekickConfig = ${JSON.stringify(config)};
    const script = document.createElement("script");
    script.src = "https://www.hlx.page/tools/sidekick/app.js";
    ${!display ? 'script.addEventListener("load", () => window.hlx.sidekick.toggle())' : ''}
    document.head.appendChild(script);` : ''}
  } else if (${display ? '' : '!'}document.querySelector(".hlx-sk.hlx-sk-hidden")) {
    window.hlx.sidekick.toggle();
  }
})();`;

  // monitor if user manually closes sidekick
  if (window.hlxSidekickCheckState) {
    window.clearInterval(window.hlxSidekickCheckState);
  }
  window.hlxSidekickCheckState = window.setInterval(() => {
    try {
      if (document.querySelector(".hlx-sk-hidden") && display) {
        setDisplay(false, () => {;
          window.clearInterval(window.hlxSidekickCheckState);
        });
      }
    } catch (e) {
      window.clearInterval(window.hlxSidekickCheckState);
    }
  }, 500);
}

function injectConfigPicker(configs, config, matches, display) {
  // todo: proper UI
  let picker = document.getElementById('hlx-sk-picker');
  if (display && !config && !picker) {
    if (!document.getElementById('hlx-sk-picker-styles')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.id = 'hlx-sk-cfg-picker-styles';
      link.href = 'https://www.hlx.page/tools/sidekick/app.css';
      document.head.appendChild(link);
    }
    picker = document.createElement('div');
    picker.id = 'hlx-sk-picker';
    picker.className = 'hlx-sk';
    const label = document.createElement('span');
    label.textContent = t('config_project_pick');
    label.style = 'opacity:0.6;line-height:30px;margin: 10px 10px 0 0';
    picker.appendChild(label);
    matches.splice(0, 8).forEach((match, i) => {
      const { id, project } = configs.find((config) => config.id === match);
      const btn = document.createElement('button');
      btn.id = `${id}`;
      btn.className = 'config';
      btn.textContent = `${project || id} (${i+1})`;
      btn.addEventListener('click', pickConfigByClick);
      picker.appendChild(btn);
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'close';
    closeBtn.textContent = '✕';
    closeBtn.title = t('cancel');
    closeBtn.addEventListener('click', () => {
      setDisplay(false);
      removeConfigPicker();
    });
    picker.appendChild(closeBtn);
    document.body.append(picker);
    document.addEventListener('keyup', pickConfigByKey);
  } else if (!display) {
    removeConfigPicker();
  }
}

export function inject(id = window.hlxSidekickConfigId) {
  getState(({ configs, display }) => {
    if (id) {
      // remember user choice
      window.hlxSidekickConfigId = id;
    }
    const matches = id ? [id] : getConfigMatches(configs, window.location.href);
    if (matches.length === 0) return;
    // get config if single match
    const config = matches.length === 1
      ? configs.find((config) => config.id === matches[0])
      : undefined;
    if (config) {
      injectSidekick(config, display);
    } else {
      injectConfigPicker(configs, config, matches, display);
    }
  });
}
