// Функция за инициализиране на функционалност на бутоните с множествен избор
function newButtonsFunctionality(buttonType) {
    const storageKey = buttonType + '-selections'; // Динамичен ключ за sessionStorage
    const buttonSelector = '[data-btn-type="' + buttonType + '"]';
    const buttonIdPrefix = buttonType + '-btn-'; // Префикс за ID-тата на бутоните

    //Функция за извличане на избраните ID-та от sessionStorage
    function getSelectedIds() {
        const storedValue = sessionStorage.getItem(storageKey);
        return storedValue ? JSON.parse(storedValue) : [];
    }

    //Функция за запазване на избраните ID-та в sessionStorage
    function saveSelectedIds(ids) {
        sessionStorage.setItem(storageKey, JSON.stringify(ids));
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
        var buttonName = $button.text().trim(); // Текстът на бутона
        var styleName = buttonType; // Типът на бутона (категорията) - от closure
        var buttonFullName = $button.data('extra-param'); // Пълното име на бутона

        console.log();
        // Изпращане на AJAX заявка към сървъра за запис на стила
        $.ajax({
            url: '/Home/AddStyleSelection',
            type: 'POST',
            contentType: 'application/json',
            //data: JSON.stringify({ buttonName: buttonName, styleName: styleName }),
            data: JSON.stringify({ buttonFullName: buttonFullName }),
            //contentType: 'text/plain; charset=UTF-8',
            //data: buttonFullName,
            success: function(response) {
                if (response.success) {
                    console.log('Стилът е успешно записан на сървъра:', response.message);
                    localSetButtonToActive($button, currentSelectedIds, btnId); // Обновява UI и масива currentSelectedIds
                    saveSelectedIds(currentSelectedIds); // Запазва в sessionStorage САМО при успех
                } else {
                    console.warn('Неуспешен запис на стила на сървъра:', response.message);
                    // При неуспех не променяме sessionStorage, за да остане консистентен с последното успешно състояние
                }
            },
            error: function(xhr, status, error) {
                console.error('Грешка при AJAX заявката за запис на стил:', status, error, xhr.responseText);
            }
        });
    }

    function localRemoveImageStyle($button, currentSelectedIds, btnId) {
        var buttonName = $button.text().trim(); // Текстът на бутона
        var styleName = buttonType; // Типът на бутона (категорията) - от closure
        var buttonFullName = $button.data('extra-param'); // Пълното име на бутона

        // Изпращане на AJAX заявка към сървъра за изтриване на стила
        $.ajax({
            url: '/Home/RemoveStyleSelection',
            type: 'POST',
            contentType: 'application/json',
            //data: JSON.stringify({ buttonName: buttonName, styleName: styleName }),
            data: JSON.stringify({ buttonFullName: buttonFullName }),
            success: function (response) {
                if (response.success) {
                    console.log('Стилът е успешно изтрит от сървъра:', response.message);
                    localSetButtonToPrimary($button, currentSelectedIds, btnId); // Обновява UI и масива currentSelectedIds
                    saveSelectedIds(currentSelectedIds); // Запазва в sessionStorage САМО при успех
                } else {
                    console.warn('Неуспешно изтриване на стила от сървъра:', response.message);
                }
            },
            error: function (xhr, status, error) {
                console.error('Грешка при AJAX заявката за изтриване на стил:', status, error, xhr.responseText);
            }
        });
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

            const payload = JSON.stringify({ isRandom: isRandomRequest, prompt: promptText });

            $.ajax({
                url: '/Home/GenerateImageAsync',
                type: 'POST',
                contentType: 'application/json',
                data: payload,  
                headers: {
                    'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
                },
                beforeSend: function () {
                    $('#generated-image').css('opacity', 0.5);
                    $('#loading-spinner').show();
                    $('#go-button').prop('disabled', true); // Деактивирайте бутона по време на заявка
                    $('#rand-button').prop('disabled', true);
                },
                success: function (response) {
                    if (response.success && response.imageUrl) {
                        $('#generated-image').attr('src', response.imageUrl).css('opacity', 1);
                    } else {
                        console.error('Image generation failed:', response.message);
                        alert(response.message || 'Грешка при генериране на изображението.');
                        // Може да върнете placeholder изображение или да покажете съобщение за грешка в #image-display-area
                        $('#generated-image').attr('src', 'https://picsum.photos/800/600?grayscale&blur=2').css('opacity', 1);
                    }
                },
                error: function (xhr, status, error) {
                    console.error('Error generating image via AJAX:', status, error);
                    alert('Възникна грешка при комуникация със сървъра. Моля, опитайте отново.');
                    $('#generated-image').attr('src', 'https://picsum.photos/800/600?grayscale&blur=2').css('opacity', 1);
                },
                complete: function () {
                    // По желание: премахнете индикатора за зареждане
                    $('#loading-spinner').hide();
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

        $.ajax({
            url: '/Home/ClearStyleSelection', // Път до вашия екшън в контролера
            type: 'POST',
            // headers: {
            //     // Уверете се, че имате @Html.AntiForgeryToken() във вашата View (напр. Index.cshtml или _Layout.cshtml)
            //     'RequestVerificationToken': $('input[name="__RequestVerificationToken"]').val()
            // },
            success: function(response) {
                if (response.success) {
                    console.log('Стиловете са успешно изчистени на сървъра:', response.message);

                    // 1. Изчистване на sessionStorage
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        if (key && key.endsWith('-selections')) {
                            sessionStorage.removeItem(key);
                            console.log('Изчистен sessionStorage ключ:', key);
                        }
                    }

                    // 2. Нулиране на UI на бутоните за стилове
                    $('[data-btn-type]').each(function() {
                        var $button = $(this);
                        if ($button.hasClass('active') || $button.hasClass('btn-success')) {
                            $button.removeClass('active btn-success').addClass('btn-primary');
                        }
                    });

                    alert('Всички избрани стилове бяха успешно изчистени.');

                } else {
                    console.warn('Неуспешно изчистване на стиловете от сървъра:', response.message);
                    alert('Грешка при изчистване на стиловете: ' + (response.message || 'Неизвестна сървърна грешка.'));
                }
            },
            error: function(xhr, status, error) {
                console.error('Грешка при AJAX заявката за изчистване на стилове:', status, error, xhr.responseText);
                alert('Възникна грешка при комуникация със сървъра за изчистване на стиловете.');
            }
        });
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