// Store this at the top of your buttons.js or in a shared scope
const PENDING_JOB_ID_KEY = 'pendingImageJobId';
let currentPollingJobId = null; // Tracks the jobId currently being polled by the client
let pollingIntervalId = null;   // To store the interval ID for polling
const POLLING_INTERVAL_MS = 5000; // 5 seconds
const SPINNER_ID = '#loading-spinner';
const IMAGE_DISPLAY_AREA_ID = '#image-display-area';
const GO_BUTTON_ID = '#go-button';
const RAND_BUTTON_ID = '#rand-button';

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

function displayImageResults(imageUrls) {
    const $imageDisplayArea = $(IMAGE_DISPLAY_AREA_ID);
    $imageDisplayArea.children().not(SPINNER_ID).remove(); // Clear previous, keep spinner structure

    if (imageUrls && imageUrls.length > 0) {
        imageUrls.forEach(function(url, index) {
            const imgElement = $('<img>')
                .attr('src', url)
                .addClass('img-fluid rounded mb-2')
                .attr('alt', 'Генерирано изображение ' + (index + 1))
                .css('opacity', 0)
                .on('load', function() { $(this).animate({ opacity: 1 }, 300); })
                .on('error', function() {
                    $(this).replaceWith($('<p class="text-danger">Грешка при зареждане на изображението.</p>'));
                });
            $imageDisplayArea.append(imgElement);
        });
    } else {
        $imageDisplayArea.append($('<p class="text-warning">Няма върнати изображения.</p>'));
    }
    hideSpinner();
}

