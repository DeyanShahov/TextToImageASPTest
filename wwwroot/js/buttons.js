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

        console.log();
        // Изпращане на AJAX заявка към сървъра за запис на стила
        $.ajax({
            url: '/Home/AddStyleSelection',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ buttonName: buttonName, styleName: styleName }),
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

        // Изпращане на AJAX заявка към сървъра за изтриване на стила
        $.ajax({
            url: '/Home/RemoveStyleSelection',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ buttonName: buttonName, styleName: styleName }),
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