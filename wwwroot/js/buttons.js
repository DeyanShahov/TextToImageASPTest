// Функция за инициализиране на функционалност на бутоните
function initButtonsFunctionality(buttonType, categoryName) {
    $(document).ready(function() {
        // Селектор за всички бутони от дадения тип
        var buttonSelector = '[data-btn-type="' + buttonType + '"]';
        
        // Обработка на клик върху бутон
        $(buttonSelector).click(function() {
            var btnId = $(this).data('btn-id');
            
            // Запазва избора в sessionStorage
            sessionStorage.setItem(buttonType + '-selection', btnId);
            
            // Премахва активната класа от всички бутони
            $(buttonSelector).removeClass('active btn-success').addClass('btn-primary');
            
            // Добавя активната класа към избрания бутон
            $(this).removeClass('btn-primary').addClass('active btn-success');
            
            // Показва потвърждение
            showConfirmation(btnId, categoryName);
        });
        
        // Проверява дали има вече запазен избор и го маркира като активен
        var savedChoice = sessionStorage.getItem(buttonType + '-selection');
        if (savedChoice) {
            $('#' + buttonType + '-btn-' + savedChoice).removeClass('btn-primary').addClass('active btn-success');
        }
        
        // Показва потвърждение за избора
        function showConfirmation(btnId, categoryName) {
            // Премахва всички предишни съобщения
            $('.button-confirmation').remove();
            
            // Създава потвърждаващо съобщение
            var confirmationMsg = $('<div class="alert alert-success alert-dismissible fade show mt-3 button-confirmation" role="alert">')
                .html('Избрахте Бутон ' + btnId + ' от ' + categoryName + '. <a href="/Home/Index" class="alert-link">Назад към началната страница</a>.')
                .append('<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>');
            
            // Добавя съобщението след бутоните
            $('.row.justify-content-center').append(
                $('<div class="col-md-8 col-lg-6 mt-3 button-confirmation-container">').append(confirmationMsg)
            );
            
            // Автоматично изчезва след 3 секунди
            setTimeout(function() {
                confirmationMsg.alert('close');
            }, 3000);
        }
    });
}

// Функция за инициализиране на функционалност на бутоните с множествен избор
function newButtonsFunctionality(buttonType) {
    $(document).ready(function() {
        const storageKey = buttonType + '-selections'; // Динамичен ключ за sessionStorage
        const buttonSelector = '[data-btn-type="' + buttonType + '"]';
        const buttonIdPrefix = buttonType + '-btn-'; // Префикс за ID-тата на бутоните

        // Функция за извличане на избраните ID-та от sessionStorage
        function getSelectedIds() {
            const storedValue = sessionStorage.getItem(storageKey);
            return storedValue ? JSON.parse(storedValue) : [];
        }

        // Функция за запазване на избраните ID-та в sessionStorage
        function saveSelectedIds(ids) {
            sessionStorage.setItem(storageKey, JSON.stringify(ids));
        }

        // Обработка на клик върху бутон - използваме event delegation за по-голяма гъвкавост
        $(document).on('click', buttonSelector, function() {
            var $button = $(this);
            // data-btn-id съхранява уникалната част от ID-то (напр. числото)
            var btnId = $button.data('btn-id'); 
            var selectedIds = getSelectedIds();

            if ($button.hasClass('active')) {
                // Бутонът е активен, деактивираме го
                $button.removeClass('active btn-success').addClass('btn-primary');
                const index = selectedIds.indexOf(btnId);
                if (index > -1) {
                    selectedIds.splice(index, 1);
                }
            } else {
                // Бутонът не е активен, активираме го
                $button.removeClass('btn-primary').addClass('active btn-success');
                if (selectedIds.indexOf(btnId) === -1) {
                    selectedIds.push(btnId);
                }
            }
            saveSelectedIds(selectedIds);
        });

        // Функция за прилагане на първоначално избраните бутони при зареждане на страницата
        function applyInitialSelections() {
            var initialSelectedIds = getSelectedIds();
            initialSelectedIds.forEach(function(id) {
                $('#' + buttonIdPrefix + id).removeClass('btn-primary').addClass('active btn-success');
            });
        }

        applyInitialSelections(); // Прилагане на запазените селекции
    });
}