function displayErrorState(errorMessage, jobId = null) {
    const $imageDisplayArea = $(IMAGE_DISPLAY_AREA_ID);
    $imageDisplayArea.children().not(SPINNER_ID).remove();

    const errorText = jobId ? `Грешка за заявка ${jobId}: ${errorMessage}` : errorMessage;

    const errorImage = $('<img>')
        .attr('src', 'https://picsum.photos/800/600?grayscale&blur=2')
        .addClass('img-fluid rounded')
        .attr('alt', 'Грешка')
        .css('opacity', 1);
    $imageDisplayArea.append(errorImage);
    $imageDisplayArea.append($('<p class="text-danger mt-2">').text(errorText || 'Възникна грешка.'));
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
                const selectedIdsInGroup = storedValue ? JSON.parse(storedValue) : [];
                selectedIdsInGroup.forEach(function(id) {
                    const buttonTypeFromKey = key.replace('-selections', '');
                    const buttonFullId = '#' + buttonTypeFromKey + '-btn-' + id;
                    const styleName = $(buttonFullId).data('extra-param');
                    if (styleName) {
                        allSelectedStyleNames.push(styleName);
                    }
                });
            }
        }

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

    function getSelectedIds() {
        const storedValue = localStorage.getItem(storageKey);
        return storedValue ? JSON.parse(storedValue) : [];
    }

    function saveSelectedIds(ids) {
        localStorage.setItem(storageKey, JSON.stringify(ids));
    }

    function localSetButtonToPrimary($button, currentSelectedIds, btnId) {
        $button.removeClass('active btn-success').addClass('btn-primary');
        const index = currentSelectedIds.indexOf(btnId);
        if (index > -1) {
            currentSelectedIds.splice(index, 1);
        }
    }

    function localSetButtonToActive($button, currentSelectedIds, btnId) {
        $button.removeClass('btn-primary').addClass('active btn-success');
        if (currentSelectedIds.indexOf(btnId) === -1) {
            currentSelectedIds.push(btnId);
        }
    }
    
    $(document).on('click', buttonSelector, function() {
        var $button = $(this);
        var btnId = $button.data('btn-id');
        var selectedIds = getSelectedIds();

        if ($button.hasClass('active')) {
            var buttonFullName = $button.data('extra-param');
            console.log('Премахване на стил (клиентска страна):', buttonFullName);
            localSetButtonToPrimary($button, selectedIds, btnId);
        } else {
            var buttonFullName = $button.data('extra-param');
            console.log('Добавяне на стил (клиентска страна):', buttonFullName);
            localSetButtonToActive($button, selectedIds, btnId);
        }
        saveSelectedIds(selectedIds);
    });

    function applyInitialSelections() {
        var initialSelectedIds = getSelectedIds();
        initialSelectedIds.forEach(function(id) {
            $('#' + buttonIdPrefix + id).removeClass('btn-primary').addClass('active btn-success');
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





//--------------------------------------------------------------------------------------

// Функция за инициализиране на функционалност на бутоните с множествен избор
// function newButtonsFunctionality(buttonType) {
//     const storageKey = buttonType + '-selections'; // Динамичен ключ за sessionStorage
//     const buttonSelector = '[data-btn-type="' + buttonType + '"]';
//     const buttonIdPrefix = buttonType + '-btn-'; // Префикс за ID-тата на бутоните

//     //Функция за извличане на избраните ID-та от sessionStorage
//     function getSelectedIds() {
//         const storedValue = localStorage.getItem(storageKey);
//         return storedValue ? JSON.parse(storedValue) : [];
//     }

//     //Функция за запазване на избраните ID-та в sessionStorage
//     function saveSelectedIds(ids) {
//         localStorage.setItem(storageKey, JSON.stringify(ids));
//     }

//     function localSetButtonToPrimary($button, currentSelectedIds, btnId) {
//         $button.removeClass('active btn-success').addClass('btn-primary');
//         const index = currentSelectedIds.indexOf(btnId);
//         if (index > -1) {
//             currentSelectedIds.splice(index, 1);
//         }
//     }

//     function localSetButtonToActive($button, currentSelectedIds, btnId) {
//         $button.removeClass('btn-primary').addClass('active btn-success');
//         if (currentSelectedIds.indexOf(btnId) === -1) {
//             currentSelectedIds.push(btnId);
//         }
//     }

//     function localSetImageStyle($button, currentSelectedIds, btnId) {
//         var buttonFullName = $button.data('extra-param'); // Пълното име на бутона
//         console.log('Добавяне на стил (клиентска страна):', buttonFullName);
//         localSetButtonToActive($button, currentSelectedIds, btnId); // Обновява UI и масива currentSelectedIds
//         saveSelectedIds(currentSelectedIds); // Запазва в localStorage
//     }

//     function localRemoveImageStyle($button, currentSelectedIds, btnId) {
//         var buttonFullName = $button.data('extra-param'); // Пълното име на бутона      
//         console.log('Премахване на стил (клиентска страна):', buttonFullName);
//         localSetButtonToPrimary($button, currentSelectedIds, btnId); // Обновява UI и масива currentSelectedIds
//         saveSelectedIds(currentSelectedIds); // Запазва в localStorage
//     }

//     // Обработка на клик върху бутон - използваме event delegation за по-голяма гъвкавост
//     $(document).on('click', buttonSelector, function() {
//         var $button = $(this);
//         var btnId = $button.data('btn-id'); // data-btn-id съхранява уникалната част от ID-то
//         var selectedIds = getSelectedIds(); // Взимаме текущото състояние от sessionStorage

//         if ($button.hasClass('active')) {
//             // Бутонът е активен, деактивираме го
//             localRemoveImageStyle($button, selectedIds, btnId);
//         } else {
//             // Бутонът не е активен, активираме го
//             localSetImageStyle($button, selectedIds, btnId);
//         }
//     });

//     // Функция за прилагане на първоначално избраните бутони при зареждане на страницата
//     function applyInitialSelections() {
//         var initialSelectedIds = getSelectedIds();
//         initialSelectedIds.forEach(function(id) {
//             $('#' + buttonIdPrefix + id).removeClass('btn-primary').addClass('active btn-success');
//         });
//     }

//     applyInitialSelections(); // Прилагане на запазените селекции при инициализация
// }


// function genrateImage() {
//     // Място за бъдещ JavaScript код, ако е необходим за новите елементи (напр. event handlers за бутоните "GO" и "RAND")
//     $(document).ready(function () {
//         function performImageGenerationRequest(isRandomRequest) {
//             const promptText = $('#text-prompt').val().trim();
//             if (!isRandomRequest && !promptText) { // Проверка за текст само ако не е RAND заявка
//                 alert('Моля, въведете текст за генериране на изображение.');
//                 return;
//             }

//             let allSelectedStyleNames = [];
//             for (let i = 0; i < localStorage.length; i++) {
//                 const key = localStorage.key(i);
//                 if (key && key.endsWith('-selections')) {
//                     const storedValue = localStorage.getItem(key);
//                     const selectedIdsInGroup = storedValue ? JSON.parse(storedValue) : [];
//                     selectedIdsInGroup.forEach(function(id) {
//                         // Трябва да намерим бутона по ID, за да вземем data-extra-param (пълното име на стила)
//                         // Префиксът на ID-то на бутона е buttonType + '-btn-'
//                         // Ключът в localStorage е buttonType + '-selections'
//                         const buttonTypeFromKey = key.replace('-selections', '');
//                         const buttonFullId = '#' + buttonTypeFromKey + '-btn-' + id;
//                         const styleName = $(buttonFullId).data('extra-param');
//                         if (styleName) {
//                             allSelectedStyleNames.push(styleName);
//                         }
//                     });
//                 }
//             }   


//             const advancedSettings = {
//                 useCfgScale: $('#enable-cfg-scale').is(':checked'),
//                 cfgScaleValue: $('#enable-cfg-scale').is(':checked') ? parseFloat($('#cfg-scale-slider').val()) : null,
//                 useSampler: $('#enable-sampler').is(':checked'),
//                 samplerValue: $('#enable-sampler').is(':checked') ? $('input[name="sampler-options"]:checked').val() : null,
//                 batchCount: parseInt($('#batch-scale-slider').val(), 10) || 1,
//                 positivePromptAdditions: $('#positive-prompt-additions').val().trim(),
//                 negativePromptAdditions: $('#negative-prompt-additions').val().trim()
//             };

//             const imageDisplayArea = $('#image-display-area'); // Кешираме селектора
//             const loadingSpinner = $('#loading-spinner'); // Кешираме селектора

//             const payload = JSON.stringify({ 
//                 isRandom: isRandomRequest, 
//                 prompt: promptText,
//                 selectedStyles: allSelectedStyleNames,
//                 ...advancedSettings // Добавяме събраните допълнителни настройки
//             });

//             $.ajax({
//                 url: '/Home/GenerateImageAsync',
//                 type: 'POST',
//                 contentType: 'application/json',
//                 data: payload,  
//                 // headers: {
//                 //     'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
//                 // },
//                 beforeSend: function () {
//                     imageDisplayArea.children('img').css('opacity', 0.5); // Намаляваме наситеността на съществуващите картинки
//                     loadingSpinner.css({ // Позиционираме спинъра в горната част, централно
//                         top: '20px', // Малко отстояние от горния ръб
//                         left: '50%',
//                         transform: 'translateX(-50%)', // Само хоризонтално центриране
//                         // 'translateY(-50%)' се премахва, за да не се центрира вертикално спрямо цялата височина
//                         position: 'absolute' // Гарантираме, че е абсолютно позициониран
//                     }).show();
//                     $('#go-button').prop('disabled', true); // Деактивирайте бутона по време на заявка
//                     $('#rand-button').prop('disabled', true);
//                 },
//                 success: function (response) {
//                     // if (response.success && response.imageUrl) {
//                     //     $('#generated-image').attr('src', response.imageUrl).css('opacity', 1);
//                     // } else {
//                     //     console.error('Image generation failed:', response.message);
//                     //     alert(response.message || 'Грешка при генериране на изображението.');
//                     //     // Може да върнете placeholder изображение или да покажете съобщение за грешка в #image-display-area
//                     //     $('#generated-image').attr('src', 'https://picsum.photos/800/600?grayscale&blur=2').css('opacity', 1);
//                     // }

//                     //alert(response.message); // Показваме съобщението от сървъра

//                     if (response.success && response.imageUrls && response.imageUrls.length > 0) {
//                         imageDisplayArea.children().not(loadingSpinner).remove(); // Изчистваме предишното съдържание, но запазваме спинъра

//                         response.imageUrls.forEach(function(url, index) {
//                         // Създаваме нов img елемент за всяко изображение
//                             const imgElement = $('<img>')
//                                 .attr('src', url)
//                                 .addClass('img-fluid rounded mb-2') // Добавяме класове за стилизация, mb-2 за малко разстояние
//                                 .attr('alt', 'Генерирано изображение ' + (index + 1))
//                                 .css('opacity', 1); // Гарантираме пълна наситеност
//                             imageDisplayArea.append(imgElement);
//                         });
//                     } else if (response.success && (!response.imageUrls || response.imageUrls.length === 0)) {
//                         imageDisplayArea.children().not(loadingSpinner).remove(); // Изчистваме, запазваме спинъра
//                         console.warn('Image generation successful but no images returned.');
//                         alert('Генерирането беше успешно, но не бяха върнати изображения.');
//                         imageDisplayArea.append($('<p class="text-light">Генерирането беше успешно, но не бяха върнати изображения.</p>').css('opacity',1));
//                     } else {
//                         imageDisplayArea.children().not(loadingSpinner).remove(); // Изчистваме, запазваме спинъра
//                         console.error('Image generation failed:', response.message);
//                         alert(response.message || 'Грешка при генериране на изображението.');
//                         // Връщане на placeholder изображение или показване на съобщение за грешка
//                         const errorImage = $('<img>')
//                             .attr('src', 'https://picsum.photos/800/600?grayscale&blur=2')
//                             .addClass('img-fluid rounded')
//                             .attr('alt', 'Грешка при генериране')
//                             .css('opacity', 1); // Гарантираме пълна наситеност
//                         imageDisplayArea.append(errorImage);
//                     }
//                 },
//                 error: function (xhr, status, error) {
//                     imageDisplayArea.children().not(loadingSpinner).remove(); // Изчистваме, запазваме спинъра
//                     console.error('Error generating image via AJAX:', status, error);
//                     alert('Възникна грешка при комуникация със сървъра. Моля, опитайте отново.');
//                     const errorPlaceholder = $('<img>')
//                         .attr('src', 'https://picsum.photos/800/600?grayscale&blur=2')
//                         .addClass('img-fluid rounded')
//                         .attr('alt', 'Грешка при генериране на изображение - сървърна грешка')
//                         .css('opacity', 1); // Гарантираме пълна наситеност
//                     imageDisplayArea.append(errorPlaceholder);
//                 },
//                 complete: function () {
//                     // По желание: премахнете индикатора за зареждане
//                     loadingSpinner.hide();
//                     // Всички видими изображения вече трябва да са с opacity: 1 от success/error блоковете
//                     // imageDisplayArea.children('img').css('opacity', 1); // Като допълнителна мярка, ако е нужно
//                     $('#go-button').prop('disabled', false); // Активирайте бутона отново
//                     $('#rand-button').prop('disabled', false);
//                 }
//             });
//             // Тук ще добавите логика за генериране на изображение
//         };
        
//         $('#go-button').on('click', function () {
//             performImageGenerationRequest(false);
//         });

//         $('#rand-button').on('click', function () {
//             performImageGenerationRequest(true);
//         });      
//     });
// }

// function clearCurrentStyle() {
//     $('#clear-button').on('click', function () {
//         if (!confirm("Сигурни ли сте, че искате да изчистите всички избрани стилове?")) {
//             return; // Потребителят е отказал
//         }

//         console.log('Изчистване на всички стилове (клиентска страна).');

//         // 1. Изчистване на localStorage за ключове, завършващи на '-selections'
//         // Трябва да се внимава да не се изтрият други важни неща от localStorage.
//         // По-безопасен подход е да се знае точно кои ключове да се изтрият.
//         // Засега приемаме, че всички ключове, завършващи на '-selections', са за стилове.
//         let keysToRemove = [];
//         for (let i = 0; i < localStorage.length; i++) {
//             const key = localStorage.key(i);
//             if (key && key.endsWith('-selections')) {
//                 keysToRemove.push(key);
//             }
//         }
//         keysToRemove.forEach(key => {
//             localStorage.removeItem(key);
//             console.log('Изчистен localStorage ключ:', key);
//         });

//         // 2. Нулиране на UI на бутоните за стилове
//         $('[data-btn-type]').each(function() {
//             var $button = $(this);
//             if ($button.hasClass('active') || $button.hasClass('btn-success')) {
//                 $button.removeClass('active btn-success').addClass('btn-primary');
//             }
//         });

//         alert('Всички избрани стилове бяха успешно изчистени от браузъра.');
//     });
// }


// function praska() {
//     console.log('PRASKA clicked');
//     $.ajax({
//         url: '/Home/NovaFunctions', // Уверете се, че този URL е правилен
//         type: 'GET', // Заявката трябва да е GET, съгласно [HttpGet] атрибута на сървъра
//         dataType: 'text', // Указваме, че очакваме текстов отговор
//         success: function (response) {
//             // 'response' тук ще бъде текстовият низ, върнат от сървъра
//             console.log('Съобщение от сървъра:', response);
//             // Можете да визуализирате съобщението на страницата, ако е необходимо
//             // например: alert('Съобщение от сървъра: ' + response);
//         },
//         error: function (xhr, status, error) {
//             console.error('Грешка при AJAX заявката към NovaFunctions:', status, error);
//             alert('Възникна грешка при опит за връзка със сървъра.');
//         }
//     });
// };

// // Функция за управление на видимостта на панела с допълнителни настройки
// function initializeAdvancedSettingsToggle() {
//     const settingsButton = $('#settings-button');
//     const advancedSettingsPanel = $('#advanced-settings-panel');
//     const cfgScaleSlider = $('#cfg-scale-slider');
//     const cfgScaleValueDisplay = $('#cfg-scale-value');
//     const batchSizeSlider = $('#batch-scale-slider');
//     const batchSizeValueDisplay = $('#batch-scale-value');
//     const enableCfgScaleCheckbox = $('#enable-cfg-scale');
//     const positivePromptTextarea = $('#positive-prompt-additions');
//     const negativePromptTextarea = $('#negative-prompt-additions');

//     // Коригирани селектори спрямо HTML
//     const samplerRadios = $('input[name="scheduler-options"]'); 
//     const enableSamplerCheckbox = $('#enable-scheduler');

//     // Ключове за sessionStorage
//     const KEY_ENABLE_CFG = 'advancedSettings_localStorage_enableCfgScale';
//     const KEY_CFG_VALUE = 'advancedSettings_localStorage_cfgScaleValue';
//     const KEY_BATCH_VALUE = 'advancedSettings_localStorage_batchSizeValue'; 
//     const KEY_ENABLE_SAMPLER = 'advancedSettings_localStorage_enableSampler';
//     const KEY_SAMPLER_VALUE = 'advancedSettings_localStorage_samplerValue';
//     const KEY_POSITIVE_PROMPT = 'advancedSettings_localStorage_positivePrompt';
//     const KEY_NEGATIVE_PROMPT = 'advancedSettings_localStorage_negativePrompt';

//     // Функция за зареждане на настройките от sessionStorage
//     function loadSettings() {
//         // CFG Scale
//         const storedEnableCfg = localStorage.getItem(KEY_ENABLE_CFG);
//         if (storedEnableCfg !== null) {
//             enableCfgScaleCheckbox.prop('checked', JSON.parse(storedEnableCfg)).trigger('change'); // trigger change за да се обнови disabled състоянието
//         }
//         const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
//         if (storedCfgValue !== null && enableCfgScaleCheckbox.is(':checked')) {
//             cfgScaleSlider.val(storedCfgValue).trigger('input'); // trigger input за да се обнови дисплея
//         } else if (!enableCfgScaleCheckbox.is(':checked')) {
//             cfgScaleSlider.val(5); // Връщане на default стойност, ако е disabled
//             cfgScaleValueDisplay.text(5);
//         }

//         // BATCH Scale
//         const storedBatchValue = localStorage.getItem(KEY_BATCH_VALUE);
//         if (storedBatchValue !== null) {
//             batchSizeSlider.val(storedBatchValue).trigger('input'); // trigger input за да се обнови дисплея
//         } else {
//             batchSizeSlider.val(1); // Връщане на default стойност
//             batchSizeValueDisplay.text(1); // Актуализиране на дисплея
//             localStorage.setItem(KEY_BATCH_VALUE, '1'); // Запазване на default стойността в localStorage
//         }


//         // Sampler
//         const storedEnableSampler = localStorage.getItem(KEY_ENABLE_SAMPLER);
//         if (storedEnableSampler !== null) {
//             enableSamplerCheckbox.prop('checked', JSON.parse(storedEnableSampler)).trigger('change');
//         }
//         const storedSamplerValue = localStorage.getItem(KEY_SAMPLER_VALUE);
//         if (storedSamplerValue !== null && enableSamplerCheckbox.is(':checked')) {
//             samplerRadios.filter(`[value="${storedSamplerValue}"]`).prop('checked', true);
//         } else if (!enableSamplerCheckbox.is(':checked')) {
//              samplerRadios.filter('[value="normal"]').prop('checked', true); // Връщане на default, ако е disabled
//         }

//         // Text Prompts
//         const storedPositivePrompt = localStorage.getItem(KEY_POSITIVE_PROMPT);
//         if (storedPositivePrompt !== null) {
//             positivePromptTextarea.val(storedPositivePrompt);
//         }
//         const storedNegativePrompt = localStorage.getItem(KEY_NEGATIVE_PROMPT);
//         if (storedNegativePrompt !== null) {
//             negativePromptTextarea.val(storedNegativePrompt);
//         }
//     }

//     settingsButton.on('click', function() {
//         advancedSettingsPanel.slideToggle(); // Използваме slideToggle за плавен ефект
//     });

//     // Управление на CFG Scale Slider
//     if (enableCfgScaleCheckbox.length && cfgScaleSlider.length && cfgScaleValueDisplay.length) {
//         enableCfgScaleCheckbox.on('change', function() {
//             const isChecked = $(this).is(':checked');
//             cfgScaleSlider.prop('disabled', !isChecked);
//             localStorage.setItem(KEY_ENABLE_CFG, isChecked);
//             if (!isChecked) { // Ако се деактивира, може да искаме да нулираме стойността или да я запазим
//                 // localStorage.removeItem(KEY_CFG_VALUE); // По избор: изтриване на стойността
//             } else {
//                 // Ако се активира и има запазена стойност, приложи я
//                 const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
//                 if (storedCfgValue) cfgScaleSlider.val(storedCfgValue).trigger('input');
//             }
//         });

//         cfgScaleSlider.on('input', function() {
//             cfgScaleValueDisplay.text($(this).val());
//             if (enableCfgScaleCheckbox.is(':checked')) { // Запазваме само ако е активен
//                 localStorage.setItem(KEY_CFG_VALUE, $(this).val());
//             }
//         });
//     }

//     // Управление на Batch Scale Slider
//     if (batchSizeSlider.length && batchSizeValueDisplay.length) {
//         //const isChecked = $(this).is(':checked');
//         //cfgScaleSlider.prop('disabled', !isChecked);
//         //localStorage.setItem(KEY_ENABLE_CFG, isChecked);
//         //if (!isChecked) { // Ако се деактивира, може да искаме да нулираме стойността или да я запазим
//         //   // localStorage.removeItem(KEY_CFG_VALUE); // По избор: изтриване на стойността
//         //} else {
//         //   // Ако се активира и има запазена стойност, приложи я
//         //   const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
//         //   if (storedCfgValue) cfgScaleSlider.val(storedCfgValue).trigger('input');
//         //}

//         //const storedBatchValue = localStorage.getItem(KEY_BATCH_VALUE);
//         //if (storedBatchValue) batchSizeSlider.val(storedBatchValue).trigger('input');


//         batchSizeSlider.on('input', function () {
//             batchSizeValueDisplay.text($(this).val());
//             localStorage.setItem(KEY_BATCH_VALUE, $(this).val());
//         });
//     }

//     // Управление на Sampler Radio Buttons
//     if (enableSamplerCheckbox.length && samplerRadios.length) {
//         enableSamplerCheckbox.on('change', function() {
//             const isChecked = $(this).is(':checked');
//             samplerRadios.prop('disabled', !isChecked);
//             localStorage.setItem(KEY_ENABLE_SAMPLER, isChecked);
//             if (!isChecked) {
//                 // localStorage.removeItem(KEY_SAMPLER_VALUE); // По избор
//             } else {
//                 const storedSamplerValue = localStorage.getItem(KEY_SAMPLER_VALUE);
//                 if (storedSamplerValue) samplerRadios.filter(`[value="${storedSamplerValue}"]`).prop('checked', true);
//             }
//         });
//         samplerRadios.on('change', function() {
//             if (enableSamplerCheckbox.is(':checked')) { // Запазваме само ако е активен
//                 localStorage.setItem(KEY_SAMPLER_VALUE, $(this).val());
//             }
//         });
//     }

//     // Управление на текстовите полета
//     positivePromptTextarea.on('input', function() { localStorage.setItem(KEY_POSITIVE_PROMPT, $(this).val()); });
//     negativePromptTextarea.on('input', function() { localStorage.setItem(KEY_NEGATIVE_PROMPT, $(this).val()); });

//     loadSettings(); // Зареждане на запазените настройки при инициализация
// }