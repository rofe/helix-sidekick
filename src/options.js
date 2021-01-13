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
  getGitHubSettings,
  getMountpoints,
  t,
} from './utils.js';

function getSidekickSettings(sidekickurl) {
  try {
    const params = new URLSearchParams(new URL(sidekickurl).search);
    const giturl = params.get('giturl');
    // check gh url
    if (!getGitHubSettings(giturl).length === 3) {
      throw new Error();
    }
    return {
      giturl,
      host: params.get('host'),
      project: params.get('project'),
    }
  } catch (e) {
    return {};
  }
}

function getInnerHost(owner, repo, ref) {
  return `${ref === 'master' ? '' : `${ref}--`}${repo}--${owner}.hlx.page`;
}

function validShareURL(shareurl) {
  return Object.keys(getSidekickSettings(shareurl)).length === 3;
}

function validGitHubURL(giturl) {
  return giturl.startsWith('https://github.com')
    && Object.keys(getGitHubSettings(giturl)).length === 3;
}

async function addConfig({ giturl, host, project }, cb) {
  const { owner, repo, ref } = getGitHubSettings(giturl);
  const mountpoints = await getMountpoints(owner, repo, ref);
  getState(({ configs }) => {
    if (!configs.find((cfg) => owner === cfg.owner && repo === cfg.repo && ref === cfg.ref)) {
      configs.push({
        giturl,
        owner,
        repo,
        ref,
        mountpoints,
        host,
        project,
      });
      chrome.storage.sync.set({ hlxSidekickConfigs: configs }, () => {
        if (typeof cb === 'function') cb(true);
      });
    } else {
      alert(t('config_project_exists'));
      if (typeof cb === 'function') cb(false);
    }
  });
}

function shareConfig(i, evt) {
  chrome.storage.sync.get('hlxSidekickConfigs', ({ hlxSidekickConfigs = [] }) => {
    const config = hlxSidekickConfigs[i];
    const shareUrl = new URL('https://www.hlx.page/tools/sidekick/');
    shareUrl.search = new URLSearchParams([
      ['project', config.project || ''],
      ['host', config.host || ''],
      ['giturl', `https://github.com/${config.owner}/${config.repo}${config.ref ? `/tree/${config.ref}` : ''}`],
    ]).toString();
    if (navigator.share) {
      navigator.share({
        title: t('config_shareurl_share_title', [config.project || config.host || config.innerHost]),
        url: shareUrl.toString(),
      });
    } else {
      navigator.clipboard.writeText(shareUrl.toString());
      evt.target.classList.add('success');
      evt.target.title = t('config_shareurl_copied', [config.project || config.host || config.innerHost]);
      window.setTimeout(() => {
        evt.target.classList.remove('success');
        evt.target.title = 'Share';
      }, 3000);
    }
  });
}

function editConfig(i) {
  chrome.storage.sync.get('hlxSidekickConfigs', ({ hlxSidekickConfigs = [] }) => {
    const config = hlxSidekickConfigs[i];
    const pos = document.querySelectorAll('section.config')[i].getBoundingClientRect();
    const editor = document.getElementById('configEditor');
    const close = () => {
      // hide editor and blanket
      editor.classList.add('hidden');
      document.getElementById('blanket').classList.add('hidden');
      // unregister esc handler
      window.removeEventListener('keyup', escHandler);
    };
    const escHandler = (evt) => {
      if (evt.key === 'Escape') {
        close();
      }
    };
    const buttons = editor.querySelectorAll('button');
    // wire save button
    buttons[0].addEventListener('click', async () => {
      Object.keys(config).forEach((key) => {
        const field = document.getElementById(`edit-${key}`);
        if (field) {
          config[key] = field.value;
        }
      });
      const { owner, repo, ref } = getGitHubSettings(config.giturl);
      const mountpoints = await getMountpoints(owner, repo, ref);
      hlxSidekickConfigs[i] = {
        ...config,
        owner,
        repo,
        ref,
        mountpoints,
      };
      chrome.storage.sync.set({
        hlxSidekickConfigs
      }, () => {
        drawConfigs();
        close();
      });
    });
    // wire cancel button
    buttons[1].addEventListener('click', close);
    document.querySelector('main').appendChild(editor);
    // fill form
    document.getElementById('edit-giturl').value = config.giturl;
    document.getElementById('edit-host').value = config.host;
    document.getElementById('edit-project').value = config.project;
    // position and show editor
    editor.classList.remove('hidden');
    editor.style.top = `${pos.top - 36}px`;
    editor.style.left = `${pos.left - 10}px`;
    document.getElementById('blanket').classList.remove('hidden');
    // focus first field
    const firstField = editor.querySelector('input, textarea');
    firstField.focus();
    firstField.select();
    // register esc handler
    window.addEventListener('keyup', escHandler);
  });
}

