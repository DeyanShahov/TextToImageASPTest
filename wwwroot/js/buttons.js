// Store this at the top of your buttons.js or in a shared scope
const PENDING_JOB_ID_KEY = 'pendingImageJobId';
let currentJobIdForUI = null; // Tracks the jobId the UI is currently "aware" of or trying to process
const SPINNER_ID = '#loading-spinner';
const IMAGE_DISPLAY_AREA_ID = '#image-display-area';
const GO_BUTTON_ID = '#go-button';
const RAND_BUTTON_ID = '#rand-button';
const DOWNLOAD_BUTTON_ID = '#download-image-button'; // Вече го имахме
const CHECK_PENDING_JOB_BUTTON_ID = '#check-pending-job-button'; // Updated ID for the button

// Global vars for auto-polling
let autoPollAttemptCount = 0;
let autoPollTimeoutId = null;
const AUTO_POLL_DELAY_MS = 10000; // 10 seconds
const MAX_AUTO_POLL_ATTEMPTS = 2;

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

function updateCheckStatusButtonState() {
    const pendingJobId = localStorage.getItem(PENDING_JOB_ID_KEY);
    if (pendingJobId) {
        $(CHECK_PENDING_JOB_BUTTON_ID).prop('disabled', false).text('ПРОВЕРИ СТАТУС');
    } else {
        $(CHECK_PENDING_JOB_BUTTON_ID).prop('disabled', true).text('ПРОВЕРИ СТАТУС');
    }
}

function clearAutoPolling() {
    if (autoPollTimeoutId) {
        clearTimeout(autoPollTimeoutId);
        autoPollTimeoutId = null;
    }
    autoPollAttemptCount = 0;
    console.log("Автоматичното полиране е изчистено/нулирано.");
}

function clearPendingJobState() {
    console.log("Изчистване на състоянието на чакаща заявка. Текущо ID преди изчистване:", currentJobIdForUI, "Ключ за премахване:", PENDING_JOB_ID_KEY);
    const itemBeforeRemove = localStorage.getItem(PENDING_JOB_ID_KEY);
    localStorage.removeItem(PENDING_JOB_ID_KEY);
    const itemAfterRemove = localStorage.getItem(PENDING_JOB_ID_KEY);
    console.log(`Item '${PENDING_JOB_ID_KEY}' in localStorage before removal: '${itemBeforeRemove}'. After removal: '${itemAfterRemove}'.`);

    currentJobIdForUI = null; 
    console.log("currentJobIdForUI е нулиран.");
    $(DOWNLOAD_BUTTON_ID).hide(); 

    clearAutoPolling(); // Спираме всяко текущо автоматично полиране

    // Изчистване на URL-а на Blob-а, ако има такъв
    const $imgElement = $(IMAGE_DISPLAY_AREA_ID).find('img');
    if ($imgElement.length && $imgElement.attr('src').startsWith('blob:')) {
        URL.revokeObjectURL($imgElement.attr('src'));
    }
    enableSubmitButtons();
    updateCheckStatusButtonState(); // Update the check status button state
    console.log("Състоянието на чакащата заявка е изчистено и UI е нулиран.");
}

function showSpinner() {
    $(SPINNER_ID).css({
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        position: 'absolute'
    }).show();

    $(IMAGE_DISPLAY_AREA_ID).find('img').css('opacity', 0.5); // Намаляваме opacity на съществуващите изображения
}

