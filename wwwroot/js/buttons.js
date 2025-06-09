// Функция за инициализиране на функционалност на бутоните с множествен избор
function newButtonsFunctionality(buttonType) {
    const storageKey = buttonType + '-selections'; // Динамичен ключ за sessionStorage
    const buttonSelector = '[data-btn-type="' + buttonType + '"]';
    const buttonIdPrefix = buttonType + '-btn-'; // Префикс за ID-тата на бутоните

    //Функция за извличане на избраните ID-та от sessionStorage
    function getSelectedIds() {
        const storedValue = localStorage.getItem(storageKey);
        return storedValue ? JSON.parse(storedValue) : [];
    }

    //Функция за запазване на избраните ID-та в sessionStorage
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

    function localSetImageStyle($button, currentSelectedIds, btnId) {
        var buttonFullName = $button.data('extra-param'); // Пълното име на бутона
        console.log('Добавяне на стил (клиентска страна):', buttonFullName);
        localSetButtonToActive($button, currentSelectedIds, btnId); // Обновява UI и масива currentSelectedIds
        saveSelectedIds(currentSelectedIds); // Запазва в localStorage
    }

    function localRemoveImageStyle($button, currentSelectedIds, btnId) {
        var buttonFullName = $button.data('extra-param'); // Пълното име на бутона      
        console.log('Премахване на стил (клиентска страна):', buttonFullName);
        localSetButtonToPrimary($button, currentSelectedIds, btnId); // Обновява UI и масива currentSelectedIds
        saveSelectedIds(currentSelectedIds); // Запазва в localStorage
    }
    // Обработка на клик върху бутон - използваме event delegation за по-голяма гъвкавост
    $(document).on('click', buttonSelector, function() {
        var $button = $(this);
        var btnId = $button.data('btn-id'); // data-btn-id съхранява уникалната част от ID-то
        var selectedIds = getSelectedIds(); // Взимаме текущото състояние от sessionStorage

        if ($button.hasClass('active')) {
            // Бутонът е активен, деактивираме го
            localRemoveImageStyle($button, selectedIds, btnId);
        } else {
            // Бутонът не е активен, активираме го
            localSetImageStyle($button, selectedIds, btnId);
        }
    });

    // Функция за прилагане на първоначално избраните бутони при зареждане на страницата
    function applyInitialSelections() {
        var initialSelectedIds = getSelectedIds();
        initialSelectedIds.forEach(function(id) {
            $('#' + buttonIdPrefix + id).removeClass('btn-primary').addClass('active btn-success');
        });
    }

    applyInitialSelections(); // Прилагане на запазените селекции при инициализация
}


