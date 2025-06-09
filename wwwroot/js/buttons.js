// Store this at the top of your buttons.js or in a shared scope
const PENDING_JOB_ID_KEY = 'pendingImageJobId';
let currentPollingJobId = null; // Tracks the jobId currently being polled by the client
let pollingIntervalId = null;   // To store the interval ID for polling
const POLLING_INTERVAL_MS = 5000; // 5 seconds
const SPINNER_ID = '#loading-spinner';
const IMAGE_DISPLAY_AREA_ID = '#image-display-area';
const GO_BUTTON_ID = '#go-button';
const RAND_BUTTON_ID = '#rand-button';
const DOWNLOAD_BUTTON_ID = '#download-image-button'; // Вече го имахме

function disableSubmitButtons(message = "Обработка...") {
    $(GO_BUTTON_ID).prop('disabled', true).text(message);
    $(RAND_BUTTON_ID).prop('disabled', true);
    // Consider disabling other inputs like prompt text, style selectors, settings panel
}

function enableSubmitButtons() {
    $(GO_BUTTON_ID).prop('disabled', false).text('GO');
    $(RAND_BUTTON_ID).prop('disabled', false);
    // Re-enable other inputs if they were disabled
}

function clearPendingJobState() {
    console.log("Clearing pending job state. Current polling ID:", currentPollingJobId);
    localStorage.removeItem(PENDING_JOB_ID_KEY);
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }
    currentPollingJobId = null; // Crucial to set this to null
    $(DOWNLOAD_BUTTON_ID).hide(); 
    // Изчистване на URL-а на Blob-а, ако има такъв
    const $imgElement = $(IMAGE_DISPLAY_AREA_ID).find('img');
    if ($imgElement.length && $imgElement.attr('src').startsWith('blob:')) {
        URL.revokeObjectURL($imgElement.attr('src'));
    }
    enableSubmitButtons();
}

function showSpinner() {
    $(SPINNER_ID).css({
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        position: 'absolute'
    }).show();
}

function hideSpinner() {
    $(SPINNER_ID).hide();
}

// Функция за конвертиране на base64 към Blob
function base64ToBlob(base64, contentType = 'image/png', sliceSize = 512) {
    console.log("base64ToBlob called. ContentType:", contentType, "Input base64 length:", base64 ? base64.length : "N/A");
    if (!base64 || typeof base64 !== 'string') {
        console.error("base64ToBlob: base64 input is null, undefined, or not a string.");
        throw new Error("Invalid base64 input to base64ToBlob");
    }
    try {
        const byteCharacters = atob(base64); // Проблемният ред, ако base64 не е валиден
        const byteArrays = [];

        for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
            const slice = byteCharacters.slice(offset, offset + sliceSize);
            const byteNumbers = new Array(slice.length);
            for (let i = 0; i < slice.length; i++) {
                byteNumbers[i] = slice.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            byteArrays.push(byteArray);
        }
        const blob = new Blob(byteArrays, { type: contentType });
        console.log("Blob created successfully. Size:", blob.size, "Type:", blob.type);
        return blob;
    } catch (e) {
        console.error("Error in base64ToBlob (likely atob call):", e.message);
        console.error("Problematic base64 string (first 100 chars):", base64.substring(0, 100));
        throw e; 
    }
}

