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
  setDisplay,
}  from './utils.js';

export function inject() {
  getState ? getState(({ display, configs }, _chrome) => {
    const config = getConfig(configs, window.location.href);
    if (config) {
      // inject/refresh sidekick controller
      let ctrl = document.getElementById('hlx-sk-ctrl');
      if (ctrl) {
        ctrl.remove();
      }
      ctrl = document.head.appendChild(document.createElement('script'));
      ctrl.id = 'hlx-sk-ctrl';
      ctrl.textContent = [
        '/* ** Helix Sidekick Controller ** */',
        '(()=>{window.hlx=window.hlx||{};',
        'if(!window.hlx.sidekick){',
          `window.hlx.sidekickConfig=${JSON.stringify(config)};`,
          'document.head.appendChild(document.createElement("script")).src="https://www.hlx.page/tools/sidekick/app.js";',
        '}else{',
          `${display ? 'if(document.querySelector(".hlx-sk-hidden"))' : ''}`,
          'window.hlx.sidekick.toggle();',
        '}',
        '})();',
      ].join('');

      // monitor if user closes sidekick
      const checkState = window.setInterval(() => {
        try {
          if (document.querySelector(".hlx-sk-hidden")) {
            setDisplay(false, () => {;
              window.clearInterval(checkState);
            });
          } else if (document.querySelector('.hlx-sk') && !display) {
            setDisplay(true);
          }
        } catch (e) {
          window.clearInterval(checkState);
        }
      }, 1000);
    } else {
      setDisplay(false);
    }
  }) : null;
}
