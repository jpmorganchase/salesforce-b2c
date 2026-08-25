/** @file Thumbprint Generator UI */
(function () {
    'use strict';

    var $config = document.getElementById('thumbprintConfig');
    if (!$config) { return; }

    var $genBtnEarly = document.getElementById('genBtn');

    /**
     * abortInit
     */
    function abortInit() {
        if ($genBtnEarly) { $genBtnEarly.disabled = true; }
    }

    if ($config.getAttribute('aria-hidden') !== 'true') {
        abortInit();
        return;
    }

    var getCertUrl = $config.getAttribute('data-get-cert-url') || '';
    var saveUrl    = $config.getAttribute('data-save-url') || '';
    var siteId     = $config.getAttribute('data-site-id') || '';
    var csrfGet    = $config.getAttribute('data-csrf-get') || '';
    var csrfSave   = $config.getAttribute('data-csrf-save') || '';

    if (!getCertUrl || !saveUrl || !siteId || !csrfGet || !csrfSave) {
        abortInit();
        return;
    }

    // Enforce same-origin policy on server-provided URLs
    var _origin = window.location.origin;
    if (getCertUrl.indexOf('http') === 0 && getCertUrl.indexOf(_origin) !== 0) {
        abortInit();
        return;
    }
    if (saveUrl.indexOf('http') === 0 && saveUrl.indexOf(_origin) !== 0) {
        abortInit();
        return;
    }

    $config.removeAttribute('data-get-cert-url');
    $config.removeAttribute('data-save-url');
    $config.removeAttribute('data-csrf-get');
    $config.removeAttribute('data-csrf-save');
    $config.removeAttribute('data-site-id');

    var i18n = Object.freeze({
        errorCertRequired: $config.getAttribute('data-i18n-error-cert-required') || '',
        errorKeyRequired:  $config.getAttribute('data-i18n-error-key-required') || '',
        btnRetrieving:     $config.getAttribute('data-i18n-btn-retrieving') || '',
        btnComputing:      $config.getAttribute('data-i18n-btn-computing') || '',
        btnSaving:         $config.getAttribute('data-i18n-btn-saving') || '',
        btnDefault:        $config.getAttribute('data-i18n-btn-default') || '',
        successSaved:      $config.getAttribute('data-i18n-success-saved') || '',
        errorCertNotFound: $config.getAttribute('data-i18n-error-cert-not-found') || '',
        errorSha1Failed:   $config.getAttribute('data-i18n-error-sha1-failed') || '',
        errorCertDecode:   $config.getAttribute('data-i18n-error-cert-decode') || '',
        errorNetwork:      $config.getAttribute('data-i18n-error-network') || '',
        errorParse:        $config.getAttribute('data-i18n-error-parse') || '',
        errorSaveFailed:   $config.getAttribute('data-i18n-error-save-failed') || ''
    });

    var $cert      = document.getElementById('certAlias');
    var $key       = document.getElementById('keyAlias');
    var $gen       = document.getElementById('genBtn');
    var $results   = document.getElementById('resultsTable');
    var $hex       = document.getElementById('hexResult');
    var $msgBox    = document.getElementById('msgBox');
    var $msgTable  = document.getElementById('msgTable');
    var $msgContent = document.getElementById('msgContent');
    var $locale    = document.getElementById('localeSelect');
    var $hint      = document.getElementById('scopeHint');
    var $curCert   = document.getElementById('curCertAlias');
    var $curKey    = document.getElementById('curKeyAlias');
    var $curKidRow = document.getElementById('curKidRow');

    if (!$cert || !$key || !$gen || !$results || !$hex || !$msgBox || !$msgTable || !$msgContent || !$locale || !$hint || !$curCert || !$curKey || !$curKidRow) { return; }

    var _aliasPattern = /^[a-zA-Z0-9_-]{1,100}$/;
    var _b64Pattern   = /^[A-Za-z0-9+/]+=*$/;

    /**
     * Returns the configKey for the currently selected scope from the server-rendered data attribute.
     * @returns {string} config key for selected locale
     */
    function resolveConfigKey() {
        var opt = $locale.options[$locale.selectedIndex];
        return opt ? (opt.getAttribute('data-configkey') || '') : '';
    }

    /**
     * Fired on locale selector change and once on page load.
     */
    function onScopeChange() {
        var opt       = $locale.options[$locale.selectedIndex];
        var certVal   = opt.getAttribute('data-cert')   || '';
        var keyVal    = opt.getAttribute('data-key')    || '';
        var hasCO     = opt.getAttribute('data-has-co') === 'true';
        var hasKid    = !!(opt.getAttribute('data-kid'));
        var locale    = $locale.value;
        var configKey = opt.getAttribute('data-configkey') || '';

        $curCert.textContent = certVal || '\u2014';
        $curKey.textContent  = keyVal  || '\u2014';
        $curKidRow.style.display = hasKid ? '' : 'none';

        $cert.value = certVal;
        $key.value  = keyVal;

        if (!locale) {
            $hint.textContent = 'Thumbprint will be saved to the site-level jpmc_kid site preference.';
        } else if (hasCO) {
            $hint.textContent = 'Scope: ' + configKey +
                (hasKid ? ' \u2014 KID already configured. Generating will overwrite it.'
                    : ' \u2014 KID not yet set for this config.');
        } else {
            $hint.textContent = 'No merchant config exists for locale "' + locale +
                '" yet. A new Custom Object (' + siteId + '::' + locale +
                ') will be created automatically when you save.';
        }
    }

    if ($locale) {
        $locale.onchange = onScopeChange;
        onScopeChange();
    }

    /**
     * @param {string} text - message text to display
     * @param {string} type - message type (error or info)
     */
    function showMsg(text, type) {
        $msgContent.textContent = text;
        $msgBox.className = '';
        $msgTable.className = 'info-section ' + ((type === 'error') ? 'error_box' : 'alert alert-info');
    }

    /**
     * hideMsg
     */
    function hideMsg() {
        $msgBox.className = 'hidden';
    }

    /**
     * @param {string} url - endpoint URL
     * @param {string} data - URL-encoded POST body
     * @param {Function} cb - success callback
     */
    function post(url, data, cb) {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhr.onload = function () {
            try { cb(JSON.parse(xhr.responseText)); }
            catch (e) { cb({ success: false }); }
        };
        xhr.onerror = function () { cb({ success: false }); };
        xhr.send(data);
    }

    $gen.onclick = function () {
        hideMsg();
        var cert = $cert.value.trim();
        var key  = $key.value.trim();

        if (!cert) { showMsg(i18n.errorCertRequired, 'error'); $cert.focus(); return; }
        if (!key)  { showMsg(i18n.errorKeyRequired,  'error'); $key.focus();  return; }

        if (!_aliasPattern.test(cert)) { showMsg(i18n.errorCertNotFound, 'error'); return; }
        if (!_aliasPattern.test(key))  { showMsg(i18n.errorKeyRequired,  'error'); return; }

        $gen.disabled = true;
        $gen.textContent = i18n.btnRetrieving;
        $results.classList.add('hidden');
        $hex.textContent = '';

        post(getCertUrl, 'certAlias=' + encodeURIComponent(cert) + '&' + csrfGet, function (r) {
            if (!r.success || !r.derBase64 || typeof r.derBase64 !== 'string' || !_b64Pattern.test(r.derBase64)) {
                $gen.disabled = false;
                $gen.textContent = i18n.btnDefault;
                showMsg(i18n.errorCertNotFound, 'error');
                return;
            }

            $gen.textContent = i18n.btnComputing;
            var derData = r.derBase64;
            r.derBase64 = null;

            var timeoutId = setTimeout(function () {
                $gen.disabled = false;
                $gen.textContent = i18n.btnDefault;
                showMsg(i18n.errorSha1Failed + ': Operation timeout', 'error');
            }, 10000);

            try {
                var bin = atob(derData);
                derData = null; 
                var bytes = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
                bin = null;

                crypto.subtle.digest('SHA-1', bytes).then(function (hash) {
                    clearTimeout(timeoutId);
                    bytes = null;
                    var arr = new Uint8Array(hash);
                    var hex = '';
                    for (var j = 0; j < arr.length; j++) {
                        hex += ('0' + arr[j].toString(16)).slice(-2);
                    }
                    var kid = hex.toUpperCase();
                    arr = null;

                    var selectedConfigKey = resolveConfigKey();
                    var saveData = 'kid=' + encodeURIComponent(kid) +
                        '&certAlias=' + encodeURIComponent(cert) +
                        '&privateKeyAlias=' + encodeURIComponent(key) +
                        '&configKey=' + encodeURIComponent(selectedConfigKey) +
                        '&' + csrfSave;

                    $gen.textContent = i18n.btnSaving;

                    post(saveUrl, saveData, function (s) {
                        saveData = null;
                        kid = null;     
                        $gen.disabled = false;
                        $gen.textContent = i18n.btnDefault;
                        if (s.success) {
                            $hex.textContent = '\u2022'.repeat(40) + ' (saved)';
                            $results.classList.remove('hidden');
                            showMsg(i18n.successSaved, 'success');
                            if ($curKidRow) { $curKidRow.style.display = ''; }
                            setTimeout(function () { window.location.reload(); }, 1800);
                        } else {
                            showMsg((s && s.message) ? s.message : i18n.errorSaveFailed, 'error');
                        }
                    });
                }).catch(function (err) {
                    clearTimeout(timeoutId);
                    derData = null;
                    $gen.disabled = false;
                    $gen.textContent = i18n.btnDefault;
                  
                    if (err && err.message && err.message.indexOf('timeout') !== -1) {
                        showMsg(i18n.errorSha1Failed + ': Operation timeout', 'error');
                    } else {
                        showMsg(i18n.errorSha1Failed, 'error');
                    }
                });
            } catch (e) {
                clearTimeout(timeoutId);
                derData = null; 
                $gen.disabled = false;
                $gen.textContent = i18n.btnDefault;
                showMsg(i18n.errorSha1Failed, 'error');
            }
        });
    };
})();