function displayImageResults(imageUrls) {
    const $imageDisplayArea = $(IMAGE_DISPLAY_AREA_ID);
    // Преди да изчистим, освобождаваме стария Blob URL, ако има такъв
    $imageDisplayArea.find('img').each(function() {
        const oldSrc = $(this).attr('src');
        if (oldSrc && oldSrc.startsWith('blob:')) {
            URL.revokeObjectURL(oldSrc);
            console.log("Revoked old blob URL:", oldSrc);
        }
    });
    $imageDisplayArea.children().not(SPINNER_ID).remove(); // Clear previous, keep spinner structure
    $(DOWNLOAD_BUTTON_ID).hide();

    if (!imageUrls || imageUrls.length === 0) {
        console.warn("displayImageResults called with no imageUrls or empty array.");
        $imageDisplayArea.append($('<p class="text-warning">Няма върнати изображения.</p>'));
        localStorage.removeItem('lastGeneratedImageUrl');
    } else {
        // Ще обработим само първото изображение с localStorage roundtrip за целите на теста
        const originalDataUrl = imageUrls[0]; 
        console.log(`Original dataUrl[0] received (length ${originalDataUrl ? originalDataUrl.length : 'N/A'}):`, originalDataUrl ? originalDataUrl.substring(0, 150) + "..." : "null/undefined");

        if (typeof originalDataUrl !== 'string' || !originalDataUrl.startsWith('data:image/')) {
            console.error("Invalid original data URL format or type:", originalDataUrl);
            $imageDisplayArea.append($(`<p class="text-danger">Невалиден формат на данните за изображението.</p>`));
            hideSpinner();
            return;
        }

        // 1. Запис в localStorage
        localStorage.setItem('lastGeneratedImageUrl', originalDataUrl);
        console.log("Saved originalDataUrl to localStorage.");

        // 2. Четене обратно от localStorage веднага
        const dataUrlFromStorage = localStorage.getItem('lastGeneratedImageUrl');
        console.log(`dataUrl read back from localStorage (length ${dataUrlFromStorage ? dataUrlFromStorage.length : 'N/A'}):`, dataUrlFromStorage ? dataUrlFromStorage.substring(0, 150) + "..." : "null/undefined");

        if (typeof dataUrlFromStorage !== 'string' || !dataUrlFromStorage.startsWith('data:image/')) {
            console.error("Invalid data URL format or type from localStorage:", dataUrlFromStorage);
            $imageDisplayArea.append($(`<p class="text-danger">Невалиден формат на данните от localStorage.</p>`));
            hideSpinner();
            return; 
        }

        const parts = dataUrlFromStorage.split(','); // Използваме низа от localStorage
        if (parts.length !== 2) {
            console.error("Invalid data URL structure from localStorage (missing comma?):", dataUrlFromStorage.substring(0,150));
            $imageDisplayArea.append($(`<p class="text-danger">Невалидна структура на данните от localStorage.</p>`));
            hideSpinner();
            return; 
        }

        const base64Data = parts[1]; // Това е base64 низът, който ще се подаде на atob()
        const contentTypeMatch = parts[0].match(/^data:(image\/[a-z0-9+.-]+)(?:;charset=[^;]+)?;base64$/i);
        const contentType = contentTypeMatch ? contentTypeMatch[1] : 'image/png'; 

        if (!base64Data) {
            console.error("Base64 data is empty from localStorage data URL:", dataUrlFromStorage.substring(0,150));
            $imageDisplayArea.append($(`<p class="text-danger">Липсват данни (base64) от localStorage.</p>`));
            hideSpinner();
            return; 
        }
        console.log(`Extracted base64Data from localStorage string (length ${base64Data.length}): ${base64Data.substring(0, 100)}...`);

        // Използваме setTimeout, за да отложим обработката за следващия event loop tick
        setTimeout(function() {
            try {
                const blob = base64ToBlob(base64Data, contentType); // Подаваме base64Data от localStorage
                const blobUrl = URL.createObjectURL(blob);
                console.log(`(setTimeout) Created new blob URL from localStorage data:`, blobUrl, "for content type:", contentType);

                const imgElement = $('<img>')
                    .attr('src', blobUrl) 
                    .addClass('img-fluid rounded mb-2')
                    .attr('alt', 'Генерирано изображение')
                    .css('opacity', 0)
                    .on('load', function() { $(this).animate({ opacity: 1 }, 300); })
                    .on('error', function(e) {
                        console.error(`(setTimeout) Error loading image from blobUrl (derived from localStorage data):`, blobUrl, "Original error event:", e);
                        $(this).replaceWith($(`<p class="text-danger">Грешка при зареждане на изображението (setTimeout).</p>`));
                        URL.revokeObjectURL(blobUrl); 
                    });
                $imageDisplayArea.append(imgElement);

                // Бутонът за сваляне ще използва dataUrlFromStorage (който е същият като originalDataUrl след roundtrip-а)
                if (dataUrlFromStorage) {
                    $(DOWNLOAD_BUTTON_ID).show().off('click').on('click', function() {
                        const link = document.createElement('a');
                        link.href = dataUrlFromStorage; 
                        link.download = 'generated_image.png'; 
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    });
                }

            } catch (e) {
                console.error(`(setTimeout) Error processing data from localStorage (base64ToBlob or createObjectURL):`, e.message, "DataURL snippet:", dataUrlFromStorage.substring(0,100));
                $imageDisplayArea.append($(`<p class="text-danger">Грешка при обработка на данните от localStorage (setTimeout).</p>`));
            }
        }, 0); // Нула милисекунди забавяне
    }
    hideSpinner();
}

function displayErrorState(errorMessage, jobId = null) {
    const $imageDisplayArea = $(IMAGE_DISPLAY_AREA_ID);
    // Освобождаваме стария Blob URL, ако има такъв
    $imageDisplayArea.find('img').each(function() {
        const oldSrc = $(this).attr('src');
        if (oldSrc && oldSrc.startsWith('blob:')) {
            URL.revokeObjectURL(oldSrc);
        }
    });
    $imageDisplayArea.children().not(SPINNER_ID).remove();

    const errorText = jobId ? `Грешка за заявка ${jobId}: ${errorMessage}` : errorMessage;

    const errorImage = $('<img>')
        .attr('src', 'https://picsum.photos/800/600?grayscale&blur=2')
        .addClass('img-fluid rounded')
        .attr('alt', 'Грешка')
        .css('opacity', 1);
    $imageDisplayArea.append(errorImage);
    $imageDisplayArea.append($('<p class="text-danger mt-2">').text(errorText || 'Възникна грешка.'));
    $(DOWNLOAD_BUTTON_ID).hide();
    hideSpinner();
}

function pollJobStatus(jobId) {
    if (!jobId) {
        console.error("pollJobStatus called without a jobId.");
        clearPendingJobState();
        return;
    }

    // If called for a new job while another is polling, clear old interval.
    if (pollingIntervalId && currentPollingJobId !== jobId) {
        console.log(`Switching polling from ${currentPollingJobId} to ${jobId}`);
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }
    
    currentPollingJobId = jobId; // Set current job being polled
    localStorage.setItem(PENDING_JOB_ID_KEY, jobId); // Ensure it's in localStorage
    disableSubmitButtons("Проверка...");
    showSpinner();
    // $(IMAGE_DISPLAY_AREA_ID).children('img').css('opacity', 0.5); // Optional: Dim old image

    function doPoll() {
        // Ensure we are still polling for *this* job ID.
        if (currentPollingJobId !== jobId) {
            console.log(`Polling for ${jobId} stopped because currentPollingJobId changed to ${currentPollingJobId}.`);
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
            return;
        }
        console.log(`Polling for job ID: ${jobId}`);
        $.ajax({
            url: '/Home/PollJobStatus',
            type: 'GET',
            data: { jobId: jobId },
            dataType: 'json',
            success: function(response) {
                if (currentPollingJobId !== jobId) return; // Stale response

                console.log("Poll response:", response);
                if (response.success) {
                    if (response.status === "completed") {
                        console.log(`Job ${jobId} completed.`);
                        alert(`Изображението за заявка ${jobId} е готово!`);
                        displayImageResults(response.imageUrls); // Тук се извиква модифицираната функция
                        clearPendingJobState();
                    } else if (response.status === "pending" || response.status === "processing") {
                        console.log(`Job ${jobId} is ${response.status}. Continuing to poll.`);
                        disableSubmitButtons(`Статус: ${response.status}`);
                    } else {
                        console.warn(`Job ${jobId} has unexpected success status: ${response.status}.`);
                        displayErrorState(response.message || `Неочакван успешен статус: ${response.status}`, jobId);
                        clearPendingJobState();
                    }
                } else { // response.success === false
                    const message = response.message || "Грешка при обработка на заявката.";
                    console.error(`Polling for job ${jobId} failed or job status is error:`, message);
                     if (response.status === "failed" || response.status === "not_found" || response.status === "error") {
                        displayErrorState(message, jobId);
                        alert(message);
                        clearPendingJobState(); 
                    } else {
                        console.warn(`Polling for ${jobId} resulted in non-terminal error or unknown status: ${response.status}. Message: ${message}`);
                        displayErrorState(`Грешка при проверка на статус за ${jobId}: ${message}. Може да презаредите страницата.`, jobId);
                        if (pollingIntervalId) clearInterval(pollingIntervalId);
                        pollingIntervalId = null;
                    }
                }
            },
            error: function(xhr, status, error) {
                if (currentPollingJobId !== jobId) return;

                console.error(`AJAX error polling for job ${jobId}:`, status, error);
                if (pollingIntervalId) {
                    clearInterval(pollingIntervalId);
                    pollingIntervalId = null;
                }
                disableSubmitButtons("Грешка при проверка");
                hideSpinner();
                $(IMAGE_DISPLAY_AREA_ID).append($('<p class="text-warning mt-2">').text(`Грешка при комуникация за проверка на статус (ID: ${jobId}). Моля, проверете връзката си или опитайте да презаредите страницата.`));
            }
        });
    }

    doPoll(); // First poll immediately
    pollingIntervalId = setInterval(doPoll, POLLING_INTERVAL_MS);
}