function hideSpinner() {
    $(SPINNER_ID).hide();
    
    $(IMAGE_DISPLAY_AREA_ID).find('img').css('opacity', 1); // Възстановяваме opacity на всички показани изображения
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

function checkJobStatusOnce(jobId, isAutoPoll = false) {
    if (!jobId) {
        console.warn("checkJobStatusOnce извикан без jobId.");
        if (isAutoPoll) clearAutoPolling();
        enableSubmitButtons();
        updateCheckStatusButtonState(); // Ensure button state is correct
        return;
    }

    // Гарантираме, че проверяваме текущата заявка, особено при автоматично полиране
    if (localStorage.getItem(PENDING_JOB_ID_KEY) !== jobId || currentJobIdForUI !== jobId) {
        console.log(`Проверката за ${jobId} е пропусната, тъй като jobId в localStorage или currentJobIdForUI се е променил.`);
        if (isAutoPoll) clearAutoPolling(); // Спираме авто-полирането за старата заявка
        // Не променяме бутоните тук, тъй като нова заявка може да е стартирала свой цикъл
        return;
    }

    showSpinner();
    if (isAutoPoll) {
        const attemptText = `Авто-проверка (${autoPollAttemptCount + 1}/${MAX_AUTO_POLL_ATTEMPTS})...`;
        disableSubmitButtons(attemptText);
        $(CHECK_PENDING_JOB_BUTTON_ID).prop('disabled', true).text("Авто-проверка...");
        console.log(`Автоматична проверка (опит ${autoPollAttemptCount + 1}/${MAX_AUTO_POLL_ATTEMPTS}) за jobId: ${jobId}`);
    } else {
        console.log(`Ръчна проверка на статус за jobId: ${jobId}`);
        disableSubmitButtons("Проверка...");
        $(CHECK_PENDING_JOB_BUTTON_ID).prop('disabled', true).text('Проверява се...');
    }

    $.ajax({
        url: '/Home/PollJobStatus',
        type: 'GET',
        data: { jobId: jobId },
        dataType: 'json',
        success: function(response) {
            // Отново проверка, дали все още обработваме същата заявка
            if (currentJobIdForUI !== jobId || localStorage.getItem(PENDING_JOB_ID_KEY) !== jobId) {
                console.log(`Отговор за ${jobId} получен, но currentJobIdForUI (${currentJobIdForUI}) или localStorage се е променил. Игнориране.`);
                // Не правим clearAutoPolling тук, защото може нова заявка да го е стартирала
                hideSpinner();
                return;
            }
            console.log("Отговор от проверка:", response);

            if (response.success) {
                if (response.status === "completed") {
                    hideSpinner();
                    clearAutoPolling(); // Спираме всяко по-нататъшно автоматично полиране
                    alert(`Заявка ${jobId} е завършена!`);
                    displayImageResults(response.imageUrls);
                    clearPendingJobState(); // Това ще премахне от localStorage, ще нулира currentJobIdForUI и ще обнови бутоните
                } else if (response.status === "pending" || response.status === "processing") {
                    if (isAutoPoll) {
                        autoPollAttemptCount++;
                        if (autoPollAttemptCount < MAX_AUTO_POLL_ATTEMPTS) {
                            hideSpinner(); // Скриваме спинъра до следващия опит
                            const nextAttemptText = `Авто-проверка (${autoPollAttemptCount + 1}/${MAX_AUTO_POLL_ATTEMPTS})...`;
                            disableSubmitButtons(nextAttemptText); // Бутоните остават деактивирани
                            $(CHECK_PENDING_JOB_BUTTON_ID).prop('disabled', true).text("Авто-проверка...");
                            console.log(`Заявка ${jobId} е ${response.status}. Планиране на следваща авто-проверка (Опит ${autoPollAttemptCount + 1})`);
                            autoPollTimeoutId = setTimeout(() => {
                                checkJobStatusOnce(jobId, true);
                            }, AUTO_POLL_DELAY_MS);
                        } else {
                            hideSpinner();
                            clearAutoPolling();
                            alert(`Автоматичната проверка за заявка ${jobId} приключи (статус: ${response.status}). Моля, проверете ръчно по-късно.`);
                            enableSubmitButtons();
                            updateCheckStatusButtonState();
                        }
                    } else { // Ръчна проверка, все още чакаща
                        hideSpinner();
                        alert(`Заявка ${jobId} все още е със статус: ${response.status}. Моля, опитайте отново по-късно.`);
                        enableSubmitButtons();
                        $(CHECK_PENDING_JOB_BUTTON_ID).prop('disabled', false).text('ПРОВЕРИ СТАТУС');
                    }
                } else { // Неочакван успешен статус от бекенда
                    hideSpinner();
                    if (isAutoPoll) clearAutoPolling();
                    alert(`Заявка ${jobId} върна неочакван статус: ${response.status}. (${response.message || ''})`);
                    enableSubmitButtons();
                    updateCheckStatusButtonState(); // ID-то е все още в localStorage
                }
            } else { // response.success === false (напр. failed, not_found, грешка от бекенда)
                hideSpinner();
                if (isAutoPoll) clearAutoPolling();
                alert(`Проблем със заявка ${jobId}: ${response.message || 'Грешка от сървъра.'} (Статус: ${response.status || 'неизвестен'})`);
                enableSubmitButtons();
                updateCheckStatusButtonState(); // ID-то е все още в localStorage
            }
        },
        error: function(xhr, status, error) {
            hideSpinner();
            console.error(`AJAX грешка по време на ${isAutoPoll ? 'автоматична' : 'ръчна'} проверка за jobId ${jobId}:`, status, error);
            
            if (isAutoPoll) {
                autoPollAttemptCount++;
                if (autoPollAttemptCount < MAX_AUTO_POLL_ATTEMPTS) {
                    const nextAttemptText = `Авто-проверка (${autoPollAttemptCount + 1}/${MAX_AUTO_POLL_ATTEMPTS})...`;
                    disableSubmitButtons(nextAttemptText);
                     $(CHECK_PENDING_JOB_BUTTON_ID).prop('disabled', true).text("Авто-проверка...");
                    console.log(`AJAX грешка при авто-проверка за ${jobId}. Планиране на следващ опит (Опит ${autoPollAttemptCount + 1})`);
                    autoPollTimeoutId = setTimeout(() => {
                        checkJobStatusOnce(jobId, true);
                    }, AUTO_POLL_DELAY_MS);
                } else {
                    clearAutoPolling();
                    alert(`Грешка при автоматична комуникация със сървъра за заявка ${jobId} след ${MAX_AUTO_POLL_ATTEMPTS} опита. Моля, проверете ръчно.`);
                    enableSubmitButtons();
                    updateCheckStatusButtonState();
                }
            } else { // Грешка при ръчна проверка
                alert(`Грешка при комуникация със сървъра за проверка на заявка ${jobId}.`);
                enableSubmitButtons();
                $(CHECK_PENDING_JOB_BUTTON_ID).prop('disabled', false).text('ПРОВЕРИ СТАТУС');
            }
        }
    });
}

function startInitialAutomaticPolling(jobId) {
    clearAutoPolling(); // Изчистваме всяко предходно автоматично полиране
    currentJobIdForUI = jobId; // Задаваме текущата заявка, за която се грижи UI
    autoPollAttemptCount = 0; // Нулираме брояча за новата заявка

    const initialAttemptText = `Авто-проверка (1/${MAX_AUTO_POLL_ATTEMPTS})...`;
    disableSubmitButtons(initialAttemptText);
    $(CHECK_PENDING_JOB_BUTTON_ID).prop('disabled', true).text("Авто-проверка...");
    console.log(`Стартиране на автоматично полиране за нова заявка ID: ${jobId}. Опит ${autoPollAttemptCount + 1}`);

    autoPollTimeoutId = setTimeout(() => {
        checkJobStatusOnce(jobId, true); // Подаваме true за isAutoPoll
    }, AUTO_POLL_DELAY_MS);
}

function initializePendingJobState() {
    clearAutoPolling(); // Гарантираме, че няма артефакти от автоматично полиране от предходна сесия
    const pendingJobId = localStorage.getItem(PENDING_JOB_ID_KEY);
    if (pendingJobId) {
        console.log(`Намерено ID на чакаща заявка при зареждане: ${pendingJobId}. Изисква се ръчна проверка от потребителя.`);
        currentJobIdForUI = pendingJobId; // Задаваме го, за да е наясно UI
        alert(`Имате незавършена заявка с ID: ${pendingJobId}. Моля, проверете статуса й ръчно чрез бутона 'ПРОВЕРИ СТАТУС'.`);
    } else {
        currentJobIdForUI = null;
    }
    updateCheckStatusButtonState(); // Set initial button state for CHECK_PENDING_JOB_BUTTON
    enableSubmitButtons(); // Ensure GO/RAND are enabled
}

function initializeImageGenerationAndUI() {
    // Handle GO and RAND button clicks
    $(GO_BUTTON_ID + ', ' + RAND_BUTTON_ID).on('click', function() {
        const isRandomRequest = $(this).attr('id') === RAND_BUTTON_ID.substring(1);
        
        clearAutoPolling(); // Спираме всяко текущо автоматично полиране, ако потребителят инициира нова заявка

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
            negativePromptAdditions: $('#negative-prompt-additions').val().trim(),
            useSystemNegativePrompt: $('#use-system-negative-prompt').is(':checked') // Добавяме новата настройка
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
                // Не скриваме спинъра тук, ако стартираме авто-полиране, то ще го управлява
                if (response.success && response.status === "submitted" && response.jobId) {
                    localStorage.setItem(PENDING_JOB_ID_KEY, response.jobId);
                    // currentJobIdForUI ще бъде зададен от startInitialAutomaticPolling
                    alert(`Заявка ${response.jobId} е изпратена. Започва автоматична проверка...`);
                    startInitialAutomaticPolling(response.jobId); // Това ще управлява състоянието на бутоните по време на авто-полиране
                } else {
                    hideSpinner(); // Скриваме спинъра, ако подаването е неуспешно веднага
                    let errorMsg = response.message || "Грешка при изпращане на заявката.";
                    displayErrorState(errorMsg, response.jobId); 
                    alert(errorMsg);
                    enableSubmitButtons();
                    updateCheckStatusButtonState(); // Отразяваме текущото състояние на localStorage
                }
            },
            error: function(xhr, status, error) {
                hideSpinner(); // Hide spinner on error too
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
                enableSubmitButtons();
                updateCheckStatusButtonState(); // Отразяваме текущото състояние на localStorage
            }
        });
    });

    // CHECK PENDING JOB STATUS button functionality
    $(CHECK_PENDING_JOB_BUTTON_ID).on('click', function() {
        clearAutoPolling(); // Спираме всяко планирано автоматично полиране преди ръчна проверка
        const jobIdToCheck = localStorage.getItem(PENDING_JOB_ID_KEY);
        if (jobIdToCheck) {
            currentJobIdForUI = jobIdToCheck; // Уверяваме се, че UI е наясно с тази заявка
            checkJobStatusOnce(jobIdToCheck, false); // isAutoPoll = false
        } else {
            alert("Няма запаметена заявка за проверка.");
        }
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
    const useSystemNegativePromptCheckbox = $('#use-system-negative-prompt'); // Нов елемент

    const KEY_ENABLE_CFG = 'advancedSettings_localStorage_enableCfgScale';
    const KEY_CFG_VALUE = 'advancedSettings_localStorage_cfgScaleValue';
    const KEY_BATCH_VALUE = 'advancedSettings_localStorage_batchSizeValue'; 
    const KEY_ENABLE_SAMPLER = 'advancedSettings_localStorage_enableSampler';
    const KEY_SAMPLER_VALUE = 'advancedSettings_localStorage_samplerValue';
    const KEY_USE_SYSTEM_NEGATIVE_PROMPT = 'advancedSettings_localStorage_useSystemNegativePrompt'; // Нов ключ
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

        const storedUseSystemNegativePrompt = localStorage.getItem(KEY_USE_SYSTEM_NEGATIVE_PROMPT);
        if (storedUseSystemNegativePrompt !== null) {
            useSystemNegativePromptCheckbox.prop('checked', JSON.parse(storedUseSystemNegativePrompt));
        } else {
            useSystemNegativePromptCheckbox.prop('checked', false); // Default to false
        }
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

    useSystemNegativePromptCheckbox.on('change', function() {
        localStorage.setItem(KEY_USE_SYSTEM_NEGATIVE_PROMPT, $(this).is(':checked'));
    });

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
    // Дефинираме $imageDisplayArea тук, тъй като не е в обхват в този блок код на глобално ниво
    const $imageDisplayArea = $(IMAGE_DISPLAY_AREA_ID);
    if ($imageDisplayArea.length) { // Уверяваме се, че елементът съществува, преди да добавяме към него
        $imageDisplayArea.append($('<p class="text-warning">Няма върнати изображения.</p>'));
    }
    localStorage.removeItem('lastGeneratedImageUrl');
}

hideSpinner();