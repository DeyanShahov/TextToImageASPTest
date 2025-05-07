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