function genrateImage() {
    // Място за бъдещ JavaScript код, ако е необходим за новите елементи (напр. event handlers за бутоните "GO" и "RAND")
    $(document).ready(function () {
        function performImageGenerationRequest(isRandomRequest) {
            const promptText = $('#text-prompt').val().trim();
            if (!isRandomRequest && !promptText) { // Проверка за текст само ако не е RAND заявка
                alert('Моля, въведете текст за генериране на изображение.');
                return;
            }

            let allSelectedStyleNames = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.endsWith('-selections')) {
                    const storedValue = localStorage.getItem(key);
                    const selectedIdsInGroup = storedValue ? JSON.parse(storedValue) : [];
                    selectedIdsInGroup.forEach(function(id) {
                        // Трябва да намерим бутона по ID, за да вземем data-extra-param (пълното име на стила)
                        // Префиксът на ID-то на бутона е buttonType + '-btn-'
                        // Ключът в localStorage е buttonType + '-selections'
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
                useSampler: $('#enable-sampler').is(':checked'),
                samplerValue: $('#enable-sampler').is(':checked') ? $('input[name="sampler-options"]:checked').val() : null,
                batchCount: parseInt($('#batch-scale-slider').val(), 10) || 1,
                positivePromptAdditions: $('#positive-prompt-additions').val().trim(),
                negativePromptAdditions: $('#negative-prompt-additions').val().trim()
            };

            const imageDisplayArea = $('#image-display-area'); // Кешираме селектора
            const loadingSpinner = $('#loading-spinner'); // Кешираме селектора

            const payload = JSON.stringify({ 
                isRandom: isRandomRequest, 
                prompt: promptText,
                selectedStyles: allSelectedStyleNames,
                ...advancedSettings // Добавяме събраните допълнителни настройки
            });

            $.ajax({
                url: '/Home/GenerateImageAsync',
                type: 'POST',
                contentType: 'application/json',
                data: payload,  
                // headers: {
                //     'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
                // },
                beforeSend: function () {
                    imageDisplayArea.children('img').css('opacity', 0.5); // Намаляваме наситеността на съществуващите картинки
                    loadingSpinner.css({ // Позиционираме спинъра в горната част, централно
                        top: '20px', // Малко отстояние от горния ръб
                        left: '50%',
                        transform: 'translateX(-50%)', // Само хоризонтално центриране
                        // 'translateY(-50%)' се премахва, за да не се центрира вертикално спрямо цялата височина
                        position: 'absolute' // Гарантираме, че е абсолютно позициониран
                    }).show();
                    $('#go-button').prop('disabled', true); // Деактивирайте бутона по време на заявка
                    $('#rand-button').prop('disabled', true);
                },
                success: function (response) {
                    // if (response.success && response.imageUrl) {
                    //     $('#generated-image').attr('src', response.imageUrl).css('opacity', 1);
                    // } else {
                    //     console.error('Image generation failed:', response.message);
                    //     alert(response.message || 'Грешка при генериране на изображението.');
                    //     // Може да върнете placeholder изображение или да покажете съобщение за грешка в #image-display-area
                    //     $('#generated-image').attr('src', 'https://picsum.photos/800/600?grayscale&blur=2').css('opacity', 1);
                    // }

                    //alert(response.message); // Показваме съобщението от сървъра

                    if (response.success && response.imageUrls && response.imageUrls.length > 0) {
                        imageDisplayArea.children().not(loadingSpinner).remove(); // Изчистваме предишното съдържание, но запазваме спинъра

                        response.imageUrls.forEach(function(url, index) {
                        // Създаваме нов img елемент за всяко изображение
                            const imgElement = $('<img>')
                                .attr('src', url)
                                .addClass('img-fluid rounded mb-2') // Добавяме класове за стилизация, mb-2 за малко разстояние
                                .attr('alt', 'Генерирано изображение ' + (index + 1))
                                .css('opacity', 1); // Гарантираме пълна наситеност
                            imageDisplayArea.append(imgElement);
                        });
                    } else if (response.success && (!response.imageUrls || response.imageUrls.length === 0)) {
                        imageDisplayArea.children().not(loadingSpinner).remove(); // Изчистваме, запазваме спинъра
                        console.warn('Image generation successful but no images returned.');
                        alert('Генерирането беше успешно, но не бяха върнати изображения.');
                        imageDisplayArea.append($('<p class="text-light">Генерирането беше успешно, но не бяха върнати изображения.</p>').css('opacity',1));
                    } else {
                        imageDisplayArea.children().not(loadingSpinner).remove(); // Изчистваме, запазваме спинъра
                        console.error('Image generation failed:', response.message);
                        alert(response.message || 'Грешка при генериране на изображението.');
                        // Връщане на placeholder изображение или показване на съобщение за грешка
                        const errorImage = $('<img>')
                            .attr('src', 'https://picsum.photos/800/600?grayscale&blur=2')
                            .addClass('img-fluid rounded')
                            .attr('alt', 'Грешка при генериране')
                            .css('opacity', 1); // Гарантираме пълна наситеност
                        imageDisplayArea.append(errorImage);
                    }
                },
                error: function (xhr, status, error) {
                    imageDisplayArea.children().not(loadingSpinner).remove(); // Изчистваме, запазваме спинъра
                    console.error('Error generating image via AJAX:', status, error);
                    alert('Възникна грешка при комуникация със сървъра. Моля, опитайте отново.');
                    const errorPlaceholder = $('<img>')
                        .attr('src', 'https://picsum.photos/800/600?grayscale&blur=2')
                        .addClass('img-fluid rounded')
                        .attr('alt', 'Грешка при генериране на изображение - сървърна грешка')
                        .css('opacity', 1); // Гарантираме пълна наситеност
                    imageDisplayArea.append(errorPlaceholder);
                },
                complete: function () {
                    // По желание: премахнете индикатора за зареждане
                    loadingSpinner.hide();
                    // Всички видими изображения вече трябва да са с opacity: 1 от success/error блоковете
                    // imageDisplayArea.children('img').css('opacity', 1); // Като допълнителна мярка, ако е нужно
                    $('#go-button').prop('disabled', false); // Активирайте бутона отново
                    $('#rand-button').prop('disabled', false);
                }
            });
            // Тук ще добавите логика за генериране на изображение
        };
        
        $('#go-button').on('click', function () {
            performImageGenerationRequest(false);
        });

        $('#rand-button').on('click', function () {
            performImageGenerationRequest(true);
        });      
    });
}

function clearCurrentStyle() {
    $('#clear-button').on('click', function () {
        if (!confirm("Сигурни ли сте, че искате да изчистите всички избрани стилове?")) {
            return; // Потребителят е отказал
        }

        console.log('Изчистване на всички стилове (клиентска страна).');

        // 1. Изчистване на localStorage за ключове, завършващи на '-selections'
        // Трябва да се внимава да не се изтрият други важни неща от localStorage.
        // По-безопасен подход е да се знае точно кои ключове да се изтрият.
        // Засега приемаме, че всички ключове, завършващи на '-selections', са за стилове.
        let keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.endsWith('-selections')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
            console.log('Изчистен localStorage ключ:', key);
        });

        // 2. Нулиране на UI на бутоните за стилове
        $('[data-btn-type]').each(function() {
            var $button = $(this);
            if ($button.hasClass('active') || $button.hasClass('btn-success')) {
                $button.removeClass('active btn-success').addClass('btn-primary');
            }
        });

        alert('Всички избрани стилове бяха успешно изчистени от браузъра.');
    });
}


