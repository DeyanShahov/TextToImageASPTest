using System;
using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TextToImageASPTest.Models;
using TextToImageCore;
using TextToImageCore.services;

namespace TextToImageASPTest.Controllers
{
    public class HomeController : Controller
    {
        static string serverAddress = "77.77.134.134:8188";
        private readonly ILogger<HomeController> _logger;
        public static ComfyUiServices comfyUi = new ComfyUiServices(serverAddress);

        public HomeController(ILogger<HomeController> logger)
        {
            _logger = logger;
        }

        public IActionResult Index()
        {
            return View();
        }

        public IActionResult Privacy()
        {
            return View();
        }

        public IActionResult Photography()
        {
            ViewData["Title"] = "Фотография";
            return View();
        }

        public IActionResult Painting()
        {
            ViewData["Title"] = "Картина";
            return View();
        }

        public IActionResult Illustration()
        {
            ViewData["Title"] = "Илюстрация";
            return View();
        }

        public IActionResult Drawing()
        {
            ViewData["Title"] = "Рисунка";
            return View();
        }

        public IActionResult ThreeD()
        {
            ViewData["Title"] = "3D";
            return View();
        }

        public IActionResult Vector()
        {
            ViewData["Title"] = "Вектор";
            return View();
        }

        public IActionResult Design()
        {
            ViewData["Title"] = "Дизайн";
            return View();
        }

        public IActionResult Fashion()
        {
            ViewData["Title"] = "Мода";
            return View();
        }

        public IActionResult Art()
        {
            ViewData["Title"] = "Арт";
            return View();
        }

        public IActionResult Craft()
        {
            ViewData["Title"] = "Занаят";
            return View();
        }

        public IActionResult Experimental()
        {
            ViewData["Title"] = "Експериментален";
            return View();
        }

