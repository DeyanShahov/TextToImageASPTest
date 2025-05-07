using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TextToImageASPTest.Models;
using TextToImageCore;
using TextToImageCore.services;

namespace TextToImageASPTest.Controllers
{
    public class HomeController : Controller
    {
        private readonly ILogger<HomeController> _logger;

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
        public IActionResult AddStyleSelection([FromBody] StyleSelectionModel model)
        {
            if(model == null || string.IsNullOrWhiteSpace(model.ButtonName) || string.IsNullOrWhiteSpace(model.StyleName))
            {
                return BadRequest(new { success = false, message = "Невалидни данни."});
            }

            try
            {
                string buttonStyle = model.StyleName.ToString();
                string uppercaseButtonStyle = char.ToUpper(buttonStyle[0]) + buttonStyle.Substring(1);
                bool success = data.AddStyle(model.ButtonName, uppercaseButtonStyle);

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
        public IActionResult RemoveStyleSelection([FromBody] StyleSelectionModel model)
        {
            if (model == null || string.IsNullOrWhiteSpace(model.ButtonName) || string.IsNullOrWhiteSpace(model.StyleName))
            {
                return BadRequest(new { success = false, message = "Невалидни данни." });
            }
            try
            {
                string buttonStyle = model.StyleName.ToString();
                string uppercaseButtonStyle = char.ToUpper(buttonStyle[0]) + buttonStyle.Substring(1);
                data.RemoveStyle(model.ButtonName, uppercaseButtonStyle);
                return Json(new { success = true, message = "Стилът е премахнат успешно." });

                //bool success = data.RemoveStyle(model.ButtonName, uppercaseButtonStyle);
                //if (success)
                //{
                //    return Json(new { success = true, message = "Стилът е премахнат успешно." });
                //}
                //else
                //{
                //    // Ако RemoveStyle връща false при неуспех (напр. стилът не съществува и не е премахнат)
                //    return Json(new { success = false, message = "Стилът не беше премахнат (може би не съществува)." });
                //}
            }
            catch (Exception ex)
            {
                // Добра практика е да логвате грешката
                // Logger.LogError(ex, "Error removing style selection.");
                return StatusCode(500, new { success = false, message = "Възникна сървърна грешка." });
            }
        }
    }


    public class StyleSelectionModel
    {
        public string ButtonName { get; set; }
        public string StyleName { get; set; }
    }
}