function deleteConfig(i) {
  if (confirm(t('config_delete_project_confirm'))) {
    chrome.storage.sync.get('hlxSidekickConfigs', ({ hlxSidekickConfigs = [] }) => {
      hlxSidekickConfigs.splice(i, 1);
      chrome.storage.sync.set({ hlxSidekickConfigs }, () => {
        drawConfigs();
      })
    });
  }
}

function drawLink(url) {
  let text = url;
  if (url.includes('sharepoint')) text = 'SharePoint';
  if (url.includes('drive')) text = 'Google Drive';
  return `<a href="https://${url}/" title="${url}" target="_blank">${text}</a>`;
}

function drawConfigs() {
  getState(({ configs = [] }) => {
    const container = document.getElementById('configs');
    container.innerHTML = '';
    configs.forEach(({ owner, repo, ref, mountpoints, host, project }, i) => {
      const innerHost = getInnerHost(owner, repo, ref);
      const section = document.createElement('section');
      section.className = 'config';
      section.innerHTML = `
  <div>
    <h4>${project || 'Helix Project'}</h4>
    ${host ? `<p>${t('config_project_host')}: ${drawLink(host)}</p>` : ''}
    <p>${t('config_project_innerhost')}: ${drawLink(innerHost)}</p>
    ${
      mountpoints.length
        ? `<p>${t('config_project_mountpoints')}: ${mountpoints.map((mp) => drawLink(mp)).join(' ')}</p>`
        : ''
    }
  </div>
  <div>
    <button class="shareConfig" title="${t('config_share')}">${t('config_share')}</button>
    <button class="editConfig" title="${t('config_edit')}">${t('config_edit')}</button>
    <button class="deleteConfig" title="${t('config_delete')}">${t('config_delete')}</button>
  </div>`;
      container.appendChild(section);
    });
    document.querySelectorAll('button.shareConfig').forEach((button, i) => {
      button.addEventListener('click', (evt) => shareConfig(i, evt));
    });
    document.querySelectorAll('button.editConfig').forEach((button, i) => {
      button.addEventListener('click', (evt) => editConfig(i, evt));
    });
    document.querySelectorAll('button.deleteConfig').forEach((button, i) => {
      button.addEventListener('click', (evt) => deleteConfig(i, evt));
    });
  });
}

function clearForms() {
  document.querySelectorAll('input, textarea').forEach((field) => field.value = '');
}

window.addEventListener('DOMContentLoaded', () => {
  // i18n
  document.body.innerHTML = document.body.innerHTML
    .replaceAll(/__MSG_([0-9a-zA-Z_]+)__/g, (match, msg) => t(msg));
  drawConfigs();

  document.getElementById('resetButton').addEventListener('click', () => {
    if (confirm(t('config_delete_all_confirm'))) {
      chrome.storage.sync.clear(() => {
        chrome.storage.local.clear(() => {
          drawConfigs();
        });
      });
    }
  });

  document.getElementById('addShareConfigButton').addEventListener('click', async () => {
    const shareurl = document.getElementById('shareurl').value;
    // check share url
    if (validShareURL(shareurl)) {
      await addConfig(getSidekickSettings(shareurl), (added) => {
        if (added) {
          drawConfigs();
          clearForms();
        }
      });
    } else {
      return alert(t('config_invalid_shareurl'));
    }
  });

  document.getElementById('addManualConfigButton').addEventListener('click', async () => {
    const giturl = document.getElementById('giturl').value;
    if (validGitHubURL(giturl)) {
      await addConfig({
        giturl,
        host: document.getElementById('host').value,
        project: document.getElementById('project').value,
      }, (added) => {
        if (added) {
          drawConfigs();
          clearForms();
        }
      });
    } else {
      return alert(t('config_invalid_giturl'));
    }
  });
});