function loadAndPollPendingJob() {
    const pendingJobId = localStorage.getItem(PENDING_JOB_ID_KEY);
    if (pendingJobId) {
        console.log(`Found pending job ID on load: ${pendingJobId}`);
        alert(`Зарежда се предходна заявка с ID: ${pendingJobId}.`);
        pollJobStatus(pendingJobId);
    } else {
        enableSubmitButtons(); // Ensure buttons are enabled if no pending job
    }
}

function initializeImageGenerationAndUI() {
    // Handle GO and RAND button clicks
    $(GO_BUTTON_ID + ', ' + RAND_BUTTON_ID).on('click', function() {
        const isRandomRequest = $(this).attr('id') === RAND_BUTTON_ID.substring(1);

        if (currentPollingJobId) {
            alert(`Моля, изчакайте завършването на текущата заявка (ID: ${currentPollingJobId}).`);
            return;
        }

        const promptText = $('#text-prompt').val().trim();
        if (!isRandomRequest && !promptText) {
            alert('Моля, въведете текст за генериране на изображение.');
            return;
        }

        let allSelectedStyleNames = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.endsWith('-selections') && !key.startsWith('advancedSettings_localStorage_') && key !== PENDING_JOB_ID_KEY) {
                const storedValue = localStorage.getItem(key);
                const selectedStylesArray = storedValue ? JSON.parse(storedValue) : [];
                
                console.log(`Processing styles from localStorage key: ${key}`, selectedStylesArray);

                selectedStylesArray.forEach(function(styleObject) {
                    if (styleObject && styleObject.name) {
                        allSelectedStyleNames.push(styleObject.name);
                    } else {
                        console.warn(`Style object from ${key} is missing a name or is invalid:`, styleObject);
                    }
                });
            }
        }

        console.log("Final list of selected style names to be sent:", allSelectedStyleNames);

        const advancedSettings = {
            useCfgScale: $('#enable-cfg-scale').is(':checked'),
            cfgScaleValue: $('#enable-cfg-scale').is(':checked') ? parseFloat($('#cfg-scale-slider').val()) : null,
            useSampler: $('#enable-scheduler').is(':checked'), 
            samplerValue: $('#enable-scheduler').is(':checked') ? $('input[name="scheduler-options"]:checked').val() : null, 
            batchCount: parseInt($('#batch-scale-slider').val(), 10) || 1,
            positivePromptAdditions: $('#positive-prompt-additions').val().trim(),
            negativePromptAdditions: $('#negative-prompt-additions').val().trim()
        };

        const payload = JSON.stringify({
            isRandom: isRandomRequest,
            prompt: promptText,
            selectedStyles: allSelectedStyleNames,
            ...advancedSettings
        });
        
        disableSubmitButtons("Изпращане...");
        showSpinner();

        $.ajax({
            url: '/Home/GenerateImageAsync', 
            type: 'POST',
            contentType: 'application/json',
            data: payload,
            success: function(response) {
                console.log("Submit response:", response);
                if (response.success && response.status === "submitted" && response.jobId) {
                    pollJobStatus(response.jobId);
                } else {
                    let errorMsg = response.message || "Грешка при изпращане на заявката.";
                    displayErrorState(errorMsg, response.jobId); 
                    alert(errorMsg);
                    clearPendingJobState(); 
                }
            },
            error: function(xhr, status, error) {
                console.error('Error submitting image generation request:', status, error);
                let errorMsg = 'Възникна грешка при комуникация със сървъра за изпращане на заявката.';
                try {
                    const errResponse = JSON.parse(xhr.responseText);
                    if (errResponse && errResponse.message) {
                        errorMsg = errResponse.message;
                    }
                } catch (e) { /* ignore parsing error */ }
                
                displayErrorState(errorMsg);
                alert(errorMsg);
                clearPendingJobState();
            }
        });
    });

    // CLEAR button functionality
    $('#clear-button').on('click', function () {
        if (!confirm("Сигурни ли сте, че искате да изчистите всички избрани стилове?")) {
            return;
        }
        console.log('Изчистване на всички стилове (клиентска страна).');
        let keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.endsWith('-selections') && !key.startsWith('advancedSettings_localStorage_')) {
                keysToRemove.push(key);
            }
        }
        // Добавяме изчистване на запазеното изображение
        localStorage.removeItem('lastGeneratedImageUrl');
        // Изчистваме и показаното изображение от екрана, връщаме placeholder
        // Освобождаваме Blob URL, ако има такъв
        const $imageDisplayArea = $(IMAGE_DISPLAY_AREA_ID);
        $imageDisplayArea.find('img').each(function() {
            const oldSrc = $(this).attr('src');
            if (oldSrc && oldSrc.startsWith('blob:')) {
                URL.revokeObjectURL(oldSrc);
            }
        });

        const $spinner = $imageDisplayArea.find(SPINNER_ID); 
        $imageDisplayArea.children().not($spinner).remove(); 
        $imageDisplayArea.append('<img src="https://picsum.photos/800/600" class="img-fluid rounded" alt="Генерирано изображение" id="generated-image" style="opacity: 1;">');
        
        $(DOWNLOAD_BUTTON_ID).hide(); 

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('Изчистен localStorage ключ:', key);
        });
        $('[data-btn-type]').each(function() {
            var $button = $(this);
            if ($button.hasClass('active') || $button.hasClass('btn-success')) {
                $button.removeClass('active btn-success').addClass('btn-primary');
            }
        });
        alert('Всички избрани стилове бяха успешно изчистени от браузъра.');
    });
}


