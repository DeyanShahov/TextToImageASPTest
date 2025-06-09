using System;
using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TextToImageASPTest.Models;
using TextToImageASPTest.Services;

namespace TextToImageASPTest.Controllers
{
    public class HomeController : Controller
    {
        static string serverAddress = "77.77.134.134:8188";
        private readonly ILogger<HomeController> _logger;
        // public static ComfyUiServices comfyUi = new ComfyUiServices(serverAddress);

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
       

        [HttpPost("Home/GenerateImageAsync")]
        // [ValidateAntiForgeryToken]
        public async Task<IActionResult> GenerateImageAsync([FromBody] ImageRequestModel model, CancellationToken cancellationToken)
        {

            bool isRandom = model.IsRandom;
            string prompt = model.Prompt;

            string promptText = !isRandom ? (prompt ?? "").Trim() : CreatePortrait.GeneratePortraitPrompt();

            if (string.IsNullOrEmpty(promptText))
            {
                return Json(new { success = false, message = "Моля, въведете текст за генериране на изображение." });
            }

            // Създаване и попълване на DTO за допълнителните настройки
            var advancedSettingsDto = new AdvancedSettingsDto
            {
                UseCfgScale = model.UseCfgScale,
                // Ако UseCfgScale е true и има стойност, използвай я, иначе използвай стойността по подразбиране от DTO-то
                CfgScale = (model.UseCfgScale && model.CfgScaleValue.HasValue) ? model.CfgScaleValue.Value : new AdvancedSettingsDto().CfgScale,
                BatchSize = model.BatchCount,
                UseScheduler = model.UseSampler,
                // Ако UseSampler е true и има стойност, определи IsKarras, иначе използвай стойността по подразбиране от DTO-то
                IsKarras = (model.UseSampler && !string.IsNullOrEmpty(model.SamplerValue))
                               ? model.SamplerValue.Equals("karras", StringComparison.OrdinalIgnoreCase)
                               : new AdvancedSettingsDto().IsKarras,
                PositivePrompt = model.PositivePromptAdditions ?? string.Empty,
                NegativePrompt = model.NegativePromptAdditions ?? string.Empty
            };
        
            var dispacher = new Dispatcher();
            object dispatcherResult; // Типът вече е object
            try
            {
                // Предаваме cancellationToken от HTTP заявката
                dispatcherResult = await dispacher.DispatchAsync(
                    promptText,
                    model.SelectedStyles ?? new List<string>(),
                    new List<string>(),
                    advancedSettingsDto, // Подаваме инстанцията на DTO-то
                    cancellationToken
                ); // Временно подаваме празен списък
                //_logger.LogInformation($"Dispatcher returned for prompt '{promptText}': {rawResultFromDispatcher.Substring(0, Math.Min(rawResultFromDispatcher.Length, 50))}...");
            }
            catch (Exception ex) // Този catch е за критични грешки в самия DispatchAsync, преди да върне стринг
            {
                _logger.LogError(ex, "Critical error calling DispatchAsync for prompt: {Prompt}", promptText);
                return StatusCode(500, new { success = false, message = $"Критична грешка при комуникация с услугата: {ex.Message}" });
            }

            if (dispatcherResult is JobResultDto completedJob) // Проверка дали резултатът е успешен DTO
            {
                // Вече имаме десериализираните данни, няма нужда от повторно парсване
                string imageUrl = $"data:image/{completedJob.ImageType};base64,{completedJob.ImageDataBase64}";
                //_logger.LogInformation("Image generation successful for prompt: {Prompt}", promptText);
                return Json(new { success = true, imageUrls = new List<string> { imageUrl } });
                //completedJob = null; // Освобождаваме паметта, ако е необходимо
                //imageUrl = null; // Освобождаваме паметта, ако е необходимо
                //dispatcherResult = null; // Освобождаваме паметта, ако е необходимо
            }
            else if (dispatcherResult is string resultString) // Ако е стринг, обработваме го както преди
            {
                try
                {
                    // Опит за парсване на стринга като JSON (за случаи на грешка или друг статус)
                    using (JsonDocument doc = JsonDocument.Parse(resultString))
                    {
                        JsonElement root = doc.RootElement;
                        if (root.TryGetProperty("status", out JsonElement statusElement))
                        {
                            string status = statusElement.GetString();
                            // "completed" вече е обработен по-горе. Тук обработваме другите статуси.
                            if (status.Equals("failed", StringComparison.OrdinalIgnoreCase) ||
                                status.Equals("not_found", StringComparison.OrdinalIgnoreCase) /* и други неуспешни статуси */)
                            {
                                string failureMessage = $"Грешка от сървъра (статус: {status}).";
                                if (root.TryGetProperty("message", out JsonElement msgElement) && msgElement.ValueKind == JsonValueKind.String)
                                {
                                    failureMessage = msgElement.GetString();
                                }
                                _logger.LogWarning("Image generation service returned status: {Status}. Payload length: {PayloadLength}", status, resultString.Length);
                                return Json(new { success = false, message = failureMessage });
                            }
                            else
                            {
                                // pending, processing или друг неочакван статус
                                _logger.LogWarning("Image generation returned JSON with unhandled status: {Status}. Payload length: {PayloadLength}", status, resultString.Length);
                                return Json(new { success = false, message = $"Получен е отговор със статус '{status}', който не е финален." });
                            }
                        }
                        else
                        {
                            _logger.LogWarning("Image generation returned JSON without a 'status' property. Payload length: {PayloadLength}", resultString.Length);
                            return Json(new { success = false, message = "Получен е невалиден формат на отговор от услугата." });
                        }
                    }
                }
                catch (JsonException) // Ако resultString не е валиден JSON (това може да е съобщение за грешка от DispatchAsync)
                {
                    _logger.LogWarning("Result from DispatchAsync was not JSON, treating as error message: {Result}", resultString);
                    return Json(new { success = false, message = resultString });
                }
                catch (Exception ex) // Други неочаквани грешки при обработката на стринга
                {
                    _logger.LogError(ex, "Error processing dispatcher string result for prompt: {Prompt}. Raw dispatcher result: {RawResult}", promptText, resultString);
                    return StatusCode(500, new { success = false, message = $"Възникна сървърна грешка при обработка на резултата: {ex.Message}" });
                }
            }
            else // Неочакван тип резултат от Dispatcher
            {
                _logger.LogError("Dispatcher returned an unexpected result type: {ResultType}", dispatcherResult?.GetType().FullName ?? "null");
                return StatusCode(500, new { success = false, message = "Получен е неочакван тип резултат от услугата за генериране." });
            }
           
        }

        [HttpGet]
        public string NovaFunctions()
        {
            // return comfyUi.Hello();
            return string.Empty;
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
        public List<string> SelectedStyles { get; set; }

          // Нови свойства за допълнителните настройки
        public bool UseCfgScale { get; set; }
        public float? CfgScaleValue { get; set; } // Nullable, тъй като стойността е релевантна само ако UseCfgScale е true
        public int BatchCount { get; set; } // Брой изображения за генериране
        public bool UseSampler { get; set; }
        public string SamplerValue { get; set; } // Ще съдържа "normal" или "karras"
        public string PositivePromptAdditions { get; set; }
        public string NegativePromptAdditions { get; set; }
    }

    public class StyleFullNameModel
    {
        public string buttonFullName { get; set; }
    }
}
