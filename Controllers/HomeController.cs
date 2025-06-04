using System;
using System.Diagnostics;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using TextToImageASPTest.Models;
using TextToImageASPTest.Services;
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

            // Актуализиране на AdvancedPromptSettings въз основа на получените данни от модела
            AdvancedPromptSettings.ToUseCfgScale = model.UseCfgScale;
            if (model.UseCfgScale && model.CfgScaleValue.HasValue)
            {
                AdvancedPromptSettings.CfgScale = model.CfgScaleValue.Value;
            }

            AdvancedPromptSettings.BatchSize = model.BatchCount;

            AdvancedPromptSettings.ToUseScheduler = model.UseSampler;
            if (model.UseSampler && !string.IsNullOrEmpty(model.SamplerValue))
            {
                // Стойностите от HTML са "normal" и "karras"
                AdvancedPromptSettings.IsKarras = model.SamplerValue.Equals("karras", StringComparison.OrdinalIgnoreCase);
            }

            AdvancedPromptSettings.PositivePrompt = model.PositivePromptAdditions ?? string.Empty;
            AdvancedPromptSettings.NegativePrompt = model.NegativePromptAdditions ?? string.Empty;

            var dispacher = new Dispatcher();
            string rawResultFromDispatcher;
            try
            {
                // Предаваме cancellationToken от HTTP заявката
                rawResultFromDispatcher = await dispacher.DispatchAsync(promptText, data.GetSelectedStyleNames(), new List<string>(), cancellationToken);
                _logger.LogInformation($"Dispatcher returned for prompt '{promptText}': {rawResultFromDispatcher.Substring(0, Math.Min(rawResultFromDispatcher.Length, 200))}...");
            }
            catch (Exception ex) // Този catch е за критични грешки в самия DispatchAsync, преди да върне стринг
            {
                _logger.LogError(ex, "Critical error calling DispatchAsync for prompt: {Prompt}", promptText);
                return StatusCode(500, new { success = false, message = $"Критична грешка при комуникация с услугата: {ex.Message}" });
            }

            try
            {
                // Опит за парсване на резултата от диспечера като JSON
                using (JsonDocument doc = JsonDocument.Parse(rawResultFromDispatcher))
                {
                    JsonElement root = doc.RootElement;
                    if (root.TryGetProperty("status", out JsonElement statusElement))
                    {
                        string status = statusElement.GetString();
                        if (status.Equals("completed", StringComparison.OrdinalIgnoreCase))
                        {
                            if (root.TryGetProperty("image_data_base64", out JsonElement imageBase64Element) && imageBase64Element.ValueKind == JsonValueKind.String &&
                                root.TryGetProperty("image_type", out JsonElement imageTypeElement) && imageTypeElement.ValueKind == JsonValueKind.String)
                            {
                                string base64Image = imageBase64Element.GetString();
                                string imageType = imageTypeElement.GetString();
                                string imageUrl = $"data:image/{imageType};base64,{base64Image}";
                                _logger.LogInformation("Image generation successful for prompt: {Prompt}", promptText);
                                return Json(new { success = true, imageUrls = new List<string> { imageUrl } });
                            }
                            else
                            {
                                _logger.LogError("Completed job result from dispatcher is missing or has invalid image_data_base64/image_type. Payload: {Payload}", rawResultFromDispatcher);
                                return Json(new { success = false, message = "Полученият резултат (завършен) е непълен или невалиден." });
                            }
                        }
                        else if (status.Equals("failed", StringComparison.OrdinalIgnoreCase))
                        {
                            string failureMessage = "Грешка при генериране на изображението от сървъра.";
                            if (root.TryGetProperty("message", out JsonElement msgElement) && msgElement.ValueKind == JsonValueKind.String)
                            {
                                failureMessage = msgElement.GetString();
                            }
                            _logger.LogWarning("Image generation failed by the service. Status: failed. Payload: {Payload}", rawResultFromDispatcher);
                            return Json(new { success = false, message = failureMessage });
                        }
                        else
                        {
                            _logger.LogWarning("Image generation returned JSON with unknown status: {Status}. Payload: {Payload}", status, rawResultFromDispatcher);
                            return Json(new { success = false, message = $"Получен е отговор с неизвестен статус '{status}'." });
                        }
                    }
                    else
                    {
                        _logger.LogWarning("Image generation returned JSON without a 'status' property. Payload: {Payload}", rawResultFromDispatcher);
                        return Json(new { success = false, message = "Получен е невалиден формат на отговор от услугата." });
                    }
                }
            }
            catch (JsonException) // Ако rawResultFromDispatcher не е валиден JSON (това е очакваният път за грешки от Dispatcher)
            {
                _logger.LogWarning("Result from DispatchAsync was not JSON, treating as error message: {Result}", rawResultFromDispatcher);
                return Json(new { success = false, message = rawResultFromDispatcher });
            }
            catch (Exception ex) // Други неочаквани грешки при обработката
            {
                _logger.LogError(ex, "Error processing dispatcher result for prompt: {Prompt}. Raw dispatcher result: {RawResult}", promptText, rawResultFromDispatcher);
                return StatusCode(500, new { success = false, message = $"Възникна сървърна грешка при обработка на резултата: {ex.Message}" });
            }
            //CancellationTokenSource cts = new CancellationTokenSource();
            // try
            // {
            //     // Задаваме таймаут от 60 секунди
            //     cts.CancelAfter(TimeSpan.FromSeconds(60));

            //     // Получаваме списък с имената на избраните стилове
            //     var selectedStyle1Names = data.GetSelectedStyleNames();
            //     //var selectedStyle2Names = StylesManager.GetSelectedStyleNames(); // Предполагам, че имаш и такъв мениджър

            //     // Извикваме услугата с CancellationToken
            //     // ВАЖНО: Увери се, че твоят ComfyUiServices.GenerateImageFromText метод приема CancellationToken!
            //     //var images = await comfyUi.GenerateImageFromText(promptText, selectedStyle1Names, new List<string>(), cts.Token);
            //     _logger.LogInformation($"Generating image with prompt: {promptText} and styles: {string.Join(", ", selectedStyle1Names)}");
            //     List<byte[]> imageBytesList = await comfyUi.GenerateImageFromText(promptText, selectedStyle1Names, new List<string>(), cts.Token);

            //     _logger.LogInformation($"Image generation completed. Images received: {imageBytesList?.Count ?? 0}");
            //     if (imageBytesList != null && imageBytesList.Count > 0)
            //     {
            //         // Показваме първото генерирано изображение
            //         var imageUrls = new List<string>();
            //         foreach (var imageBytes in imageBytesList)
            //         {
            //             string base64Image = Convert.ToBase64String(imageBytes);
            //             // Препоръчително е да се укаже типа на изображението, ако е известен (напр. image/png, image/jpeg)
            //             // Засега приемаме PNG по подразбиране, както беше и преди.
            //             imageUrls.Add($"data:image/png;base64,{base64Image}");
            //         }

            //         // AppSettings.imageCounter++; // Ако все още използвате този брояч
            //         return Json(new { success = true, imageUrls = imageUrls });
            //     }
            //     else
            //     {
            //         _logger.LogWarning("Generation returned no images for prompt: {Prompt}", promptText);
            //         return Json(new { success = false, message = "Не бяха генерирани изображения." });
            //     }
            //     //System.Diagnostics.Debug.WriteLine($"Generation finished. Images received: {images?.Count ?? 0}");
            //     // if (images != null && images.Count > 0)
            //     // {
            //     //     // Показваме първото генерирано изображение
            //     //     ResultImage.Source = ImageSource.FromStream(() => new MemoryStream(images[0]));
            //     //     AppSettings.imageCounter++; // Увеличаваме брояча на генерираните изображения
            //     // }
            //     // else
            //     // {
            //     //     System.Diagnostics.Debug.WriteLine("Generation returned no images.");
            //     //     // Може да покажеш съобщение на потребителя тук
            //     // }
            // }
            // catch (OperationCanceledException)
            // {
            //     // Това се случва, ако cts.CancelAfter() се задейства (таймаут)
            //     //System.Diagnostics.Debug.WriteLine("Image generation timed out after 10 seconds.");
            //     //await DisplayAlert("Таймаут", "Генерирането отне твърде дълго време и беше прекратено.", "OK");
            //     //ResultImage.Source = null; // Изчистваме изображението при таймаут
            //     //ResultImage.Opacity = 1; // Връщаме нормална прозрачност
            //     _logger.LogWarning("Image generation timed out for prompt: {Prompt}", promptText);
            //     return Json(new { success = false, message = "Генерирането отне твърде дълго време и беше прекратено." });
            // }
            // catch (Exception ex)
            // {
            //     // Хващаме други грешки (мрежови, от сървъра и т.н.)
            //     //System.Diagnostics.Debug.WriteLine($"An error occurred during image generation: {ex.Message}");
            //     //await DisplayAlert("Грешка", $"Възникна грешка при генериране: {ex.Message}", "OK");
            //     //ResultImage.Source = null; // Изчистваме изображението при грешка
            //     //ResultImage.Opacity = 1;
            //     _logger.LogError(ex, "Error during image generation for prompt: {Prompt}", promptText);
            //     return StatusCode(500, new { success = false, message = $"Възникна сървърна грешка: {ex.Message}" });
            // }
            // finally
            // {
            //     // Този блок се изпълнява ВИНАГИ - при успех, таймаут или грешка
            //     //ResetGenerationState();
            //     cts.Dispose(); // Освобождаваме ресурсите на CancellationTokenSource
            // }


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