// This function remains largely the same for style button selections
function newButtonsFunctionality(buttonType) {
    const storageKey = buttonType + '-selections';
    const buttonSelector = '[data-btn-type="' + buttonType + '"]';
    const buttonIdPrefix = buttonType + '-btn-';

    function getSelectedStyles() {
        const storedValue = localStorage.getItem(storageKey);
        return storedValue ? JSON.parse(storedValue) : [];
    }

    function saveSelectedStyles(styles) {
        localStorage.setItem(storageKey, JSON.stringify(styles));
    }

    function localSetButtonToPrimary($button, currentSelectedStyles, btnId) {
        $button.removeClass('active btn-success').addClass('btn-primary');
        const index = currentSelectedStyles.findIndex(style => style.id === btnId);
        if (index > -1) {
            currentSelectedStyles.splice(index, 1);
        }
    }

    function localSetButtonToActive($button, currentSelectedStyles, btnId, styleName) {
        $button.removeClass('btn-primary').addClass('active btn-success');
        if (!currentSelectedStyles.some(style => style.id === btnId)) {
            currentSelectedStyles.push({ id: btnId, name: styleName });
        }
    }

    $(document).on('click', buttonSelector, function() {
        var $button = $(this);
        var btnId = $button.data('btn-id');
        var styleFullName = $button.data('extra-param'); 
        var selectedStyles = getSelectedStyles(); 

        if (!styleFullName) {
            console.error(`Button with id ${btnId} is missing data-extra-param.`);
            return; 
        }

        if ($button.hasClass('active')) {
            console.log(`Премахване на стил (клиентска страна): ID: ${btnId}, Name: ${styleFullName}`);
            localSetButtonToPrimary($button, selectedStyles, btnId);
        } else {
            console.log(`Добавяне на стил (клиентска страна): ID: ${btnId}, Name: ${styleFullName}`);
            localSetButtonToActive($button, selectedStyles, btnId, styleFullName);
        }
        saveSelectedStyles(selectedStyles);
        console.log(`Saved styles for ${storageKey}:`, selectedStyles);
    });

    function applyInitialSelections() {
        var initialSelectedStyles = getSelectedStyles();
        initialSelectedStyles.forEach(function(styleObj) {
            $('#' + buttonIdPrefix + styleObj.id).removeClass('btn-primary').addClass('active btn-success');
        });
    }
    applyInitialSelections();
}

// praska function (if still used)
function praska() {
    console.log('PRASKA clicked');
     $.ajax({
        url: '/Home/NovaFunctions', 
        type: 'GET', 
        dataType: 'text', 
        success: function (response) {
            console.log('Съобщение от сървъра:', response);
        },
        error: function (xhr, status, error) {
            console.error('Грешка при AJAX заявката към NovaFunctions:', status, error);
            alert('Възникна грешка при опит за връзка със сървъра.');
        }
    });
}

