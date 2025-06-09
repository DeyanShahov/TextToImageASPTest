namespace TextToImageASPTest.Services
{
    public class AdvancedSettingsDto
    {
        // Стойностите по подразбиране могат да се зададат тук или в конструктор,
        // или HomeController да ги управлява изцяло при попълване от ImageRequestModel.
        // За простота, нека HomeController да се грижи за стойностите.

        public string PositivePrompt { get; set; } = string.Empty;
        public string NegativePrompt { get; set; } = string.Empty;
        public bool UseCfgScale { get; set; } = false;// Преименувано за консистентност с ImageRequestModel
        public float CfgScale { get; set; } = 7.0f; // Типична стойност по подразбиране
        public int BatchSize { get; set; } = 1;
        public bool UseScheduler { get; set; } = false;// Преименувано
        public bool IsKarras { get; set; } = true; // Типична стойност по подразбиране

        // Конструктор по подразбиране е достатъчен, HomeController ще попълва свойствата.
        // Може да се добави конструктор, ако има сложна логика за инициализация.
    }
}
