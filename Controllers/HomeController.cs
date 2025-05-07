using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TextToImageASPTest.Models;

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
    }
}