// initializeAdvancedSettingsToggle function remains the same
function initializeAdvancedSettingsToggle() {
    const settingsButton = $('#settings-button');
    const advancedSettingsPanel = $('#advanced-settings-panel');
    const cfgScaleSlider = $('#cfg-scale-slider');
    const cfgScaleValueDisplay = $('#cfg-scale-value');
    const batchSizeSlider = $('#batch-scale-slider');
    const batchSizeValueDisplay = $('#batch-scale-value');
    const enableCfgScaleCheckbox = $('#enable-cfg-scale');
    const positivePromptTextarea = $('#positive-prompt-additions');
    const negativePromptTextarea = $('#negative-prompt-additions');
    const samplerRadios = $('input[name="scheduler-options"]'); 
    const enableSamplerCheckbox = $('#enable-scheduler'); 

    const KEY_ENABLE_CFG = 'advancedSettings_localStorage_enableCfgScale';
    const KEY_CFG_VALUE = 'advancedSettings_localStorage_cfgScaleValue';
    const KEY_BATCH_VALUE = 'advancedSettings_localStorage_batchSizeValue'; 
    const KEY_ENABLE_SAMPLER = 'advancedSettings_localStorage_enableSampler';
    const KEY_SAMPLER_VALUE = 'advancedSettings_localStorage_samplerValue';
    const KEY_POSITIVE_PROMPT = 'advancedSettings_localStorage_positivePrompt';
    const KEY_NEGATIVE_PROMPT = 'advancedSettings_localStorage_negativePrompt';

    function loadSettings() {
        const storedEnableCfg = localStorage.getItem(KEY_ENABLE_CFG);
        if (storedEnableCfg !== null) {
            enableCfgScaleCheckbox.prop('checked', JSON.parse(storedEnableCfg)).trigger('change');
        }
        const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
        if (storedCfgValue !== null && enableCfgScaleCheckbox.is(':checked')) {
            cfgScaleSlider.val(storedCfgValue).trigger('input');
        } else if (!enableCfgScaleCheckbox.is(':checked')) {
            cfgScaleSlider.val(5); 
            cfgScaleValueDisplay.text(5);
        }

        const storedBatchValue = localStorage.getItem(KEY_BATCH_VALUE);
        if (storedBatchValue !== null) {
            batchSizeSlider.val(storedBatchValue).trigger('input');
        } else {
            batchSizeSlider.val(1); 
            batchSizeValueDisplay.text(1);
            localStorage.setItem(KEY_BATCH_VALUE, '1');
        }

        const storedEnableSampler = localStorage.getItem(KEY_ENABLE_SAMPLER);
        if (storedEnableSampler !== null) {
            enableSamplerCheckbox.prop('checked', JSON.parse(storedEnableSampler)).trigger('change');
        }
        const storedSamplerValue = localStorage.getItem(KEY_SAMPLER_VALUE);
        if (storedSamplerValue !== null && enableSamplerCheckbox.is(':checked')) {
            samplerRadios.filter(`[value="${storedSamplerValue}"]`).prop('checked', true);
        } else if (!enableSamplerCheckbox.is(':checked')) {
             samplerRadios.filter('[value="normal"]').prop('checked', true);
        }

        const storedPositivePrompt = localStorage.getItem(KEY_POSITIVE_PROMPT);
        if (storedPositivePrompt !== null) positivePromptTextarea.val(storedPositivePrompt);
        
        const storedNegativePrompt = localStorage.getItem(KEY_NEGATIVE_PROMPT);
        if (storedNegativePrompt !== null) negativePromptTextarea.val(storedNegativePrompt);
    }

    settingsButton.on('click', function() { advancedSettingsPanel.slideToggle(); });

    if (enableCfgScaleCheckbox.length && cfgScaleSlider.length && cfgScaleValueDisplay.length) {
        enableCfgScaleCheckbox.on('change', function() {
            const isChecked = $(this).is(':checked');
            cfgScaleSlider.prop('disabled', !isChecked);
            localStorage.setItem(KEY_ENABLE_CFG, isChecked);
            if (isChecked) {
                const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
                if (storedCfgValue) cfgScaleSlider.val(storedCfgValue).trigger('input');
            }
        });
        cfgScaleSlider.on('input', function() {
            cfgScaleValueDisplay.text($(this).val());
            if (enableCfgScaleCheckbox.is(':checked')) {
                localStorage.setItem(KEY_CFG_VALUE, $(this).val());
            }
        });
    }

    if (batchSizeSlider.length && batchSizeValueDisplay.length) {
        batchSizeSlider.on('input', function () {
            batchSizeValueDisplay.text($(this).val());
            localStorage.setItem(KEY_BATCH_VALUE, $(this).val());
        });
    }

    if (enableSamplerCheckbox.length && samplerRadios.length) {
        enableSamplerCheckbox.on('change', function() {
            const isChecked = $(this).is(':checked');
            samplerRadios.prop('disabled', !isChecked);
            localStorage.setItem(KEY_ENABLE_SAMPLER, isChecked);
            if (isChecked) {
                const storedSamplerValue = localStorage.getItem(KEY_SAMPLER_VALUE);
                if (storedSamplerValue) samplerRadios.filter(`[value="${storedSamplerValue}"]`).prop('checked', true);
            }
        });
        samplerRadios.on('change', function() {
            if (enableSamplerCheckbox.is(':checked')) {
                localStorage.setItem(KEY_SAMPLER_VALUE, $(this).val());
            }
        });
    }

    positivePromptTextarea.on('input', function() { localStorage.setItem(KEY_POSITIVE_PROMPT, $(this).val()); });
    negativePromptTextarea.on('input', function() { localStorage.setItem(KEY_NEGATIVE_PROMPT, $(this).val()); });

    loadSettings();
}

