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
            
            // Ensure ILogger is available if not already
            // private readonly ILogger<HomeController> _logger; (should be in class constructor)
            
            string promptText = !isRandom ? AppSettings.SystemPositivePromptPrefix + (prompt ?? "").Trim() + ", " : CreatePortrait.GeneratePortraitPrompt();

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
                PositivePrompt = model.PositivePromptAdditions + AppSettings.SystemPositivePromptSufix ?? string.Empty, // Вземаме първоначалната стойност
                NegativePrompt = "" // Ще се определи по-долу
            };

            // --- ТУК ДОБАВИТЕ ВАШИТЕ УСЛОВИЯ ---
            // Логика за NegativePrompt въз основа на добавения чекбокс
            if (model.UseSystemNegativePrompt)
            {
                advancedSettingsDto.NegativePrompt = AppSettings.SystemNegativePrompt;
            }
            else
            {
                advancedSettingsDto.NegativePrompt = model.NegativePromptAdditions ?? string.Empty;
                // Ако потребителят не е въвел негативен промпт И не използва системния, отново използваме стойността по подразбиране
                if (string.IsNullOrWhiteSpace(advancedSettingsDto.NegativePrompt))
                {
                    //advancedSettingsDto.NegativePrompt = "ugly, blurry, low quality";
                    advancedSettingsDto.NegativePrompt = AppSettings.SystemNegativePrompt;
                }
            }
            // --- КРАЙ НА ВАШИТE УСЛОВИЯ ---

            var dispatcher = new Dispatcher(); // Consider injecting this via DI
            try
            {
                // DispatchAsync is now split. We first send the job.
                // SendJobAsync will return jobId or throw an exception.
                string jobId = await dispatcher.SendJobAsync(
                    promptText,
                    model.SelectedStyles ?? new List<string>(),
                    new List<string>(), // style2settings - assuming empty for now or add to model
                    advancedSettingsDto,
                    cancellationToken
                );
                _logger.LogInformation("Job submitted successfully with ID: {JobId} for prompt: {Prompt}", jobId, promptText);
                return Json(new { success = true, status = "submitted", jobId = jobId, message = "Заявката е приета и се обработва." });
            }
            // Catch specific exceptions from SendJobAsync
            catch (JsonException e) // Serialization error before sending
            {
                _logger.LogError(e, "JSON serialization error before sending job for prompt: {Prompt}", promptText);
                return Json(new { success = false, status = "error", message = $"Грешка при подготовка на заявката: {e.Message}" });
            }
            catch (HttpRequestException e) // Network or HTTP error during send
            {
                _logger.LogError(e, "HTTP request error sending job for prompt: {Prompt}", promptText);
                return Json(new { success = false, status = "error", message = $"Грешка при изпращане на заявката към сървъра: {e.Message}" });
            }
            catch (InvalidOperationException e) // Server accepted but response was malformed (e.g. missing jobId)
            {
                _logger.LogError(e, "Invalid operation error after sending job for prompt: {Prompt}", promptText);
                return Json(new { success = false, status = "error", message = $"Грешка в отговора от сървъра след изпращане: {e.Message}" });
            }
            catch (OperationCanceledException e) // Task was cancelled
            {
                _logger.LogWarning(e, "Job submission cancelled for prompt: {Prompt}", promptText);
                return Json(new { success = false, status = "cancelled", message = "Изпращането на заявката беше прекратено." });
            }
            catch (Exception ex) // Catch-all for other unexpected errors from SendJobAsync or DispatchAsync logic
            {
                _logger.LogError(ex, "Unexpected error during job submission/dispatch for prompt: {Prompt}", promptText);
                return StatusCode(500, new { success = false, status = "error", message = $"Неочаквана сървърна грешка: {ex.Message}" });
            }
        }

        [HttpGet("Home/PollJobStatus")]
        public async Task<IActionResult> PollJobStatus(string jobId, CancellationToken cancellationToken)
        {
            if (string.IsNullOrEmpty(jobId))
            {
                return BadRequest(new { success = false, status = "error", message = "Job ID е задължително." });
            }

            var dispatcher = new Dispatcher(); // Consider injecting this
            object result = await dispatcher.PollJobResultAsync(jobId, cancellationToken);

            if (result is JobResultDto completedJob)
            {
                string imageUrl = $"data:image/{completedJob.ImageType};base64,{completedJob.ImageDataBase64}";
                _logger.LogInformation("PollJobStatus: Job {JobId} completed.", jobId);
                return Json(new { success = true, status = "completed", imageUrls = new List<string> { imageUrl }, jobId = jobId });
            }
            else if (result is string resultString)
            {
                // Try to parse the string as JSON to get a status from backend
                try
                {
                    using (JsonDocument doc = JsonDocument.Parse(resultString))
                    {
                        JsonElement root = doc.RootElement;
                        if (root.TryGetProperty("status", out JsonElement statusElement))
                        {
                            string status = statusElement.GetString().ToLowerInvariant();
                            string message = root.TryGetProperty("message", out var msgEl) && msgEl.ValueKind == JsonValueKind.String 
                                             ? msgEl.GetString() 
                                             : $"Статус от сървъра: {status}";

                            if (status == "failed" || status == "not_found")
                            {
                                _logger.LogWarning("PollJobStatus: Job {JobId} failed with status {Status}, message: {Message}", jobId, status, message);
                                return Json(new { success = false, status = status, message = message, jobId = jobId });
                            }
                            else if (status == "pending" || status == "processing")
                            {
                                _logger.LogInformation("PollJobStatus: Job {JobId} is {Status}.", jobId, status);
                                return Json(new { success = true, status = status, jobId = jobId });
                            }
                            // else: unhandled status from backend JSON
                             _logger.LogWarning("PollJobStatus: Job {JobId} returned unhandled JSON status: {Status}. Payload: {Payload}", jobId, status, resultString);
                            return Json(new { success = false, status = "error", message = $"Непознат статус от сървъра: {status}", jobId = jobId });
                        }
                    }
                }
                catch (JsonException) { /* Not a JSON string, probably a direct error message from Dispatcher's PollJobResultAsync (e.g., timeout) */ }
                
                _logger.LogWarning("PollJobStatus for {JobId} returned string (likely polling error/timeout): {ResultString}", jobId, resultString);
                return Json(new { success = false, status = "error", message = resultString, jobId = jobId }); // e.g. "Polling for job result timed out..."
            }
            else // Unexpected type
            {
                _logger.LogError("PollJobStatus for {JobId} received unexpected result type: {ResultType}", jobId, result?.GetType().Name);
                return StatusCode(500, new { success = false, status = "error", message = "Неочакван отговор от сървъра при проверка на статус.", jobId = jobId });
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
        public bool UseSystemNegativePrompt { get; set; } // Ново свойство
    }

    public class StyleFullNameModel
    {
        public string buttonFullName { get; set; }
    }
}