        [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
        public IActionResult Error()
        {
            return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
        }


        [HttpPost]
        public IActionResult AddStyleSelection([FromBody] StyleFullNameModel styleFullName)
        {
            if (styleFullName == null || string.IsNullOrWhiteSpace(styleFullName.buttonFullName) || string.IsNullOrWhiteSpace(styleFullName.buttonFullName))
            {
                return BadRequest(new { success = false, message = "Невалидни данни." });
            }

            try
            {
                bool success = data.AddStyle(styleFullName.buttonFullName);

                if (success)
                {
                    return Json(new { success = true, message = "Стилът е добавен успешно." });
                }
                else
                {
                    // Ако AddStyle връща false при неуспех (напр. стилът вече съществува и не е добавен отново)
                    return Json(new { success = false, message = "Стилът не беше добавен (може би вече съществува)." });
                }
            }
            catch (Exception ex)
            {
                // Добра практика е да логвате грешката
                // Logger.LogError(ex, "Error adding style selection.");
                return StatusCode(500, new { success = false, message = "Възникна сървърна грешка." });
            }
        }

      

        [HttpPost]
        public IActionResult RemoveStyleSelection([FromBody] StyleFullNameModel styleFullName)
        {
            if (styleFullName == null || string.IsNullOrWhiteSpace(styleFullName.buttonFullName) || string.IsNullOrWhiteSpace(styleFullName.buttonFullName))
            {
                return BadRequest(new { success = false, message = "Невалидни данни." });
            }
            try
            {
                data.RemoveStyle(styleFullName.buttonFullName);
                return Json(new { success = true, message = "Стилът е премахнат успешно." });
            }
            catch (Exception ex)
            {
                // Добра практика е да логвате грешката
                // Logger.LogError(ex, "Error removing style selection.");
                return StatusCode(500, new { success = false, message = "Възникна сървърна грешка." });
            }
        }

        [HttpPost]
        public IActionResult ClearStyleSelection()
        {
            try
            {
                data.ClearSelectedStyles();
                return Json(new { success = true, message = "Всички стилове са премахнати успешно." });
            }
            catch (Exception ex)
            {
                // Добра практика е да логвате грешката
                // Logger.LogError(ex, "Error clearing style selection.");
                return StatusCode(500, new { success = false, message = "Възникна сървърна грешка." });
            }
        }


        [HttpPost("Home/GenerateImageAsync")]
        [ValidateAntiForgeryToken]
        public async Task<IActionResult> GenerateImageAsync([FromBody] ImageRequestModel model)
        {

            bool isRandom = model.IsRandom;
            string prompt = model.Prompt;

            string promptText = !isRandom ? (prompt ?? "").Trim() : CreatePortrait.GeneratePortraitPrompt();

            if (string.IsNullOrEmpty(promptText))
            {
                return Json(new { success = false, message = "Моля, въведете текст за генериране на изображение."});
            }

            // --- Начало на промените за таймаут ---
            CancellationTokenSource cts = new CancellationTokenSource();
            try
            {
                // Задаваме таймаут от 20 секунди
                cts.CancelAfter(TimeSpan.FromSeconds(20));

                // Получаваме списък с имената на избраните стилове
                var selectedStyle1Names = data.GetSelectedStyleNames();
                //var selectedStyle2Names = StylesManager.GetSelectedStyleNames(); // Предполагам, че имаш и такъв мениджър

                // Извикваме услугата с CancellationToken
                // ВАЖНО: Увери се, че твоят ComfyUiServices.GenerateImageFromText метод приема CancellationToken!
                //var images = await comfyUi.GenerateImageFromText(promptText, selectedStyle1Names, new List<string>(), cts.Token);
                _logger.LogInformation($"Generating image with prompt: {promptText} and styles: {string.Join(", ", selectedStyle1Names)}");
                List<byte[]> imageBytesList = await comfyUi.GenerateImageFromText(promptText, selectedStyle1Names, new List<string>(), cts.Token);

                _logger.LogInformation($"Image generation completed. Images received: {imageBytesList?.Count ?? 0}");
                if(imageBytesList != null && imageBytesList.Count > 0){
                    // Показваме първото генерирано изображение
                    //ResultImage.Source = ImageSource.FromStream(() => new MemoryStream(imageBytesList[0]));
                    //AppSettings.imageCounter++; // Увеличаваме брояча на генерираните изображения
                    byte[] firstImageBytes = imageBytesList[0];
                    string base64Image = Convert.ToBase64String(firstImageBytes);
                    // Препоръчително е да се укаже типа на изображението, ако е известен (напр. image/png, image/jpeg)
                    string imageUrl = $"data:image/png;base64,{base64Image}"; 
                    
                    // AppSettings.imageCounter++; // Ако все още използвате този брояч
                    return Json(new { success = true, imageUrl = imageUrl });
                }
                else
                {
                    _logger.LogWarning("Generation returned no images for prompt: {Prompt}", promptText);
                    return Json(new { success = false, message = "Не бяха генерирани изображения." });
                }
                //System.Diagnostics.Debug.WriteLine($"Generation finished. Images received: {images?.Count ?? 0}");
                // if (images != null && images.Count > 0)
                // {
                //     // Показваме първото генерирано изображение
                //     ResultImage.Source = ImageSource.FromStream(() => new MemoryStream(images[0]));
                //     AppSettings.imageCounter++; // Увеличаваме брояча на генерираните изображения
                // }
                // else
                // {
                //     System.Diagnostics.Debug.WriteLine("Generation returned no images.");
                //     // Може да покажеш съобщение на потребителя тук
                // }
            }
            catch (OperationCanceledException)
            {
                // Това се случва, ако cts.CancelAfter() се задейства (таймаут)
                //System.Diagnostics.Debug.WriteLine("Image generation timed out after 10 seconds.");
                //await DisplayAlert("Таймаут", "Генерирането отне твърде дълго време и беше прекратено.", "OK");
                //ResultImage.Source = null; // Изчистваме изображението при таймаут
                //ResultImage.Opacity = 1; // Връщаме нормална прозрачност
                _logger.LogWarning("Image generation timed out for prompt: {Prompt}", promptText);
                return Json(new { success = false, message = "Генерирането отне твърде дълго време и беше прекратено." });
            }
            catch (Exception ex)
            {
                // Хващаме други грешки (мрежови, от сървъра и т.н.)
                //System.Diagnostics.Debug.WriteLine($"An error occurred during image generation: {ex.Message}");
                //await DisplayAlert("Грешка", $"Възникна грешка при генериране: {ex.Message}", "OK");
                //ResultImage.Source = null; // Изчистваме изображението при грешка
                //ResultImage.Opacity = 1;
                _logger.LogError(ex, "Error during image generation for prompt: {Prompt}", promptText);
                return StatusCode(500, new { success = false, message = $"Възникна сървърна грешка: {ex.Message}" });
            }
            finally
            {
                // Този блок се изпълнява ВИНАГИ - при успех, таймаут или грешка
                //ResetGenerationState();
                cts.Dispose(); // Освобождаваме ресурсите на CancellationTokenSource
            }
            // --- Край на промените за таймаут ---

        }


        [HttpGet]
        public string NovaFunctions()
        {
           return comfyUi.Hello();
        }

    }


    public class StyleSelectionModel
    {
        public string ButtonName { get; set; }
        public string StyleName { get; set; }
    }

    public class ImageRequestModel
    {
        public bool IsRandom { get; set; }
        public string Prompt { get; set; }
    }

    public class StyleFullNameModel
    {
        public string buttonFullName { get; set; }
    }
}