// Показваме бутона за сваляне и му закачаме функционалност (използваме оригиналния data:URL)
const firstDataUrl = localStorage.getItem('lastGeneratedImageUrl'); // Взимаме data:URL
if (firstDataUrl) {
    $(DOWNLOAD_BUTTON_ID).show().off('click').on('click', function() {
        const link = document.createElement('a');
        link.href = firstDataUrl; 
        link.download = 'generated_image.png'; 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
} else {
    $imageDisplayArea.append($('<p class="text-warning">Няма върнати изображения.</p>'));
    localStorage.removeItem('lastGeneratedImageUrl');
}

hideSpinner();


function displayErrorState(errorMessage, jobId = null) {
    const $imageDisplayArea = $(IMAGE_DISPLAY_AREA_ID);
    // Освобождаваме стария Blob URL, ако има такъв
    $imageDisplayArea.find('img').each(function() {
        const oldSrc = $(this).attr('src');
        if (oldSrc && oldSrc.startsWith('blob:')) {
            URL.revokeObjectURL(oldSrc);
        }
    });
    $imageDisplayArea.children().not(SPINNER_ID).remove();

    const errorText = jobId ? `Грешка за заявка ${jobId}: ${errorMessage}` : errorMessage;

    const errorImage = $('<img>')
        .attr('src', 'https://picsum.photos/800/600?grayscale&blur=2')
        .addClass('img-fluid rounded')
        .attr('alt', 'Грешка')
        .css('opacity', 1);
    $imageDisplayArea.append(errorImage);
    $imageDisplayArea.append($('<p class="text-danger mt-2">').text(errorText || 'Възникна грешка.'));
    $(DOWNLOAD_BUTTON_ID).hide();
    hideSpinner();
}

function pollJobStatus(jobId) {
    if (!jobId) {
        console.error("pollJobStatus called without a jobId.");
        clearPendingJobState();
        return;
    }

    // If called for a new job while another is polling, clear old interval.
    if (pollingIntervalId && currentPollingJobId !== jobId) {
        console.log(`Switching polling from ${currentPollingJobId} to ${jobId}`);
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }
    
    currentPollingJobId = jobId; // Set current job being polled
    localStorage.setItem(PENDING_JOB_ID_KEY, jobId); // Ensure it's in localStorage
    disableSubmitButtons("Проверка...");
    showSpinner();
    // $(IMAGE_DISPLAY_AREA_ID).children('img').css('opacity', 0.5); // Optional: Dim old image

    function doPoll() {
        // Ensure we are still polling for *this* job ID.
        if (currentPollingJobId !== jobId) {
            console.log(`Polling for ${jobId} stopped because currentPollingJobId changed to ${currentPollingJobId}.`);
            clearInterval(pollingIntervalId);
            pollingIntervalId = null;
            return;
        }
        console.log(`Polling for job ID: ${jobId}`);
        $.ajax({
            url: '/Home/PollJobStatus',
            type: 'GET',
            data: { jobId: jobId },
            dataType: 'json',
            success: function(response) {
                if (currentPollingJobId !== jobId) return; // Stale response

                console.log("Poll response:", response);
                if (response.success) {
                    if (response.status === "completed") {
                        console.log(`Job ${jobId} completed.`);
                        alert(`Изображението за заявка ${jobId} е готово!`);
                        displayImageResults(response.imageUrls);
                        clearPendingJobState();
                    } else if (response.status === "pending" || response.status === "processing") {
                        console.log(`Job ${jobId} is ${response.status}. Continuing to poll.`);
                        disableSubmitButtons(`Статус: ${response.status}`);
                    } else {
                        console.warn(`Job ${jobId} has unexpected success status: ${response.status}.`);
                        displayErrorState(response.message || `Неочакван успешен статус: ${response.status}`, jobId);
                        clearPendingJobState();
                    }
                } else { // response.success === false
                    const message = response.message || "Грешка при обработка на заявката.";
                    console.error(`Polling for job ${jobId} failed or job status is error:`, message);
                     if (response.status === "failed" || response.status === "not_found" || response.status === "error") {
                        displayErrorState(message, jobId);
                        alert(message);
                        clearPendingJobState(); 
                    } else {
                        // Potentially a recoverable polling error, or an unknown non-success status.
                        // For simplicity, we'll treat most non-successes from poll as terminal for this loop.
                        // User can refresh to retry polling if job ID is still in local storage.
                        console.warn(`Polling for ${jobId} resulted in non-terminal error or unknown status: ${response.status}. Message: ${message}`);
                        displayErrorState(`Грешка при проверка на статус за ${jobId}: ${message}. Може да презаредите страницата.`, jobId);
                        // Stop this polling loop, but keep job ID in localStorage for manual refresh/retry.
                        if (pollingIntervalId) clearInterval(pollingIntervalId);
                        pollingIntervalId = null;
                        // Buttons remain disabled as currentPollingJobId is still set.
                    }
                }
            },
            error: function(xhr, status, error) {
                if (currentPollingJobId !== jobId) return;

                console.error(`AJAX error polling for job ${jobId}:`, status, error);
                // Keep job ID in localStorage. Stop this interval. User can refresh.
                if (pollingIntervalId) {
                    clearInterval(pollingIntervalId);
                    pollingIntervalId = null;
                }
                disableSubmitButtons("Грешка при проверка");
                hideSpinner();
                $(IMAGE_DISPLAY_AREA_ID).append($('<p class="text-warning mt-2">').text(`Грешка при комуникация за проверка на статус (ID: ${jobId}). Моля, проверете връзката си или опитайте да презаредите страницата.`));
            }
        });
    }

    doPoll(); // First poll immediately
    pollingIntervalId = setInterval(doPoll, POLLING_INTERVAL_MS);
}

function loadAndPollPendingJob() {
    const pendingJobId = localStorage.getItem(PENDING_JOB_ID_KEY);
    if (pendingJobId) {
        console.log(`Found pending job ID on load: ${pendingJobId}`);
        alert(`Зарежда се предходна заявка с ID: ${pendingJobId}.`);
        pollJobStatus(pendingJobId);
    } else {
        enableSubmitButtons(); // Ensure buttons are enabled if no pending job
    }
}

function initializeImageGenerationAndUI() {
    // Handle GO and RAND button clicks
    $(GO_BUTTON_ID + ', ' + RAND_BUTTON_ID).on('click', function() {
        const isRandomRequest = $(this).attr('id') === RAND_BUTTON_ID.substring(1);

        if (currentPollingJobId) {
            alert(`Моля, изчакайте завършването на текущата заявка (ID: ${currentPollingJobId}).`);
            return;
        }

        const promptText = $('#text-prompt').val().trim();
        if (!isRandomRequest && !promptText) {
            alert('Моля, въведете текст за генериране на изображение.');
            return;
        }

        let allSelectedStyleNames = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Ensure we only process style selection keys and not advanced settings or the pending job ID key
            if (key && key.endsWith('-selections') && !key.startsWith('advancedSettings_localStorage_') && key !== PENDING_JOB_ID_KEY) {
                const storedValue = localStorage.getItem(key);
                // Вече четем масив от обекти {id: "...", name: "..."}
                const selectedStylesArray = storedValue ? JSON.parse(storedValue) : [];
                
                console.log(`Processing styles from localStorage key: ${key}`, selectedStylesArray);

                selectedStylesArray.forEach(function(styleObject) {
                    if (styleObject && styleObject.name) {
                        allSelectedStyleNames.push(styleObject.name);
                    } else {
                        console.warn(`Style object from ${key} is missing a name or is invalid:`, styleObject);
                    }
                });
            }
        }

        console.log("Final list of selected style names to be sent:", allSelectedStyleNames);

        const advancedSettings = {
            useCfgScale: $('#enable-cfg-scale').is(':checked'),
            cfgScaleValue: $('#enable-cfg-scale').is(':checked') ? parseFloat($('#cfg-scale-slider').val()) : null,
            useSampler: $('#enable-scheduler').is(':checked'), // Corrected ID from HTML
            samplerValue: $('#enable-scheduler').is(':checked') ? $('input[name="scheduler-options"]:checked').val() : null, // Corrected name
            batchCount: parseInt($('#batch-scale-slider').val(), 10) || 1,
            positivePromptAdditions: $('#positive-prompt-additions').val().trim(),
            negativePromptAdditions: $('#negative-prompt-additions').val().trim()
        };

        const payload = JSON.stringify({
            isRandom: isRandomRequest,
            prompt: promptText,
            selectedStyles: allSelectedStyleNames,
            ...advancedSettings
        });
        
        disableSubmitButtons("Изпращане...");
        showSpinner();
        // $(IMAGE_DISPLAY_AREA_ID).children('img').css('opacity', 0.5); // Optional: Dim old image(s)

        $.ajax({
            url: '/Home/GenerateImageAsync', // Submission endpoint
            type: 'POST',
            contentType: 'application/json',
            data: payload,
            // headers: { 'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val() }, // Uncomment if using AntiForgeryToken
            success: function(response) {
                console.log("Submit response:", response);
                if (response.success && response.status === "submitted" && response.jobId) {
                    // No alert here, pollJobStatus will handle UI updates
                    pollJobStatus(response.jobId);
                } else {
                    let errorMsg = response.message || "Грешка при изпращане на заявката.";
                    displayErrorState(errorMsg, response.jobId); // Pass jobId if available
                    alert(errorMsg);
                    clearPendingJobState(); // Clear any potentially inconsistent state
                }
            },
            error: function(xhr, status, error) {
                console.error('Error submitting image generation request:', status, error);
                let errorMsg = 'Възникна грешка при комуникация със сървъра за изпращане на заявката.';
                try {
                    const errResponse = JSON.parse(xhr.responseText);
                    if (errResponse && errResponse.message) {
                        errorMsg = errResponse.message;
                    }
                } catch (e) { /* ignore parsing error */ }
                
                displayErrorState(errorMsg);
                alert(errorMsg);
                clearPendingJobState();
            }
        });
    });

    // CLEAR button functionality
    $('#clear-button').on('click', function () {
        if (!confirm("Сигурни ли сте, че искате да изчистите всички избрани стилове?")) {
            return;
        }
        console.log('Изчистване на всички стилове (клиентска страна).');
        let keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.endsWith('-selections') && !key.startsWith('advancedSettings_localStorage_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('Изчистен localStorage ключ:', key);
        });
        $('[data-btn-type]').each(function() {
            var $button = $(this);
            if ($button.hasClass('active') || $button.hasClass('btn-success')) {
                $button.removeClass('active btn-success').addClass('btn-primary');
            }
        });
        alert('Всички избрани стилове бяха успешно изчистени от браузъра.');
    });
}