function praska() {
    console.log('PRASKA clicked');
    $.ajax({
        url: '/Home/NovaFunctions', // Уверете се, че този URL е правилен
        type: 'GET', // Заявката трябва да е GET, съгласно [HttpGet] атрибута на сървъра
        dataType: 'text', // Указваме, че очакваме текстов отговор
        success: function (response) {
            // 'response' тук ще бъде текстовият низ, върнат от сървъра
            console.log('Съобщение от сървъра:', response);
            // Можете да визуализирате съобщението на страницата, ако е необходимо
            // например: alert('Съобщение от сървъра: ' + response);
        },
        error: function (xhr, status, error) {
            console.error('Грешка при AJAX заявката към NovaFunctions:', status, error);
            alert('Възникна грешка при опит за връзка със сървъра.');
        }
    });
};

// Функция за управление на видимостта на панела с допълнителни настройки
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

    // Коригирани селектори спрямо HTML
    const samplerRadios = $('input[name="scheduler-options"]'); 
    const enableSamplerCheckbox = $('#enable-scheduler');

    // Ключове за sessionStorage
    const KEY_ENABLE_CFG = 'advancedSettings_localStorage_enableCfgScale';
    const KEY_CFG_VALUE = 'advancedSettings_localStorage_cfgScaleValue';
    const KEY_BATCH_VALUE = 'advancedSettings_localStorage_batchSizeValue'; 
    const KEY_ENABLE_SAMPLER = 'advancedSettings_localStorage_enableSampler';
    const KEY_SAMPLER_VALUE = 'advancedSettings_localStorage_samplerValue';
    const KEY_POSITIVE_PROMPT = 'advancedSettings_localStorage_positivePrompt';
    const KEY_NEGATIVE_PROMPT = 'advancedSettings_localStorage_negativePrompt';

    // Функция за зареждане на настройките от sessionStorage
    function loadSettings() {
        // CFG Scale
        const storedEnableCfg = localStorage.getItem(KEY_ENABLE_CFG);
        if (storedEnableCfg !== null) {
            enableCfgScaleCheckbox.prop('checked', JSON.parse(storedEnableCfg)).trigger('change'); // trigger change за да се обнови disabled състоянието
        }
        const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
        if (storedCfgValue !== null && enableCfgScaleCheckbox.is(':checked')) {
            cfgScaleSlider.val(storedCfgValue).trigger('input'); // trigger input за да се обнови дисплея
        } else if (!enableCfgScaleCheckbox.is(':checked')) {
            cfgScaleSlider.val(5); // Връщане на default стойност, ако е disabled
            cfgScaleValueDisplay.text(5);
        }

        // BATCH Scale
        const storedBatchValue = localStorage.getItem(KEY_BATCH_VALUE);
        if (storedBatchValue !== null) {
            batchSizeSlider.val(storedBatchValue).trigger('input'); // trigger input за да се обнови дисплея
        } else {
            batchSizeSlider.val(1); // Връщане на default стойност
            batchSizeValueDisplay.text(1); // Актуализиране на дисплея
            localStorage.setItem(KEY_BATCH_VALUE, '1'); // Запазване на default стойността в localStorage
        }


        // Sampler
        const storedEnableSampler = localStorage.getItem(KEY_ENABLE_SAMPLER);
        if (storedEnableSampler !== null) {
            enableSamplerCheckbox.prop('checked', JSON.parse(storedEnableSampler)).trigger('change');
        }
        const storedSamplerValue = localStorage.getItem(KEY_SAMPLER_VALUE);
        if (storedSamplerValue !== null && enableSamplerCheckbox.is(':checked')) {
            samplerRadios.filter(`[value="${storedSamplerValue}"]`).prop('checked', true);
        } else if (!enableSamplerCheckbox.is(':checked')) {
             samplerRadios.filter('[value="normal"]').prop('checked', true); // Връщане на default, ако е disabled
        }

        // Text Prompts
        const storedPositivePrompt = localStorage.getItem(KEY_POSITIVE_PROMPT);
        if (storedPositivePrompt !== null) {
            positivePromptTextarea.val(storedPositivePrompt);
        }
        const storedNegativePrompt = localStorage.getItem(KEY_NEGATIVE_PROMPT);
        if (storedNegativePrompt !== null) {
            negativePromptTextarea.val(storedNegativePrompt);
        }
    }

    settingsButton.on('click', function() {
        advancedSettingsPanel.slideToggle(); // Използваме slideToggle за плавен ефект
    });

    // Управление на CFG Scale Slider
    if (enableCfgScaleCheckbox.length && cfgScaleSlider.length && cfgScaleValueDisplay.length) {
        enableCfgScaleCheckbox.on('change', function() {
            const isChecked = $(this).is(':checked');
            cfgScaleSlider.prop('disabled', !isChecked);
            localStorage.setItem(KEY_ENABLE_CFG, isChecked);
            if (!isChecked) { // Ако се деактивира, може да искаме да нулираме стойността или да я запазим
                // localStorage.removeItem(KEY_CFG_VALUE); // По избор: изтриване на стойността
            } else {
                // Ако се активира и има запазена стойност, приложи я
                const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
                if (storedCfgValue) cfgScaleSlider.val(storedCfgValue).trigger('input');
            }
        });

        cfgScaleSlider.on('input', function() {
            cfgScaleValueDisplay.text($(this).val());
            if (enableCfgScaleCheckbox.is(':checked')) { // Запазваме само ако е активен
                localStorage.setItem(KEY_CFG_VALUE, $(this).val());
            }
        });
    }

    // Управление на Batch Scale Slider
    if (batchSizeSlider.length && batchSizeValueDisplay.length) {
        //const isChecked = $(this).is(':checked');
        //cfgScaleSlider.prop('disabled', !isChecked);
        //localStorage.setItem(KEY_ENABLE_CFG, isChecked);
        //if (!isChecked) { // Ако се деактивира, може да искаме да нулираме стойността или да я запазим
        //   // localStorage.removeItem(KEY_CFG_VALUE); // По избор: изтриване на стойността
        //} else {
        //   // Ако се активира и има запазена стойност, приложи я
        //   const storedCfgValue = localStorage.getItem(KEY_CFG_VALUE);
        //   if (storedCfgValue) cfgScaleSlider.val(storedCfgValue).trigger('input');
        //}

        //const storedBatchValue = localStorage.getItem(KEY_BATCH_VALUE);
        //if (storedBatchValue) batchSizeSlider.val(storedBatchValue).trigger('input');


        batchSizeSlider.on('input', function () {
            batchSizeValueDisplay.text($(this).val());
            localStorage.setItem(KEY_BATCH_VALUE, $(this).val());
        });
    }

    // Управление на Sampler Radio Buttons
    if (enableSamplerCheckbox.length && samplerRadios.length) {
        enableSamplerCheckbox.on('change', function() {
            const isChecked = $(this).is(':checked');
            samplerRadios.prop('disabled', !isChecked);
            localStorage.setItem(KEY_ENABLE_SAMPLER, isChecked);
            if (!isChecked) {
                // localStorage.removeItem(KEY_SAMPLER_VALUE); // По избор
            } else {
                const storedSamplerValue = localStorage.getItem(KEY_SAMPLER_VALUE);
                if (storedSamplerValue) samplerRadios.filter(`[value="${storedSamplerValue}"]`).prop('checked', true);
            }
        });
        samplerRadios.on('change', function() {
            if (enableSamplerCheckbox.is(':checked')) { // Запазваме само ако е активен
                localStorage.setItem(KEY_SAMPLER_VALUE, $(this).val());
            }
        });
    }

    // Управление на текстовите полета
    positivePromptTextarea.on('input', function() { localStorage.setItem(KEY_POSITIVE_PROMPT, $(this).val()); });
    negativePromptTextarea.on('input', function() { localStorage.setItem(KEY_NEGATIVE_PROMPT, $(this).val()); });

    loadSettings(); // Зареждане на запазените настройки при инициализация
}