// This function remains largely the same for style button selections
function newButtonsFunctionality(buttonType) {
    const storageKey = buttonType + '-selections';
    const buttonSelector = '[data-btn-type="' + buttonType + '"]';
    const buttonIdPrefix = buttonType + '-btn-';

    // Променена функция: връща масив от обекти {id, name}
    function getSelectedStyles() {
        const storedValue = localStorage.getItem(storageKey);
        return storedValue ? JSON.parse(storedValue) : [];
    }

    // Променена функция: записва масив от обекти {id, name}
    function saveSelectedStyles(styles) {
        localStorage.setItem(storageKey, JSON.stringify(styles));
    }

    function localSetButtonToPrimary($button, currentSelectedStyles, btnId) {
        $button.removeClass('active btn-success').addClass('btn-primary');
        // Намираме индекса на обекта по btnId
        const index = currentSelectedStyles.findIndex(style => style.id === btnId);
        if (index > -1) {
            currentSelectedStyles.splice(index, 1);
        }
    }

    function localSetButtonToActive($button, currentSelectedStyles, btnId, styleName) {
        $button.removeClass('btn-primary').addClass('active btn-success');
        // Проверяваме дали вече съществува обект с такова ID
        if (!currentSelectedStyles.some(style => style.id === btnId)) {
            currentSelectedStyles.push({ id: btnId, name: styleName });
        }
    }

    $(document).on('click', buttonSelector, function() {
        var $button = $(this);
        var btnId = $button.data('btn-id');
        var styleFullName = $button.data('extra-param'); // Взимаме пълното име на стила
        var selectedStyles = getSelectedStyles(); // Взимаме текущия масив от обекти

        if (!styleFullName) {
            console.error(`Button with id ${btnId} is missing data-extra-param.`);
            return; // Не правим нищо, ако липсва името на стила
        }

        if ($button.hasClass('active')) {
            console.log(`Премахване на стил (клиентска страна): ID: ${btnId}, Name: ${styleFullName}`);
            localSetButtonToPrimary($button, selectedStyles, btnId);
        } else {
            console.log(`Добавяне на стил (клиентска страна): ID: ${btnId}, Name: ${styleFullName}`);
            localSetButtonToActive($button, selectedStyles, btnId, styleFullName);
        }
        saveSelectedStyles(selectedStyles);
        console.log(`Saved styles for ${storageKey}:`, selectedStyles);
    });

    function applyInitialSelections() {
        var initialSelectedStyles = getSelectedStyles();
        initialSelectedStyles.forEach(function(styleObj) {
            // Стилизираме бутона по неговото ID
            $('#' + buttonIdPrefix + styleObj.id).removeClass('btn-primary').addClass('active btn-success');
        });
    }
    applyInitialSelections();
}

// praska function (if still used)
function praska() {
    console.log('PRASKA clicked');
    // ... (AJAX call as before)
     $.ajax({
        url: '/Home/NovaFunctions', 
        type: 'GET', 
        dataType: 'text', 
        success: function (response) {
            console.log('Съобщение от сървъра:', response);
        },
        error: function (xhr, status, error) {
            console.error('Грешка при AJAX заявката към NovaFunctions:', status, error);
            alert('Възникна грешка при опит за връзка със сървъра.');
        }
    });
}

// initializeAdvancedSettingsToggle function remains the same
function initializeAdvancedSettingsToggle() {
    const settingsButton = $('#settings-button');
    const advancedSettingsPanel = $('#advanced-settings-panel');
    const cfgScaleSlider = $('#cfg-scale-slider');
    const cfgScaleValueDisplay = $('#cfg-scale-value');
    const batchSizeSlider = $('#batch-scale-slider');
    const batchSizeValueDisplay = $('#batch-scale-value');
    const enableCfgScaleCheckbox = $('#enable-cfg-scale');
    const positivePromptTextarea = $('#positive-prompt-additions');
    const negativePromptTextarea = $('#negative-prompt-additions');
    const samplerRadios = $('input[name="scheduler-options"]'); 
    const enableSamplerCheckbox = $('#enable-scheduler'); // Corrected ID

    const KEY_ENABLE_CFG = 'advancedSettings_localStorage_enableCfgScale';
    const KEY_CFG_VALUE = 'advancedSettings_localStorage_cfgScaleValue';
    const KEY_BATCH_VALUE = 'advancedSettings_localStorage_batchSizeValue'; 
    const KEY_ENABLE_SAMPLER = 'advancedSettings_localStorage_enableSampler';
    const KEY_SAMPLER_VALUE = 'advancedSettings_localStorage_samplerValue';
    const KEY_POSITIVE_PROMPT = 'advancedSettings_localStorage_positivePrompt';
    const KEY_NEGATIVE_PROMPT = 'advancedSettings_localStorage_negativePrompt';

    function loadSettings() {
        const storedEnableCfg = localStorage.getItem(KEY_ENABLE_CFG);
        if (storedEnableCfg !== null) {
            enableCfgScaleCheckbox.prop('checked', JSON.parse(storedEnableCfg)).trigger('change');
        }
        const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
        if (storedCfgValue !== null && enableCfgScaleCheckbox.is(':checked')) {
            cfgScaleSlider.val(storedCfgValue).trigger('input');
        } else if (!enableCfgScaleCheckbox.is(':checked')) {
            cfgScaleSlider.val(5); 
            cfgScaleValueDisplay.text(5);
        }

        const storedBatchValue = localStorage.getItem(KEY_BATCH_VALUE);
        if (storedBatchValue !== null) {
            batchSizeSlider.val(storedBatchValue).trigger('input');
        } else {
            batchSizeSlider.val(1); 
            batchSizeValueDisplay.text(1);
            localStorage.setItem(KEY_BATCH_VALUE, '1');
        }

        const storedEnableSampler = localStorage.getItem(KEY_ENABLE_SAMPLER);
        if (storedEnableSampler !== null) {
            enableSamplerCheckbox.prop('checked', JSON.parse(storedEnableSampler)).trigger('change');
        }
        const storedSamplerValue = localStorage.getItem(KEY_SAMPLER_VALUE);
        if (storedSamplerValue !== null && enableSamplerCheckbox.is(':checked')) {
            samplerRadios.filter(`[value="${storedSamplerValue}"]`).prop('checked', true);
        } else if (!enableSamplerCheckbox.is(':checked')) {
             samplerRadios.filter('[value="normal"]').prop('checked', true);
        }

        const storedPositivePrompt = localStorage.getItem(KEY_POSITIVE_PROMPT);
        if (storedPositivePrompt !== null) positivePromptTextarea.val(storedPositivePrompt);
        
        const storedNegativePrompt = localStorage.getItem(KEY_NEGATIVE_PROMPT);
        if (storedNegativePrompt !== null) negativePromptTextarea.val(storedNegativePrompt);
    }

    settingsButton.on('click', function() { advancedSettingsPanel.slideToggle(); });

    if (enableCfgScaleCheckbox.length && cfgScaleSlider.length && cfgScaleValueDisplay.length) {
        enableCfgScaleCheckbox.on('change', function() {
            const isChecked = $(this).is(':checked');
            cfgScaleSlider.prop('disabled', !isChecked);
            localStorage.setItem(KEY_ENABLE_CFG, isChecked);
            if (isChecked) {
                const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
                if (storedCfgValue) cfgScaleSlider.val(storedCfgValue).trigger('input');
            }
        });
        cfgScaleSlider.on('input', function() {
            cfgScaleValueDisplay.text($(this).val());
            if (enableCfgScaleCheckbox.is(':checked')) {
                localStorage.setItem(KEY_CFG_VALUE, $(this).val());
            }
        });
    }

    if (batchSizeSlider.length && batchSizeValueDisplay.length) {
        batchSizeSlider.on('input', function () {
            batchSizeValueDisplay.text($(this).val());
            localStorage.setItem(KEY_BATCH_VALUE, $(this).val());
        });
    }

    if (enableSamplerCheckbox.length && samplerRadios.length) {
        enableSamplerCheckbox.on('change', function() {
            const isChecked = $(this).is(':checked');
            samplerRadios.prop('disabled', !isChecked);
            localStorage.setItem(KEY_ENABLE_SAMPLER, isChecked);
            if (isChecked) {
                const storedSamplerValue = localStorage.getItem(KEY_SAMPLER_VALUE);
                if (storedSamplerValue) samplerRadios.filter(`[value="${storedSamplerValue}"]`).prop('checked', true);
            }
        });
        samplerRadios.on('change', function() {
            if (enableSamplerCheckbox.is(':checked')) {
                localStorage.setItem(KEY_SAMPLER_VALUE, $(this).val());
            }
        });
    }

    positivePromptTextarea.on('input', function() { localStorage.setItem(KEY_POSITIVE_PROMPT, $(this).val()); });
    negativePromptTextarea.on('input', function() { localStorage.setItem(KEY_NEGATIVE_PROMPT, $(this).val()); });

    loadSettings();
}